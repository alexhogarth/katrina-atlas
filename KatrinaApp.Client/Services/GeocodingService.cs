using System.Globalization;
using System.Text.Json;

namespace KatrinaApp.Client.Services;

public sealed record GeoSearchResult(string Name, string DisplayName, double Latitude, double Longitude);

/// <summary>
/// Place search / reverse lookup using OpenStreetMap Nominatim.
/// Requests are throttled to 1 per second per the Nominatim usage policy.
/// </summary>
public sealed class GeocodingService(HttpClient http)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static readonly TimeSpan MinInterval = TimeSpan.FromSeconds(1.1);
    private static DateTime lastRequestUtc = DateTime.MinValue;

    public async Task<IReadOnlyList<GeoSearchResult>> SearchAsync(string query, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return [];
        }

        var url = $"search?format=jsonv2&addressdetails=1&limit=6&accept-language=en&q={Uri.EscapeDataString(query.Trim())}";
        using var doc = await GetJsonAsync(url, cancellationToken);

        var results = new List<GeoSearchResult>();
        foreach (var item in doc.RootElement.EnumerateArray())
        {
            if (!TryGetCoordinate(item, "lat", out var lat) || !TryGetCoordinate(item, "lon", out var lon))
            {
                continue;
            }

            var display = item.TryGetProperty("display_name", out var d) ? d.GetString() ?? "" : "";
            results.Add(new GeoSearchResult(ShortName(item) ?? display, display, lat, lon));
        }

        return results;
    }

    /// <summary>Returns a friendly name like "Lisbon, Portugal" for a coordinate, or null if nothing was found.</summary>
    public async Task<string?> ReverseAsync(double latitude, double longitude, CancellationToken cancellationToken = default)
    {
        var url = string.Create(CultureInfo.InvariantCulture,
            $"reverse?format=jsonv2&addressdetails=1&zoom=10&accept-language=en&lat={latitude}&lon={longitude}");
        using var doc = await GetJsonAsync(url, cancellationToken);

        if (doc.RootElement.ValueKind != JsonValueKind.Object || doc.RootElement.TryGetProperty("error", out _))
        {
            return null;
        }

        return ShortName(doc.RootElement)
            ?? (doc.RootElement.TryGetProperty("display_name", out var d) ? d.GetString() : null);
    }

    private async Task<JsonDocument> GetJsonAsync(string url, CancellationToken cancellationToken)
    {
        await Gate.WaitAsync(cancellationToken);
        try
        {
            var wait = lastRequestUtc + MinInterval - DateTime.UtcNow;
            if (wait > TimeSpan.Zero)
            {
                await Task.Delay(wait, cancellationToken);
            }

            using var response = await http.GetAsync(url, cancellationToken);
            response.EnsureSuccessStatusCode();
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        }
        finally
        {
            lastRequestUtc = DateTime.UtcNow;
            Gate.Release();
        }
    }

    private static bool TryGetCoordinate(JsonElement item, string property, out double value)
    {
        value = 0;
        return item.TryGetProperty(property, out var prop)
            && double.TryParse(prop.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out value);
    }

    private static string? ShortName(JsonElement item)
    {
        string? Get(JsonElement e, string name) =>
            e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String
                ? p.GetString()
                : null;

        var address = item.TryGetProperty("address", out var a) ? a : default;
        var place = Get(item, "name") is { Length: > 0 } n ? n
            : Get(address, "city") ?? Get(address, "town") ?? Get(address, "village") ?? Get(address, "county") ?? Get(address, "state");
        var country = Get(address, "country");

        if (string.IsNullOrWhiteSpace(place))
        {
            return country;
        }

        return country is null || string.Equals(place, country, StringComparison.OrdinalIgnoreCase)
            ? place
            : $"{place}, {country}";
    }
}
