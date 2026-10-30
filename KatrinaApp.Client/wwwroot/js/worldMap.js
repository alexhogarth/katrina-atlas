// Leaflet-backed world map used by the WorldMap Blazor component.
// Requires the global `L` (wwwroot/lib/leaflet) and, for the vector basemap, `maplibregl` plus the
// Leaflet bridge `L.maplibreGL` (wwwroot/lib/maplibre). Without WebGL it falls back to raster tiles.

const THEMES = ['light', 'dark', 'emerald'];
const LABEL_POSITIONS = new Set(['right', 'left', 'above', 'below']);
const DEFAULT_SETTINGS = { showBorders: true, showCountryNames: true, showCityNames: true, showPlaceLabels: true };

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
    }

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

    return {
        setTheme,
        setSettings,
        setMarkers,
        setDraft,
        setPickMode,
        flyTo,
        fitToMarkers,
        invalidateSize,
        dispose() {
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
