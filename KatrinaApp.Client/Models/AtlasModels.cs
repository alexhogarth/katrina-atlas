namespace KatrinaApp.Client.Models;

public enum MapTheme
{
    Light,
    Dark,
    Emerald,
    Navy,
    Blue,
    Midnight,
    Sand,
    /// <summary>The user's own sea and land colours (<see cref="MapSettings.CustomSea"/>, <see cref="MapSettings.CustomLand"/>).</summary>
    Custom,
}

public enum VisitKind
{
    Visited,
    Lived,
    Worked,
}

public static class VisitKinds
{
    /// <summary>Display order used by the list and the editors.</summary>
    public static IReadOnlyList<VisitKind> All { get; } = [VisitKind.Lived, VisitKind.Worked, VisitKind.Visited];

    public static string Label(VisitKind kind) => kind switch
    {
        VisitKind.Lived => "🏡 Lived",
        VisitKind.Worked => "💼 Worked",
        _ => "✈️ Visited",
    };
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
    /// <summary>
    /// When set, markers keep their size relative to the map: they look exactly as designed at this zoom level
    /// and grow / shrink with the map when zooming. Null means markers stay a fixed size on screen.
    /// </summary>
    public double? MarkerZoom { get; set; }
    /// <summary>Longitude placed in the middle of exported images (0 = Greenwich, so the UK is central).</summary>
    public double ExportCenterLongitude { get; set; }
    /// <summary>
    /// How much exported images are stretched sideways (1 = not at all, up to 2.5), so the map fills wide formats
    /// such as LinkedIn banners instead of leaving sea at the sides. Markers and labels are never stretched.
    /// </summary>
    public double ExportStretch { get; set; } = 1;
    /// <summary>Sea colour for the custom theme (#rrggbb); null until first chosen.</summary>
    public string? CustomSea { get; set; }
    /// <summary>Land colour for the custom theme (#rrggbb); null until first chosen.</summary>
    public string? CustomLand { get; set; }

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

/// <summary>An entry in the list of saved maps.</summary>
public sealed class AtlasMapInfo
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>One map: its places and how it looks. Also the format of saved .atlas.json files.</summary>
public sealed class AtlasDocument
{
    public const int MaxNameLength = 60;

    public string Format { get; set; } = "katrinas-atlas";
    public int Version { get; set; } = 1;
    public string Name { get; set; } = "";
    public MapTheme? Theme { get; set; }
    public MapSettings Settings { get; set; } = new();
    public List<TravelLocation> Locations { get; set; } = [];
}
