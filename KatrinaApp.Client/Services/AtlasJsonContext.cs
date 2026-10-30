using System.Text.Json.Serialization;
using KatrinaApp.Client.Models;

namespace KatrinaApp.Client.Services;

/// <summary>
/// Marker payload sent to the JS map. The icon is <see cref="W"/>×<see cref="H"/> with the map point at
/// (<see cref="Ax"/>, <see cref="Ay"/>); (<see cref="Hx"/>, <see cref="Hy"/>) is the clickable centre relative to that point.
/// </summary>
public sealed record MapMarkerDto(
    string Id,
    double Lat,
    double Lng,
    string Svg,
    double W,
    double H,
    double Ax,
    double Ay,
    double Hx,
    double Hy,
    double Hit,
    string Name,
    string Label,
    string LabelPos,
    string Color,
    bool Animate,
    bool Selected);

[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    UseStringEnumConverter = true)]
[JsonSerializable(typeof(List<TravelLocation>))]
[JsonSerializable(typeof(MarkerStyle))]
[JsonSerializable(typeof(MapSettings))]
[JsonSerializable(typeof(List<MapMarkerDto>))]
[JsonSerializable(typeof(MapMarkerDto))]
public sealed partial class AtlasJsonContext : JsonSerializerContext;
