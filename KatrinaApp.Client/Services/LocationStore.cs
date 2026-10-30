using System.Text.Json;
using KatrinaApp.Client.Models;
using Microsoft.JSInterop;

namespace KatrinaApp.Client.Services;

/// <summary>Persists locations and preferences in the browser's localStorage.</summary>
public sealed class LocationStore(IJSRuntime js)
{
    private const string LocationsKey = "katrina-atlas.locations.v1";
    private const string LastStyleKey = "katrina-atlas.last-style.v1";
    private const string MapSettingsKey = "katrina-atlas.map-settings.v1";

    public async Task<List<TravelLocation>> LoadAsync()
    {
        var json = await js.InvokeAsync<string?>("localStorage.getItem", LocationsKey);
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize(json, AtlasJsonContext.Default.ListTravelLocation) ?? [];
        }
        catch (JsonException)
        {
            // Keep the unreadable data around rather than silently overwriting it.
            await js.InvokeVoidAsync("localStorage.setItem", $"{LocationsKey}.corrupt-{DateTime.UtcNow:yyyyMMddHHmmss}", json);
            return [];
        }
    }

    public Task SaveAsync(List<TravelLocation> locations) =>
        js.InvokeVoidAsync("localStorage.setItem", LocationsKey,
            JsonSerializer.Serialize(locations, AtlasJsonContext.Default.ListTravelLocation)).AsTask();

    public async Task<MarkerStyle?> LoadLastStyleAsync()
    {
        var json = await js.InvokeAsync<string?>("localStorage.getItem", LastStyleKey);
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
        js.InvokeVoidAsync("localStorage.setItem", LastStyleKey,
            JsonSerializer.Serialize(style, AtlasJsonContext.Default.MarkerStyle)).AsTask();

    public async Task<MapSettings> LoadMapSettingsAsync()
    {
        var json = await js.InvokeAsync<string?>("localStorage.getItem", MapSettingsKey);
        if (string.IsNullOrWhiteSpace(json))
        {
            return new MapSettings();
        }

        try
        {
            return JsonSerializer.Deserialize(json, AtlasJsonContext.Default.MapSettings) ?? new MapSettings();
        }
        catch (JsonException)
        {
            return new MapSettings();
        }
    }

    public Task SaveMapSettingsAsync(MapSettings settings) =>
        js.InvokeVoidAsync("localStorage.setItem", MapSettingsKey,
            JsonSerializer.Serialize(settings, AtlasJsonContext.Default.MapSettings)).AsTask();
}
