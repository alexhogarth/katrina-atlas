# Katrina's Atlas

A world map of the places you've lived and visited, with shooting stars, crosses, pins and more.
It's a standalone Blazor WebAssembly app, so it runs entirely in the browser and is hosted as static files.

- Map: Leaflet + MapLibre GL with [OpenFreeMap](https://openfreemap.org) vector tiles (no API key)
- Place search: [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap)
- Storage: the browser's `localStorage`. Places are saved per browser and device, so clearing site data deletes them.

## Run locally

```powershell
cd KatrinaApp.Client
dotnet run
```

Then open http://localhost:5024.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` publishes the app on every push to `main`.

1. Create a GitHub repo and push this folder to it. For example:
   ```powershell
   gh repo create katrina-atlas --public --source . --push
   ```
2. In the repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
   You can also do this from the command line:
   ```powershell
   gh api -X POST repos/{owner}/katrina-atlas/pages -f build_type=workflow
   ```
3. Re-run the **Deploy to GitHub Pages** workflow, or push again. The site will appear at
   `https://<your-user>.github.io/katrina-atlas/`.

The workflow rewrites `<base href>` to match the repo name, so any repo name works.
For a custom domain, add a `KatrinaApp.Client/wwwroot/CNAME` file containing the domain, and the site will be served from `/`.

Free GitHub accounts need a **public** repo for Pages. The repo only holds the code; places are stored in each visitor's browser.

## Other static hosts

Run `dotnet publish KatrinaApp.Client -c Release -o publish` and upload `publish/wwwroot`
to Cloudflare Pages, Azure Static Web Apps, Netlify or similar, served from the site root.
