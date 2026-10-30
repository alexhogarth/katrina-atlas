namespace KatrinaApp.Client.Models;

public enum MarkerShape
{
    ShootingStar,
    Cross,
    Star,
    Sparkle,
    GlowDot,
    Heart,
    Pin,
    Plane,
}

public sealed class MarkerStyle
{
    public const string DefaultColor = "#ffd76a";
    public const double MaxTailLength = 2000;

    public MarkerShape Shape { get; set; } = MarkerShape.ShootingStar;
    public string Color { get; set; } = DefaultColor;
    /// <summary>Marker (or shooting-star head) size in pixels.</summary>
    public double Size { get; set; } = 18;
    /// <summary>Rotation in degrees, clockwise.</summary>
    public double Rotation { get; set; } = 330;
    /// <summary>Shooting-star tail length in pixels, 0 to <see cref="MaxTailLength"/>.</summary>
    public double TailLength { get; set; } = 90;
    /// <summary>Shooting-star tail bend, -1 to 1.</summary>
    public double TailCurve { get; set; } = 0.35;
    /// <summary>Line / point thickness, 0.05 to 0.8 (meaning varies by shape).</summary>
    public double Thickness { get; set; } = 0.3;
    /// <summary>Number of star points.</summary>
    public int Points { get; set; } = 5;
    /// <summary>Glow intensity, 0 to 1.</summary>
    public double Glow { get; set; } = 0.6;
    public double Opacity { get; set; } = 1;
    public bool Animate { get; set; }

    public MarkerStyle Clone() => (MarkerStyle)MemberwiseClone();
}

public sealed record MarkerShapeInfo(
    MarkerShape Shape,
    string Label,
    bool UsesRotation = true,
    bool UsesTail = false,
    bool UsesThickness = false,
    bool UsesPoints = false,
    string ThicknessLabel = "Thickness");

public static class MarkerShapes
{
    public static IReadOnlyList<MarkerShapeInfo> All { get; } =
    [
        new(MarkerShape.ShootingStar, "Shooting star", UsesTail: true),
        new(MarkerShape.Cross, "Cross", UsesThickness: true),
        new(MarkerShape.Star, "Star", UsesThickness: true, UsesPoints: true, ThicknessLabel: "Fullness"),
        new(MarkerShape.Sparkle, "Sparkle", UsesThickness: true, ThicknessLabel: "Fullness"),
        new(MarkerShape.GlowDot, "Glow dot", UsesRotation: false),
        new(MarkerShape.Heart, "Heart"),
        new(MarkerShape.Pin, "Pin"),
        new(MarkerShape.Plane, "Plane"),
    ];

    public static MarkerShapeInfo Get(MarkerShape shape) => All.First(s => s.Shape == shape);
}
