using KatrinaApp.Client.Services;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

namespace KatrinaApp.Client
{
    internal class Program
    {
        static async Task Main(string[] args)
        {
            var builder = WebAssemblyHostBuilder.CreateDefault(args);
            builder.RootComponents.Add<App>("#app");
            builder.RootComponents.Add<HeadOutlet>("head::after");

            builder.Services.AddScoped<LocationStore>();
            builder.Services.AddScoped(_ => new GeocodingService(new HttpClient
            {
                BaseAddress = new Uri("https://nominatim.openstreetmap.org/"),
            }));

            await builder.Build().RunAsync();
        }
    }
}
