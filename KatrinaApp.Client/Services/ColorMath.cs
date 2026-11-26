using System.Globalization;

namespace KatrinaApp.Client.Services;

/// <summary>Hex ↔ HSV conversion for the colour wheel. Hue in degrees (0-360), saturation and value 0-1.</summary>
public static class ColorMath
{
    public static bool TryParseHex(string? hex, out (double R, double G, double B) rgb)
    {
        rgb = default;
        if (string.IsNullOrWhiteSpace(hex)) return false;
        var h = hex.Trim().TrimStart('#');
        if (h.Length == 3) h = string.Concat(h.Select(c => $"{c}{c}"));
        if (h.Length != 6 || !int.TryParse(h, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var n)) return false;
        rgb = (((n >> 16) & 255) / 255.0, ((n >> 8) & 255) / 255.0, (n & 255) / 255.0);
        return true;
    }

    public static (double H, double S, double V) HexToHsv(string? hex)
    {
        if (!TryParseHex(hex, out var c)) return (45, 0.58, 1);
        var max = Math.Max(c.R, Math.Max(c.G, c.B));
        var min = Math.Min(c.R, Math.Min(c.G, c.B));
        var d = max - min;
        double hue = 0;
        if (d > 0)
        {
            if (max == c.R) hue = 60 * (((c.G - c.B) / d) % 6);
            else if (max == c.G) hue = 60 * ((c.B - c.R) / d + 2);
            else hue = 60 * ((c.R - c.G) / d + 4);
        }
        if (hue < 0) hue += 360;
        return (hue, max == 0 ? 0 : d / max, max);
    }

    public static string HsvToHex(double h, double s, double v)
    {
        h = ((h % 360) + 360) % 360;
        s = Math.Clamp(s, 0, 1);
        v = Math.Clamp(v, 0, 1);
        var c = v * s;
        var x = c * (1 - Math.Abs(h / 60 % 2 - 1));
        var m = v - c;
        var (r, g, b) = (int)(h / 60) switch
        {
            0 => (c, x, 0.0),
            1 => (x, c, 0.0),
            2 => (0.0, c, x),
            3 => (0.0, x, c),
            4 => (x, 0.0, c),
            _ => (c, 0.0, x),
        };
        static int B(double f) => (int)Math.Round(Math.Clamp(f, 0, 1) * 255);
        return string.Create(CultureInfo.InvariantCulture, $"#{B(r + m):x2}{B(g + m):x2}{B(b + m):x2}");
    }
}
