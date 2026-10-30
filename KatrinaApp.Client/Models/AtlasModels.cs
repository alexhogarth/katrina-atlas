namespace KatrinaApp.Client.Models;

public enum MapTheme
{
    Light,
    Dark,
    Emerald,
}

public enum VisitKind
{
    Visited,
    Lived,
}

/// <summary>Where a location's custom map label sits relative to its marker.</summary>
public enum LabelPosition
{
    Right,
    Left,
    Above,
    Below,
}

public readonly record struct GeoPoint(double Latitude, double Longitude);

/// <summary>Which basemap layers / overlays are shown.</summary>
public sealed class MapSettings
{
    public bool ShowBorders { get; set; } = true;
    public bool ShowCountryNames { get; set; } = true;
    public bool ShowCityNames { get; set; } = true;
    /// <summary>Show the custom labels the user gave their places.</summary>
    public bool ShowPlaceLabels { get; set; } = true;

    public MapSettings Clone() => (MapSettings)MemberwiseClone();
}

public sealed class TravelLocation
{
    public const int MaxLabelLength = 60;

    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public VisitKind Kind { get; set; } = VisitKind.Visited;
    public MarkerStyle Style { get; set; } = new();
    /// <summary>Optional text drawn next to the marker on the map.</summary>
    public string Label { get; set; } = "";
    public LabelPosition LabelPosition { get; set; } = LabelPosition.Right;
    public DateTimeOffset AddedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Mutable working copy used by the editor (position is optional until chosen).</summary>
public sealed class LocationDraft
{
    public Guid? EditingId { get; init; }
    public string Name { get; set; } = "";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public VisitKind Kind { get; set; } = VisitKind.Visited;
    public MarkerStyle Style { get; set; } = new();
    public string Label { get; set; } = "";
    public LabelPosition LabelPosition { get; set; } = LabelPosition.Right;

    public bool HasPosition => Latitude is not null && Longitude is not null;

    public static LocationDraft FromLocation(TravelLocation location) => new()
    {
        EditingId = location.Id,
        Name = location.Name,
        Latitude = location.Latitude,
        Longitude = location.Longitude,
        Kind = location.Kind,
        Style = location.Style.Clone(),
        Label = location.Label ?? "",
        LabelPosition = location.LabelPosition,
    };
}
