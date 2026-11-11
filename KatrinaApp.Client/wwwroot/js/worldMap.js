// Leaflet-backed world map used by the WorldMap Blazor component.
// Requires the global `L` (wwwroot/lib/leaflet) and, for the vector basemap, `maplibregl` plus the
// Leaflet bridge `L.maplibreGL` (wwwroot/lib/maplibre). Without WebGL it falls back to raster tiles.

const THEMES = ['light', 'dark', 'emerald', 'navy', 'midnight', 'sand'];
// Themes with a pale basemap: markers get a soft outline (matches the .km-art rule in atlas.css).
const PALE_THEMES = new Set(['light', 'sand']);
const LABEL_POSITIONS = new Set(['right', 'left', 'above', 'below']);
const DEFAULT_SETTINGS = { showBorders: true, showCountryNames: true, showCityNames: true, showPlaceLabels: true, markerZoom: null };
// Limits for markers that scale with the map, so they never vanish or swamp the screen.
const MIN_MARKER_SCALE = 0.05;
const MAX_MARKER_SCALE = 8;

// ---------- Vector basemap (OpenFreeMap / OpenMapTiles schema, no API key) ----------

const OFM = 'https://tiles.openfreemap.org';
const NAME = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']];

const PALETTES = {
    light: {
        land: '#eceae6', water: '#c6d3dd', ice: '#f7f7f5', park: '#dfe6d8', building: '#e0ddd8',
        road: '#ffffff', roadMinor: '#f7f6f3', border: '#8f8c99', state: '#c2bfc9',
        countryText: '#4f5663', cityText: '#2f343c', townText: '#565c66', halo: 'rgba(255,255,255,0.92)',
    },
    dark: {
        land: '#2e2f33', water: '#18191c', ice: '#3a3b40', park: '#303631', building: '#36373c',
        road: '#45464c', roadMinor: '#3a3b40', border: '#6d6e78', state: '#46474e',
        countryText: '#a2a5ad', cityText: '#d4d6db', townText: '#a9acb3', halo: 'rgba(20,21,24,0.9)',
    },
    emerald: {
        land: '#3daa87', water: '#11523f', ice: '#74c9aa', park: '#47b28f', building: '#4cb592',
        road: '#5dc19f', roadMinor: '#53b895', border: '#1a6e55', state: '#2f8f71',
        countryText: '#e9fff6', cityText: '#f2fffa', townText: '#d3f4e7', halo: 'rgba(12,72,55,0.85)',
    },
    // McKinsey-style deep blue (#051c2c) with slightly lighter navy land.
    navy: {
        land: '#123653', water: '#051c2c', ice: '#1b4467', park: '#143b59', building: '#183f5e',
        road: '#1e4a6d', roadMinor: '#1a4262', border: '#3d6f96', state: '#24506f',
        countryText: '#9db8cf', cityText: '#e3edf5', townText: '#a9c0d3', halo: 'rgba(5,28,44,0.9)',
    },
    midnight: {
        land: '#1b1e3a', water: '#070818', ice: '#262a4d', park: '#1e2240', building: '#22264a',
        road: '#2b3058', roadMinor: '#252a4f', border: '#4a4f80', state: '#2f3460',
        countryText: '#a9add6', cityText: '#e4e6fa', townText: '#b1b4d8', halo: 'rgba(7,8,24,0.9)',
    },
    sand: {
        land: '#f3ebdd', water: '#c9d8d5', ice: '#fbf8f2', park: '#e6e2cc', building: '#e7dfd1',
        road: '#ffffff', roadMinor: '#f8f3ea', border: '#a08f78', state: '#cbbfae',
        countryText: '#6b5a45', cityText: '#3b3226', townText: '#6e604f', halo: 'rgba(250,246,238,0.92)',
    },
};

function buildStyle(theme, settings) {
    const p = PALETTES[theme] ?? PALETTES.light;
    const show = on => (on ? 'visible' : 'none');
    const borders = show(settings.showBorders);
    const countries = show(settings.showCountryNames);
    const cities = show(settings.showCityNames);
    const source = 'openmaptiles';
    const lines = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];
    const halo = { 'text-halo-color': p.halo, 'text-halo-width': 1.4, 'text-halo-blur': 0.4 };
    const adminLevel = ['all', ['==', ['typeof', ['get', 'admin_level']], 'number'], ['!=', ['get', 'maritime'], 1]];

    const place = (id, cls, minzoom, sizes, color, font = 'Noto Sans Regular') => ({
        id, type: 'symbol', source, 'source-layer': 'place', minzoom,
        filter: ['==', ['get', 'class'], cls],
        layout: {
            visibility: cities,
            'text-field': NAME,
            'text-font': [font],
            'text-size': ['interpolate', ['linear'], ['zoom'], ...sizes],
            'text-max-width': 8,
            'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        },
        paint: { 'text-color': color, ...halo },
    });

    return {
        version: 8,
        name: `atlas-${theme}`,
        glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
        sources: { [source]: { type: 'vector', url: `${OFM}/planet` } },
        layers: [
            { id: 'background', type: 'background', paint: { 'background-color': p.land } },
            {
                id: 'ice', type: 'fill', source, 'source-layer': 'landcover',
                filter: ['==', ['get', 'class'], 'ice'],
                paint: { 'fill-color': p.ice, 'fill-opacity': 0.7 },
            },
            {
                id: 'park', type: 'fill', source, 'source-layer': 'park', minzoom: 7,
                paint: { 'fill-color': p.park, 'fill-opacity': 0.6 },
            },
            {
                id: 'water', type: 'fill', source, 'source-layer': 'water',
                filter: ['!=', ['get', 'brunnel'], 'tunnel'],
                paint: { 'fill-color': p.water },
            },
            {
                id: 'waterway', type: 'line', source, 'source-layer': 'waterway', minzoom: 7,
                filter: ['!=', ['get', 'brunnel'], 'tunnel'],
                paint: { 'line-color': p.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 14, 2.5] },
            },
            {
                id: 'roads-minor', type: 'line', source, 'source-layer': 'transportation', minzoom: 10,
                filter: ['all', lines, ['match', ['get', 'class'], ['secondary', 'tertiary', 'minor'], true, false]],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': p.roadMinor, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 5] },
            },
            {
                id: 'roads-major', type: 'line', source, 'source-layer': 'transportation', minzoom: 5,
                filter: ['all', lines, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false]],
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': p.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 1.6, 16, 7] },
            },
            {
                id: 'buildings', type: 'fill', source, 'source-layer': 'building', minzoom: 13,
                paint: { 'fill-color': p.building, 'fill-opacity': 0.8 },
            },
            {
                id: 'border-state', type: 'line', source, 'source-layer': 'boundary', minzoom: 3,
                filter: ['all', adminLevel, ['>=', ['get', 'admin_level'], 3], ['<=', ['get', 'admin_level'], 4]],
                layout: { visibility: borders, 'line-join': 'round' },
                paint: {
                    'line-color': p.state,
                    'line-dasharray': [2, 2],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 10, 1.4],
                },
            },
            {
                id: 'border-disputed', type: 'line', source, 'source-layer': 'boundary',
                filter: ['all', adminLevel, ['==', ['get', 'admin_level'], 2], ['==', ['get', 'disputed'], 1]],
                layout: { visibility: borders, 'line-join': 'round' },
                paint: {
                    'line-color': p.border,
                    'line-dasharray': [3, 3],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 1.3, 10, 2],
                },
            },
            {
                id: 'border-country', type: 'line', source, 'source-layer': 'boundary',
                filter: ['all', adminLevel, ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'disputed'], 1]],
                layout: { visibility: borders, 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': p.border,
                    'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 1.4, 10, 2.2],
                },
            },
            place('label-village', 'village', 10, [10, 10, 15, 14], p.townText),
            place('label-town', 'town', 6, [6, 10, 12, 15], p.townText),
            place('label-city', 'city', 2, [2, 10, 6, 13, 12, 19], p.cityText),
            // Last so country names win label placement.
            {
                id: 'label-country', type: 'symbol', source, 'source-layer': 'place', maxzoom: 9,
                filter: ['==', ['get', 'class'], 'country'],
                layout: {
                    visibility: countries,
                    'text-field': NAME,
                    'text-font': ['Noto Sans Bold'],
                    'text-transform': 'uppercase',
                    'text-letter-spacing': 0.08,
                    'text-max-width': 7,
                    'text-size': ['interpolate', ['linear'], ['zoom'],
                        1, ['case', ['<=', ['coalesce', ['get', 'rank'], 9], 2], 10, 8],
                        6, ['case', ['<=', ['coalesce', ['get', 'rank'], 9], 2], 17, 13]],
                    'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
                },
                paint: { 'text-color': p.countryText, ...halo },
            },
        ],
    };
}

function canUseWebGL() {
    if (typeof maplibregl === 'undefined' || typeof L.maplibreGL !== 'function') return false;
    try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
        return false;
    }
}

// ---------- Raster fallback (Esri Canvas; only the label overlay can be toggled) ----------

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
const ESRI_ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';
const RASTER = {
    light: { base: 'World_Light_Gray_Base', labels: 'World_Light_Gray_Reference' },
    dark: { base: 'World_Dark_Gray_Base', labels: 'World_Dark_Gray_Reference' },
    emerald: { base: 'World_Dark_Gray_Base', labels: null },
    navy: { base: 'World_Dark_Gray_Base', labels: 'World_Dark_Gray_Reference' },
    midnight: { base: 'World_Dark_Gray_Base', labels: 'World_Dark_Gray_Reference' },
    sand: { base: 'World_Light_Gray_Base', labels: 'World_Light_Gray_Reference' },
};
const esriUrl = name => `${ESRI}/${name}/MapServer/tile/{z}/{y}/{x}`;

// ---------- Markers ----------

function makeIcon(m, extraClass) {
    const classes = ['km-marker'];
    if (m.animate) classes.push('km-animate');
    if (m.selected) classes.push('km-selected');
    if (extraClass) classes.push(extraClass);

    const inner = document.createElement('div');
    inner.className = 'km-inner';
    inner.style.setProperty('--km-hit', `${m.hit}px`);
    inner.style.setProperty('--km-ax', `${m.ax}px`);
    inner.style.setProperty('--km-ay', `${m.ay}px`);
    inner.style.setProperty('--km-hx', `${m.hx}px`);
    inner.style.setProperty('--km-hy', `${m.hy}px`);
    inner.style.setProperty('--km-color', m.color);

    const art = document.createElement('div');
    art.className = 'km-art';
    art.innerHTML = m.svg; // Generated by MarkerSvgRenderer (no user text).
    inner.appendChild(art);

    if (m.label) {
        const label = document.createElement('span');
        const pos = LABEL_POSITIONS.has(m.labelPos) ? m.labelPos : 'right';
        label.className = `km-label km-label-${pos}`;
        label.textContent = m.label;
        inner.appendChild(label);
    }

    return L.divIcon({
        className: classes.join(' '),
        html: inner,
        iconSize: [m.w, m.h],
        iconAnchor: [m.ax, m.ay],
    });
}

function iconKey(m) {
    return JSON.stringify([m.svg, m.animate, m.selected, m.label, m.labelPos, m.color]);
}

const tooltipOffset = m => [m.hx, m.hy - Math.max(m.hit, 8)];

export function createMap(element, dotnet, options) {
    const map = L.map(element, {
        worldCopyJump: true,
        minZoom: 2,
        maxZoom: 18,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 90,
        zoomControl: false,
        maxBounds: [[-85.05, -100000], [85.05, 100000]],
        maxBoundsViscosity: 1.0,
    }).setView(options?.center ?? [25, 10], options?.zoom ?? 2.5);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    let theme = THEMES.includes(options?.theme) ? options.theme : 'light';
    let settings = { ...DEFAULT_SETTINGS, ...(options?.settings ? JSON.parse(options.settings) : {}) };
    let glLayer = null;
    let raster = null; // { theme, base, labels }
    let pickMode = false;
    const markers = new Map(); // id -> { marker, key, data }
    let draft = null; // { marker, key }

    map.createPane('labels');
    map.getPane('labels').style.zIndex = 350;
    map.getPane('labels').style.pointerEvents = 'none';

    if (canUseWebGL()) {
        try {
            glLayer = L.maplibreGL({ style: buildStyle(theme, settings) }).addTo(map);
            glLayer.getMaplibreMap().on('error', e => console.warn('Basemap:', e?.error?.message ?? e));
        } catch (err) {
            console.warn('Vector basemap unavailable, using raster tiles.', err);
            try { glLayer?.remove(); } catch { /* half-initialised */ }
            glLayer = null;
        }
    }
    element.classList.toggle('atlas-raster', !glLayer);

    function applyBasemap() {
        for (const t of THEMES) element.classList.toggle(`theme-${t}`, t === theme);
        element.classList.toggle('atlas-hide-labels', !settings.showPlaceLabels);

        if (glLayer) {
            glLayer.getMaplibreMap().setStyle(buildStyle(theme, settings));
            return;
        }

        const config = RASTER[theme];
        const tileOptions = { maxNativeZoom: 16, maxZoom: 18 };
        if (raster?.theme !== theme) {
            raster?.base.remove();
            raster?.labels?.remove();
            raster = {
                theme,
                base: L.tileLayer(esriUrl(config.base), { ...tileOptions, attribution: ESRI_ATTRIBUTION }).addTo(map),
                labels: config.labels ? L.tileLayer(esriUrl(config.labels), { ...tileOptions, pane: 'labels' }) : null,
            };
        }
        if (raster.labels) {
            if (settings.showCityNames) raster.labels.addTo(map);
            else raster.labels.remove();
        }
    }

    function setTheme(next) {
        next = THEMES.includes(next) ? next : 'light';
        if (next === theme) return;
        theme = next;
        applyBasemap();
    }

    function setSettings(json) {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
        applyBasemap();
        applyMarkerScale();
    }

    // ---------- Marker size relative to the map ----------

    // 1 = the marker's designed pixel size. With `markerZoom` set, markers grow/shrink with the map.
    function markerScaleAt(zoom) {
        if (typeof settings.markerZoom !== 'number') return 1;
        return Math.min(MAX_MARKER_SCALE, Math.max(MIN_MARKER_SCALE, Math.pow(2, zoom - settings.markerZoom)));
    }

    function applyMarkerScale(zoom = map.getZoom()) {
        element.style.setProperty('--km-scale', String(markerScaleAt(zoom)));
    }

    map.on('zoomanim', e => applyMarkerScale(e.zoom));
    map.on('zoom', () => applyMarkerScale());
    applyMarkerScale();

    function setMarkers(json, fit) {
        const list = JSON.parse(json);
        const seen = new Set();
        for (const m of list) {
            seen.add(m.id);
            const key = iconKey(m);
            const existing = markers.get(m.id);
            if (existing) {
                existing.marker.setLatLng([m.lat, m.lng]);
                if (existing.key !== key) {
                    existing.marker.setIcon(makeIcon(m));
                    existing.key = key;
                }
                existing.marker.setZIndexOffset(m.selected ? 1000 : 0);
                const tooltip = existing.marker.getTooltip();
                tooltip.options.offset = tooltipOffset(m);
                existing.marker.setTooltipContent(tooltipContent(m.name));
                existing.data = m;
                continue;
            }

            const marker = L.marker([m.lat, m.lng], {
                icon: makeIcon(m),
                keyboard: true,
                title: '',
                riseOnHover: true,
                zIndexOffset: m.selected ? 1000 : 0,
            });
            marker.bindTooltip(tooltipContent(m.name), {
                direction: 'top',
                offset: tooltipOffset(m),
                className: 'km-tooltip',
            });
            marker.on('click', () => dotnet.invokeMethodAsync('OnMarkerClick', m.id));
            marker.addTo(map);
            markers.set(m.id, { marker, key, data: m });
        }

        for (const [id, entry] of markers) {
            if (!seen.has(id)) {
                entry.marker.remove();
                markers.delete(id);
            }
        }

        if (fit) fitToMarkers();
    }

    function setDraft(json) {
        const m = json ? JSON.parse(json) : null;
        if (!m) {
            if (draft) draft.marker.remove();
            draft = null;
            return;
        }

        const key = iconKey(m);
        if (draft) {
            const current = draft.marker.getLatLng();
            if (current.lat !== m.lat || current.lng !== m.lng) draft.marker.setLatLng([m.lat, m.lng]);
            if (draft.key !== key) {
                draft.marker.setIcon(makeIcon(m, 'km-draft'));
                draft.key = key;
            }
            return;
        }

        const marker = L.marker([m.lat, m.lng], {
            icon: makeIcon(m, 'km-draft'),
            draggable: true,
            autoPan: true,
            zIndexOffset: 2000,
        }).addTo(map);
        marker.on('dragend', () => {
            const ll = marker.getLatLng().wrap();
            dotnet.invokeMethodAsync('OnDraftMoved', ll.lat, ll.lng);
        });
        draft = { marker, key };
    }

    function setPickMode(on) {
        pickMode = !!on;
        element.classList.toggle('atlas-picking', pickMode);
    }

    function flyTo(lat, lng, zoom) {
        const target = zoom ?? Math.max(map.getZoom(), 5);
        // Shift so the point lands in the middle of the visible (unobstructed) part of the map.
        const { right, bottom } = obstruction();
        const point = map.project([lat, lng], target).add([right / 2, bottom / 2]);
        map.flyTo(map.unproject(point, target), target, { duration: 1.2 });
    }

    function fitToMarkers() {
        map.invalidateSize({ pan: false });
        const points = [...markers.values()].map(e => e.marker.getLatLng());
        if (points.length === 0) return;
        const { right, bottom } = obstruction();
        map.fitBounds(L.latLngBounds(points), {
            paddingTopLeft: [50, 50],
            paddingBottomRight: [50 + right, 50 + bottom],
            maxZoom: points.length === 1 ? 5 : 6,
        });
    }

    // How much of the map's right/bottom edge is covered by an overlay (e.g. the mobile bottom sheet).
    function obstruction() {
        const panel = options?.obstructionSelector ? document.querySelector(options.obstructionSelector) : null;
        if (!panel) return { right: 0, bottom: 0 };
        const m = element.getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        const overlapsX = p.left < m.right && p.right > m.left;
        const overlapsY = p.top < m.bottom && p.bottom > m.top;
        if (!overlapsX || !overlapsY) return { right: 0, bottom: 0 };
        const bottom = p.left <= m.left + 1 && p.top > m.top ? Math.max(0, m.bottom - p.top) : 0;
        const right = bottom === 0 && p.left > m.left ? Math.max(0, m.right - p.left) : 0;
        return { right, bottom };
    }

    function invalidateSize() {
        map.invalidateSize({ pan: false });
    }

    map.on('click', e => {
        if (!pickMode) return;
        const ll = e.latlng.wrap();
        dotnet.invokeMethodAsync('OnMapClick', ll.lat, ll.lng);
    });

    const resizeObserver = new ResizeObserver(() => invalidateSize());
    resizeObserver.observe(element);

    if (glLayer) {
        for (const t of THEMES) element.classList.toggle(`theme-${t}`, t === theme);
        element.classList.toggle('atlas-hide-labels', !settings.showPlaceLabels);
    } else {
        applyBasemap();
    }

    // ---------- PNG export ----------

    let exportFrame = null; // { el, aspect }

    // The part of the map not covered by the side panel / bottom sheet.
    function visibleArea() {
        const size = map.getSize();
        const { right, bottom } = obstruction();
        return { x: 0, y: 0, w: size.x - right, h: size.y - bottom };
    }

    // Largest rectangle with the export's aspect ratio that fits the visible map, with room for the controls.
    function frameRect(aspect) {
        const area = visibleArea();
        const margin = { top: 24, side: 24, bottom: 110 };
        const maxW = Math.max(80, area.w - margin.side * 2);
        const maxH = Math.max(40, area.h - margin.top - margin.bottom);
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
            h = maxH;
            w = h * aspect;
        }
        return {
            x: Math.round(area.x + (area.w - w) / 2),
            y: Math.round(margin.top + (maxH - h) / 2),
            w: Math.round(w),
            h: Math.round(h),
        };
    }

    function layoutFrame() {
        if (!exportFrame) return;
        const r = frameRect(exportFrame.aspect);
        Object.assign(exportFrame.el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
        exportFrame.rect = r;
    }

    function startExport(aspect) {
        if (!exportFrame) {
            const el = document.createElement('div');
            el.className = 'atlas-export-frame';
            element.appendChild(el);
            exportFrame = { el, aspect };
            // Let the map zoom out far enough to fit the whole world into a wide banner.
            map.setMinZoom(0);
            map.on('resize', layoutFrame);
        }
        exportFrame.aspect = aspect;
        layoutFrame();
    }

    function endExport() {
        if (!exportFrame) return;
        map.off('resize', layoutFrame);
        exportFrame.el.remove();
        exportFrame = null;
        map.setMinZoom(2);
        if (map.getZoom() < 2) map.setZoom(2);
    }

    // Fit every saved place inside the export frame.
    function fitToFrame() {
        const points = [...markers.values()].map(e => e.marker.getLatLng());
        if (!exportFrame || points.length === 0) return;
        const size = map.getSize();
        const r = exportFrame.rect;
        const pad = Math.min(60, r.w * 0.06, r.h * 0.12);
        map.fitBounds(L.latLngBounds(points), {
            paddingTopLeft: [r.x + pad, r.y + pad],
            paddingBottomRight: [size.x - r.x - r.w + pad, size.y - r.y - r.h + pad],
            maxZoom: 6,
            animate: true,
        });
    }

    // Renders exactly what is inside the export frame to a width×height PNG and downloads it.
    async function exportPng(width, height, fileName) {
        const r = exportFrame?.rect ?? { ...visibleArea() };
        const factor = width / r.w;
        const zoom = map.getZoom() + Math.log2(factor);
        const center = map.containerPointToLatLng([r.x + r.w / 2, r.y + r.h / 2]);
        // Markers keep their on-screen proportions to the map, just at the export's resolution.
        const markerScale = factor * markerScaleAt(map.getZoom());
        const palette = PALETTES[theme] ?? PALETTES.light;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = palette.water;
        ctx.fillRect(0, 0, width, height);

        let project;
        let warning = null;
        if (glLayer) {
            const rendered = await renderBasemap(width, height, center, zoom, buildStyle(theme, settings));
            ctx.drawImage(rendered.canvas, 0, 0, width, height);
            project = rendered.project;
            rendered.dispose();
        } else {
            warning = 'This browser could not draw the map tiles, so the image only shows your places.';
            // Plain Web Mercator maths, matching Leaflet's projection.
            const worldSize = 256 * Math.pow(2, zoom);
            const toPx = (lat, lng) => {
                const s = Math.sin(lat * Math.PI / 180);
                return {
                    x: (lng + 180) / 360 * worldSize,
                    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize,
                };
            };
            const c = toPx(center.lat, center.lng);
            project = (lat, lng) => {
                const p = toPx(lat, lng);
                return { x: p.x - c.x + width / 2, y: p.y - c.y + height / 2 };
            };
        }

        const list = [...markers.values()].map(e => e.data)
            .sort((a, b) => Number(a.selected) - Number(b.selected));
        const rootStyle = getComputedStyle(document.documentElement);
        const labelStyle = {
            text: rootStyle.getPropertyValue('--atlas-text').trim() || '#1d232b',
            bg: rootStyle.getPropertyValue('--atlas-panel-solid').trim() || '#ffffff',
            font: getComputedStyle(element).fontFamily || 'sans-serif',
        };

        for (const m of list) {
            const p = nearestCopy(project, m.lat, m.lng, center.lng);
            await drawMarker(ctx, m, p, markerScale);
        }
        if (settings.showPlaceLabels) {
            for (const m of list) {
                if (!m.label) continue;
                const p = nearestCopy(project, m.lat, m.lng, center.lng);
                drawLabel(ctx, m, p, markerScale, factor, labelStyle);
            }
        }
        drawAttribution(ctx, width, height, factor, glLayer ? '© OpenStreetMap contributors · OpenFreeMap' : '© Esri, OpenStreetMap contributors', palette);

        const blob = await new Promise((resolve, reject) =>
            canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The browser could not create the image.'))), 'image/png'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'katrinas-atlas.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return warning;
    }

    // Draws a marker's SVG at the export scale, with its glow (and the pale-theme outline) via canvas filters.
    async function drawMarker(ctx, m, p, scale) {
        const shadows = [];
        let svg = m.svg.replace(/filter:([^;"]*);/, (_, f) => {
            for (const match of f.matchAll(/drop-shadow\(0 0 ([\d.]+)px (#[0-9a-fA-F]{6})\)/g)) {
                shadows.push(`drop-shadow(0 0 ${(parseFloat(match[1]) * scale).toFixed(2)}px ${match[2]})`);
            }
            return '';
        });
        if (PALE_THEMES.has(theme)) {
            shadows.push(`drop-shadow(0 0 ${(0.6 * scale).toFixed(2)}px rgba(20,28,40,0.75))`);
            shadows.push(`drop-shadow(0 ${(1 * scale).toFixed(2)}px ${(2 * scale).toFixed(2)}px rgba(20,28,40,0.35))`);
        }
        const w = m.w * scale;
        const h = m.h * scale;
        svg = svg.replace(/width="[^"]*" height="[^"]*"/, `width="${w.toFixed(2)}" height="${h.toFixed(2)}"`);
        // Pad the image so glows aren't clipped at its edges.
        const glowPad = Math.ceil(Math.max(m.w, m.h) * scale * 0.5);

        const img = await loadSvg(svg);
        const buffer = document.createElement('canvas');
        buffer.width = Math.ceil(w + glowPad * 2);
        buffer.height = Math.ceil(h + glowPad * 2);
        const bctx = buffer.getContext('2d');
        bctx.filter = shadows.length ? shadows.join(' ') : 'none';
        bctx.drawImage(img, glowPad, glowPad, w, h);
        ctx.drawImage(buffer, p.x - m.ax * scale - glowPad, p.y - m.ay * scale - glowPad);
    }

    function drawLabel(ctx, m, p, markerScale, factor, style) {
        const fontSize = 12.5 * factor;
        const padX = 8 * factor;
        const height = fontSize * 1.25 + 4 * factor;
        ctx.save();
        ctx.font = `600 ${fontSize}px ${style.font}`;
        let text = m.label;
        const maxText = 240 * factor - padX * 2;
        if (ctx.measureText(text).width > maxText) {
            while (text.length > 1 && ctx.measureText(`${text}…`).width > maxText) text = text.slice(0, -1);
            text = `${text}…`;
        }
        const width = ctx.measureText(text).width + padX * 2;
        const cx = p.x + m.hx * markerScale;
        const cy = p.y + m.hy * markerScale;
        const gap = m.hit * markerScale + 6 * factor;
        const pos = LABEL_POSITIONS.has(m.labelPos) ? m.labelPos : 'right';
        let x = cx + gap;
        let y = cy - height / 2;
        if (pos === 'left') x = cx - gap - width;
        if (pos === 'above') { x = cx - width / 2; y = cy - gap - height; }
        if (pos === 'below') { x = cx - width / 2; y = cy + gap; }

        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = 8 * factor;
        ctx.shadowOffsetY = 2 * factor;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, height / 2);
        ctx.globalAlpha = 0.86;
        ctx.fillStyle = style.bg;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 1 * factor;
        ctx.strokeStyle = `${m.color}99`;
        ctx.stroke();
        ctx.fillStyle = style.text;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + padX, y + height / 2 + fontSize * 0.04);
        ctx.restore();
    }

    function drawAttribution(ctx, width, height, factor, text, palette) {
        ctx.save();
        const size = Math.max(9, 9 * Math.min(factor, 2));
        ctx.font = `${size}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = palette.countryText;
        ctx.globalAlpha = 0.55;
        ctx.fillText(text, width - size * 0.6, height - size * 0.4);
        ctx.restore();
    }

    return {
        getZoom: () => map.getZoom(),
        startExport,
        endExport,
        fitToFrame,
        exportPng,
        setTheme,
        setSettings,
        setMarkers,
        setDraft,
        setPickMode,
        flyTo,
        fitToMarkers,
        invalidateSize,
        dispose() {
            endExport();
            resizeObserver.disconnect();
            map.remove();
            markers.clear();
        },
    };
}

function tooltipContent(name) {
    const span = document.createElement('span');
    span.textContent = name;
    return span;
}

// Picks the copy of a point (lng ± 360°) closest to the view centre, so places near the date line still show.
function nearestCopy(project, lat, lng, centerLng) {
    const shift = Math.round((centerLng - lng) / 360) * 360;
    return project(lat, lng + shift);
}

function loadSvg(svg) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not draw a marker.'));
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
}

// Draws the vector basemap off-screen at exactly width×height pixels.
function renderBasemap(width, height, center, leafletZoom, style) {
    return new Promise((resolve, reject) => {
        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'fixed', left: '-100000px', top: '0', width: `${width}px`, height: `${height}px`,
            pointerEvents: 'none',
        });
        document.body.appendChild(container);

        let glMap;
        const dispose = () => {
            try { glMap?.remove(); } catch { /* already gone */ }
            container.remove();
        };
        try {
            glMap = new maplibregl.Map({
                container,
                style,
                center: [center.lng, center.lat],
                // MapLibre uses 512px tiles, Leaflet 256px.
                zoom: leafletZoom - 1,
                interactive: false,
                attributionControl: false,
                preserveDrawingBuffer: true,
                pixelRatio: 1,
                fadeDuration: 0,
                renderWorldCopies: true,
                maxCanvasSize: [8192, 8192],
            });
        } catch (err) {
            dispose();
            reject(err);
            return;
        }

        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({
                canvas: glMap.getCanvas(),
                project: (lat, lng) => glMap.project([lng, lat]),
                dispose,
            });
        };
        // Tiles normally load in a second or two; don't hang forever on a slow connection.
        const timer = setTimeout(finish, 30000);
        glMap.once('idle', finish);
        glMap.on('error', e => console.warn('Export basemap:', e?.error?.message ?? e));
    });
}
