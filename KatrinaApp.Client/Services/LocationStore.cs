using System.Text.Json;
using KatrinaApp.Client.Models;
using Microsoft.JSInterop;

namespace KatrinaApp.Client.Services;

/// <summary>
/// Persists maps and preferences in the browser's localStorage.
/// Each map is stored under its own key, so several tabs can edit different maps at the same time.
/// </summary>
public sealed class LocationStore(IJSRuntime js)
{
    public const string IndexKey = "katrina-atlas.maps.v1";
    private const string MapKeyPrefix = "katrina-atlas.map.";
    private const string CurrentMapKey = "katrina-atlas.current-map.v1";
    private const string LastStyleKey = "katrina-atlas.last-style.v1";

    // Single-map storage used before multiple maps existed. Read once to migrate, then left untouched as a backup.
    private const string LegacyLocationsKey = "katrina-atlas.locations.v1";
    private const string LegacyMapSettingsKey = "katrina-atlas.map-settings.v1";
    private const string LegacyThemeKey = "katrina-atlas.theme";

    public static string MapKey(Guid id) => $"{MapKeyPrefix}{id:N}.v1";

    private ValueTask<string?> GetAsync(string key) => js.InvokeAsync<string?>("localStorage.getItem", key);

    private Task SetAsync(string key, string value) => js.InvokeVoidAsync("localStorage.setItem", key, value).AsTask();

    /// <summary>Lists saved maps, creating the first one (from any older single-map data) if there are none.</summary>
    public async Task<List<AtlasMapInfo>> LoadIndexAsync()
    {
        var index = await ReadIndexAsync();
        if (index is { Count: > 0 })
        {
            return index;
        }

        var doc = new AtlasDocument
        {
            Name = "My map",
            Locations = await ReadLegacyAsync(LegacyLocationsKey, AtlasJsonContext.Default.ListTravelLocation) ?? [],
            Settings = await ReadLegacyAsync(LegacyMapSettingsKey, AtlasJsonContext.Default.MapSettings) ?? new MapSettings(),
            Theme = Enum.TryParse<MapTheme>(await GetAsync(LegacyThemeKey), ignoreCase: true, out var t) ? t : null,
        };
        var info = new AtlasMapInfo { Name = doc.Name };
        await SaveMapAsync(info.Id, doc);
        await WriteIndexAsync([info]);
        return [info];
    }

    private async Task<List<AtlasMapInfo>?> ReadIndexAsync()
    {
        var json = await GetAsync(IndexKey);
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize(json, AtlasJsonContext.Default.ListAtlasMapInfo);
        }
        catch (JsonException)
        {
            await SetAsync($"{IndexKey}.corrupt-{DateTime.UtcNow:yyyyMMddHHmmss}", json);
            return null;
        }
    }

    private Task WriteIndexAsync(List<AtlasMapInfo> index) =>
        SetAsync(IndexKey, JsonSerializer.Serialize(index, AtlasJsonContext.Default.ListAtlasMapInfo));

    private async Task<T?> ReadLegacyAsync<T>(string key, System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> type)
    {
        var json = await GetAsync(key);
        if (string.IsNullOrWhiteSpace(json)) return default;
        try
        {
            return JsonSerializer.Deserialize(json, type);
        }
        catch (JsonException)
        {
            return default;
        }
    }

    public async Task<AtlasDocument> LoadMapAsync(Guid id)
    {
        var json = await GetAsync(MapKey(id));
        if (string.IsNullOrWhiteSpace(json))
        {
            return new AtlasDocument();
        }

        try
        {
            return Normalize(JsonSerializer.Deserialize(json, AtlasJsonContext.Default.AtlasDocument) ?? new AtlasDocument());
        }
        catch (JsonException)
        {
            // Keep the unreadable data around rather than silently overwriting it.
            await SetAsync($"{MapKey(id)}.corrupt-{DateTime.UtcNow:yyyyMMddHHmmss}", json);
            return new AtlasDocument();
        }
    }

    public Task SaveMapAsync(Guid id, AtlasDocument doc) =>
        SetAsync(MapKey(id), JsonSerializer.Serialize(doc, AtlasJsonContext.Default.AtlasDocument));

    /// <summary>Adds a new map (re-reading the list first, in case another tab changed it).</summary>
    public async Task<AtlasMapInfo> CreateMapAsync(AtlasDocument doc)
    {
        var index = await ReadIndexAsync() ?? [];
        var info = new AtlasMapInfo { Name = UniqueName(index, doc.Name) };
        doc.Name = info.Name;
        await SaveMapAsync(info.Id, doc);
        index.Add(info);
        await WriteIndexAsync(index);
        return info;
    }

    public async Task RenameMapAsync(Guid id, string name)
    {
        var index = await ReadIndexAsync() ?? [];
        if (index.FirstOrDefault(m => m.Id == id) is not { } info) return;
        info.Name = UniqueName(index.Where(m => m.Id != id), name);
        await WriteIndexAsync(index);
        var doc = await LoadMapAsync(id);
        doc.Name = info.Name;
        await SaveMapAsync(id, doc);
    }

    /// <summary>Removes a map from the list. Its data is kept under a ".deleted" key in case it's ever needed.</summary>
    public async Task DeleteMapAsync(Guid id)
    {
        var index = await ReadIndexAsync() ?? [];
        index.RemoveAll(m => m.Id == id);
        await WriteIndexAsync(index);
        var json = await GetAsync(MapKey(id));
        if (!string.IsNullOrEmpty(json))
        {
            await SetAsync($"{MapKey(id)}.deleted", json);
        }
        await js.InvokeVoidAsync("localStorage.removeItem", MapKey(id));
    }

    public async Task<Guid?> LoadCurrentMapIdAsync() =>
        Guid.TryParse(await GetAsync(CurrentMapKey), out var id) ? id : null;

    public Task SaveCurrentMapIdAsync(Guid id) => SetAsync(CurrentMapKey, id.ToString("N"));

    public async Task<MarkerStyle?> LoadLastStyleAsync()
    {
        var json = await GetAsync(LastStyleKey);
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize(json, AtlasJsonContext.Default.MarkerStyle);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public Task SaveLastStyleAsync(MarkerStyle style) =>
        SetAsync(LastStyleKey, JsonSerializer.Serialize(style, AtlasJsonContext.Default.MarkerStyle));

    /// <summary>Serialises a map for saving as a file.</summary>
    public static string ToFileJson(AtlasDocument doc)
    {
        using var parsed = JsonDocument.Parse(JsonSerializer.Serialize(doc, AtlasJsonContext.Default.AtlasDocument));
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = true }))
        {
            parsed.WriteTo(writer);
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    /// <summary>Reads a saved map file (or a bare list of places). Returns null if it isn't one.</summary>
    public static AtlasDocument? FromFileJson(string json)
    {
        try
        {
            var trimmed = json.TrimStart();
            var doc = trimmed.StartsWith('[')
                ? new AtlasDocument { Locations = JsonSerializer.Deserialize(json, AtlasJsonContext.Default.ListTravelLocation) ?? [] }
                : JsonSerializer.Deserialize(json, AtlasJsonContext.Default.AtlasDocument);
            if (doc is null) return null;
            Normalize(doc);
            // Fresh ids so an imported copy never clashes with places already open elsewhere.
            foreach (var location in doc.Locations) location.Id = Guid.NewGuid();
            return doc;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static AtlasDocument Normalize(AtlasDocument doc)
    {
        doc.Settings ??= new MapSettings();
        doc.Locations ??= [];
        doc.Locations.RemoveAll(l => l is null);
        doc.Name = (doc.Name ?? "").Trim();
        if (doc.Name.Length > AtlasDocument.MaxNameLength) doc.Name = doc.Name[..AtlasDocument.MaxNameLength];
        foreach (var l in doc.Locations)
        {
            l.Name ??= "";
            l.Label ??= "";
            l.Style ??= new MarkerStyle();
            l.Latitude = double.IsFinite(l.Latitude) ? Math.Clamp(l.Latitude, -90, 90) : 0;
            l.Longitude = double.IsFinite(l.Longitude) ? Math.Clamp(l.Longitude, -180, 180) : 0;
            if (l.Label.Length > TravelLocation.MaxLabelLength) l.Label = l.Label[..TravelLocation.MaxLabelLength];
        }
        return doc;
    }

    private static string UniqueName(IEnumerable<AtlasMapInfo> others, string name)
    {
        name = string.IsNullOrWhiteSpace(name) ? "Untitled map" : name.Trim();
        if (name.Length > AtlasDocument.MaxNameLength) name = name[..AtlasDocument.MaxNameLength];
        var taken = others.Select(m => m.Name).ToHashSet(StringComparer.CurrentCultureIgnoreCase);
        if (!taken.Contains(name)) return name;
        for (var i = 2; ; i++)
        {
            var candidate = $"{name} ({i})";
            if (!taken.Contains(candidate)) return candidate;
        }
    }
}
