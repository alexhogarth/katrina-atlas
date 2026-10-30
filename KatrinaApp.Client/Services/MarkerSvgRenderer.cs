using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using KatrinaApp.Client.Models;

namespace KatrinaApp.Client.Services;

/// <summary>
/// Renders a <see cref="MarkerStyle"/> to an SVG string centred on the marker's anchor point.
/// Used for both the Leaflet map icons and the live previews in the side panel.
/// </summary>
public static partial class MarkerSvgRenderer
{
    /// <summary>
    /// Rendered marker. The SVG is <paramref name="Width"/>×<paramref name="Height"/> pixels and the map point sits at
    /// (<paramref name="AnchorX"/>, <paramref name="AnchorY"/>) within it. (HitX, HitY) is the clickable centre relative to the anchor.
    /// </summary>
    public readonly record struct RenderedMarker(
        string Svg, double Width, double Height, double AnchorX, double AnchorY, double HitX, double HitY, double HitRadius);

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColor();

    [GeneratedRegex("[^a-zA-Z0-9_-]")]
    private static partial Regex UnsafeIdChars();

    public static string SanitizeColor(string? color) =>
        color is not null && HexColor().IsMatch(color) ? color.ToLowerInvariant() : MarkerStyle.DefaultColor;

    /// <param name="idPrefix">Prefix for gradient ids; must be unique within the page.</param>
    /// <param name="fitContainer">If true the SVG scales to its container instead of using pixel dimensions.</param>
    public static RenderedMarker Render(MarkerStyle style, string idPrefix, bool fitContainer = false)
    {
        var id = UnsafeIdChars().Replace(idPrefix, "");
        var size = Math.Clamp(style.Size, 4, 120);
        var h = size / 2;
        var glow = Math.Clamp(style.Glow, 0, 1);
        var color = SanitizeColor(style.Color);
        var thickness = Math.Clamp(style.Thickness, 0.05, 0.8);
        var rotation = MarkerShapes.Get(style.Shape).UsesRotation ? style.Rotation % 360 : 0;

        var defs = new StringBuilder();
        var body = new StringBuilder();
        // Extent of the drawing: a circle of radius `reach` around the anchor plus any extra (unrotated) points.
        double reach;
        var extents = new List<(double X, double Y)>();
        double hitX = 0, hitY = 0, hitR = Math.Max(h, 8);

        switch (style.Shape)
        {
            case MarkerShape.ShootingStar:
                reach = RenderShootingStar(style, id, size, glow, color, defs, body, extents);
                hitR = Math.Max(h * 0.9, 8);
                break;

            case MarkerShape.Cross:
            {
                var t = Math.Max(1, size * thickness);
                var a = Math.Max(0, h - t / 2);
                body.Append($"""<g stroke="{color}" stroke-width="{F(t)}" stroke-linecap="round"><line x1="{F(-a)}" y1="0" x2="{F(a)}" y2="0"/><line x1="0" y1="{F(-a)}" x2="0" y2="{F(a)}"/></g>""");
                reach = h;
                break;
            }

            case MarkerShape.Star:
            {
                var points = Math.Clamp(style.Points, 3, 12);
                var inner = h * (0.2 + thickness * 0.7);
                var sb = new StringBuilder();
                for (var i = 0; i < points * 2; i++)
                {
                    var r = i % 2 == 0 ? h : inner;
                    var angle = Math.PI * i / points - Math.PI / 2;
                    sb.Append(i == 0 ? "M" : "L").Append(F(r * Math.Cos(angle))).Append(',').Append(F(r * Math.Sin(angle)));
                }
                body.Append($"""<path d="{sb}Z" fill="{color}" stroke-linejoin="round"/>""");
                reach = h;
                break;
            }

            case MarkerShape.Sparkle:
            {
                var p = h * thickness * 0.6;
                body.Append($"""<path d="{SparklePath(h, p)}" fill="{color}"/>""");
                body.Append($"""<circle r="{F(h * 0.12)}" fill="#ffffff" opacity="0.85"/>""");
                reach = h;
                break;
            }

            case MarkerShape.GlowDot:
            {
                var halo = h * (1 + glow * 1.6);
                defs.Append($"""<radialGradient id="{id}-halo"><stop offset="0" stop-color="{color}" stop-opacity="0.7"/><stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient>""");
                body.Append($"""<circle r="{F(halo)}" fill="url(#{id}-halo)"/>""");
                if (style.Animate)
                {
                    body.Append($"""<circle class="km-ring" r="{F(h * 0.55)}" fill="none" stroke="{color}" stroke-width="{F(Math.Max(1, h * 0.12))}"/>""");
                }
                body.Append($"""<circle r="{F(h * 0.55)}" fill="{color}"/>""");
                body.Append($"""<circle r="{F(h * 0.22)}" fill="#ffffff" opacity="0.85"/>""");
                reach = Math.Max(halo, style.Animate ? h * 1.7 : 0);
                break;
            }

            case MarkerShape.Heart:
                body.Append($"""<path transform="scale({F(size)}) translate(-0.5,-0.48)" d="M0.5,0.9C0.5,0.9 0.05,0.6 0.05,0.32C0.05,0.15 0.18,0.05 0.31,0.05C0.4,0.05 0.47,0.1 0.5,0.18C0.53,0.1 0.6,0.05 0.69,0.05C0.82,0.05 0.95,0.15 0.95,0.32C0.95,0.6 0.5,0.9 0.5,0.9Z" fill="{color}"/>""");
                reach = h * 1.05;
                break;

            case MarkerShape.Pin:
                // Tip of the pin sits on the anchor point.
                body.Append($"""<g transform="scale({F(size)})"><path d="M0,0C-0.1,-0.18 -0.36,-0.4 -0.36,-0.62A0.36,0.36 0 1 1 0.36,-0.62C0.36,-0.4 0.1,-0.18 0,0Z" fill="{color}"/><circle cx="0" cy="-0.62" r="0.14" fill="#ffffff" opacity="0.9"/></g>""");
                reach = size;
                hitY = -0.62 * size;
                hitR = Math.Max(0.4 * size, 8);
                break;

            case MarkerShape.Plane:
                body.Append($"""<path transform="scale({F(h)})" d="M0,-1C0.08,-1 0.1,-0.9 0.1,-0.8L0.1,-0.3L0.95,0.15L0.95,0.3L0.1,0.05L0.1,0.6L0.35,0.8L0.35,0.92L0,0.82L-0.35,0.92L-0.35,0.8L-0.1,0.6L-0.1,0.05L-0.95,0.3L-0.95,0.15L-0.1,-0.3L-0.1,-0.8C-0.1,-0.9 -0.08,-1 0,-1Z" fill="{color}"/>""");
                reach = h * 1.05;
                break;

            default:
                throw new ArgumentOutOfRangeException(nameof(style), style.Shape, "Unknown marker shape");
        }

        var glowPx = glow * (3 + size * 0.35);
        var radians = rotation * Math.PI / 180;
        var (sin, cos) = Math.SinCos(radians);
        double minX = -reach, minY = -reach, maxX = reach, maxY = reach;
        foreach (var (x, y) in extents)
        {
            var rx = x * cos - y * sin;
            var ry = x * sin + y * cos;
            minX = Math.Min(minX, rx);
            maxX = Math.Max(maxX, rx);
            minY = Math.Min(minY, ry);
            maxY = Math.Max(maxY, ry);
        }

        var pad = glowPx * 2 + 3;
        minX = Math.Floor(minX - pad);
        minY = Math.Floor(minY - pad);
        maxX = Math.Ceiling(maxX + pad);
        maxY = Math.Ceiling(maxY + pad);
        var width = maxX - minX;
        var height = maxY - minY;

        var filter = glowPx > 0.1
            ? $"filter:drop-shadow(0 0 {F(glowPx * 0.5)}px {color}) drop-shadow(0 0 {F(glowPx)}px {color});"
            : "";
        // Per-marker delay so animated markers don't all pulse in sync.
        var delay = (uint)id.GetHashCode() % 2600 / 1000.0;
        var dims = fitContainer ? "width=\"100%\" height=\"100%\"" : $"width=\"{F(width)}\" height=\"{F(height)}\"";

        var svg = new StringBuilder()
            .Append($"""<svg xmlns="http://www.w3.org/2000/svg" class="km-svg" {dims} viewBox="{F(minX)} {F(minY)} {F(width)} {F(height)}" style="overflow:visible;{filter}animation-delay:-{F(delay)}s">""")
            .Append(defs.Length > 0 ? $"<defs>{defs}</defs>" : "")
            .Append($"""<g transform="rotate({F(rotation)})">""")
            .Append($"""<g opacity="{F(Math.Clamp(style.Opacity, 0.1, 1))}">{body}</g>""")
            .Append($"""<circle class="km-hit" cx="{F(hitX)}" cy="{F(hitY)}" r="{F(hitR)}" fill="transparent"/>""")
            .Append("</g></svg>")
            .ToString();

        return new RenderedMarker(svg, width, height, -minX, -minY,
            Math.Round(hitX * cos - hitY * sin, 2), Math.Round(hitX * sin + hitY * cos, 2), hitR);
    }

    /// <summary>Head sits on the anchor; the tail extends along -X (before rotation) as a tapered, curved comet trail.</summary>
    private static double RenderShootingStar(MarkerStyle style, string id, double size, double glow, string color,
        StringBuilder defs, StringBuilder body, List<(double X, double Y)> extents)
    {
        var h = size / 2;
        var length = Math.Clamp(style.TailLength, 0, MarkerStyle.MaxTailLength);
        var curve = Math.Clamp(style.TailCurve, -1, 1);
        var width = Math.Max(1.5, size * 0.32);
        var c = (X: -length / 2, Y: -curve * length * 0.5);
        var end = (X: -length, Y: 0.0);

        if (length > 1)
        {
            const int samples = 28;
            var left = new StringBuilder();
            var right = new List<string>(samples + 1);
            for (var i = 0; i <= samples; i++)
            {
                var t = (double)i / samples;
                var u = 1 - t;
                var bx = 2 * u * t * c.X + t * t * end.X;
                var by = 2 * u * t * c.Y + t * t * end.Y;
                var dx = 2 * u * c.X + 2 * t * (end.X - c.X);
                var dy = 2 * u * c.Y + 2 * t * (end.Y - c.Y);
                var len = Math.Sqrt(dx * dx + dy * dy);
                if (len < 1e-6) { dx = -1; dy = 0; len = 1; }
                var nx = -dy / len;
                var ny = dx / len;
                var halfWidth = width / 2 * Math.Pow(u, 1.1);
                left.Append(i == 0 ? "M" : "L").Append(F(bx + nx * halfWidth)).Append(',').Append(F(by + ny * halfWidth));
                right.Add($"L{F(bx - nx * halfWidth)},{F(by - ny * halfWidth)}");
                extents.Add((bx + nx * halfWidth, by + ny * halfWidth));
                extents.Add((bx - nx * halfWidth, by - ny * halfWidth));
            }
            right.Reverse();

            defs.Append($"""<linearGradient id="{id}-tail" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{F(end.X)}" y2="{F(end.Y)}"><stop offset="0" stop-color="{color}" stop-opacity="0.95"/><stop offset="0.3" stop-color="{color}" stop-opacity="0.5"/><stop offset="1" stop-color="{color}" stop-opacity="0"/></linearGradient>""");
            defs.Append($"""<linearGradient id="{id}-core" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{F(end.X)}" y2="{F(end.Y)}"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/></linearGradient>""");
            body.Append($"""<path d="{left}{string.Concat(right)}Z" fill="url(#{id}-tail)"/>""");
            body.Append($"""<path d="M0,0Q{F(c.X)},{F(c.Y)} {F(end.X)},{F(end.Y)}" fill="none" stroke="url(#{id}-core)" stroke-width="{F(width * 0.28)}" stroke-linecap="round"/>""");
        }

        var headGlow = h * (1.2 + glow * 1.3);
        defs.Append($"""<radialGradient id="{id}-head"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset="0.25" stop-color="#ffffff" stop-opacity="0.85"/><stop offset="0.5" stop-color="{color}" stop-opacity="0.6"/><stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient>""");
        body.Append($"""<circle r="{F(headGlow)}" fill="url(#{id}-head)"/>""");
        body.Append($"""<path d="{SparklePath(h * 1.25, h * 0.1)}" fill="#ffffff" opacity="0.9"/>""");
        body.Append($"""<circle r="{F(h * 0.3)}" fill="#ffffff"/>""");

        return Math.Max(headGlow, h * 1.25);
    }

    private static string SparklePath(double r, double p) =>
        $"M0,{F(-r)}Q{F(p)},{F(-p)} {F(r)},0Q{F(p)},{F(p)} 0,{F(r)}Q{F(-p)},{F(p)} {F(-r)},0Q{F(-p)},{F(-p)} 0,{F(-r)}Z";

    private static string F(double value) => value.ToString("0.##", CultureInfo.InvariantCulture);
}
