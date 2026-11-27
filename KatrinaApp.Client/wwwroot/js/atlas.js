// Small browser helpers for the atlas UI.

const THEME_KEY = 'katrina-atlas.theme';
// Inline CSS variables for the custom theme, re-applied by index.html before first paint.
const CUSTOM_VARS_KEY = 'katrina-atlas.custom-theme-vars';

export const DEFAULT_CUSTOM_SEA = '#0a2f4f';
export const DEFAULT_CUSTOM_LAND = '#1f5784';

// ---------- Colour helpers (also used by worldMap.js) ----------

export function parseHex(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = rgb => `#${rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

// Blends colour a towards b by t (0-1).
export function mix(a, b, t) {
    const x = parseHex(a) ?? [0, 0, 0];
    const y = parseHex(b) ?? [0, 0, 0];
    return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

export function rgba(hex, alpha) {
    const c = parseHex(hex) ?? [0, 0, 0];
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

// Relative luminance, 0 (black) to 1 (white).
export function luminance(hex) {
    const c = (parseHex(hex) ?? [0, 0, 0]).map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function customColors(sea, land) {
    return {
        sea: parseHex(sea) ? sea : DEFAULT_CUSTOM_SEA,
        land: parseHex(land) ? land : DEFAULT_CUSTOM_LAND,
    };
}

// Panel / page colours that suit a custom sea and land colour.
function customThemeVars(sea, land) {
    const dark = luminance(sea) < 0.35;
    if (dark) {
        const panel = mix(sea, '#000000', 0.35);
        const accent = mix(land, '#ffffff', 0.5);
        return {
            bs: 'dark',
            vars: {
                '--atlas-bg': mix(sea, '#000000', 0.55),
                '--atlas-map-bg': sea,
                '--atlas-panel': rgba(panel, 0.9),
                '--atlas-panel-solid': panel,
                '--atlas-text': '#eef1f4',
                '--atlas-muted': mix(sea, '#ffffff', 0.6),
                '--atlas-border': 'rgba(255,255,255,0.1)',
                '--atlas-card': 'rgba(255,255,255,0.05)',
                '--atlas-card-hover': 'rgba(255,255,255,0.09)',
                '--atlas-accent': accent,
                '--atlas-accent-soft': rgba(accent, 0.16),
                '--atlas-accent-contrast': mix(sea, '#000000', 0.5),
                '--atlas-danger': '#ff7b7b',
                '--atlas-stage': `radial-gradient(circle at 50% 45%, ${mix(sea, '#ffffff', 0.15)} 0%, ${mix(sea, '#000000', 0.5)} 75%)`,
                '--atlas-shadow': '0 10px 30px rgba(0, 0, 0, 0.45)',
            },
        };
    }
    const accent = luminance(land) > 0.3 ? mix(land, '#000000', 0.55) : land;
    return {
        bs: 'light',
        vars: {
            '--atlas-bg': mix(sea, '#ffffff', 0.6),
            '--atlas-map-bg': sea,
            '--atlas-panel': 'rgba(255,255,255,0.9)',
            '--atlas-panel-solid': '#ffffff',
            '--atlas-text': '#1d232b',
            '--atlas-muted': '#6b7480',
            '--atlas-border': 'rgba(20,30,40,0.1)',
            '--atlas-card': 'rgba(20,30,40,0.04)',
            '--atlas-card-hover': 'rgba(20,30,40,0.08)',
            '--atlas-accent': accent,
            '--atlas-accent-soft': rgba(accent, 0.14),
            '--atlas-accent-contrast': '#ffffff',
            '--atlas-danger': '#d64545',
            '--atlas-stage': 'radial-gradient(circle at 50% 45%, #3a4654 0%, #1c232b 75%)',
            '--atlas-shadow': '0 10px 30px rgba(20, 30, 40, 0.15)',
        },
    };
}

// Every variable the custom theme sets (index.html may have set them before the app started).
const CUSTOM_VAR_NAMES = Object.keys(customThemeVars('#000000', '#000000').vars);

export function getTheme() {
    return document.documentElement.dataset.theme || 'light';
}

// sea / land are only used by the 'custom' theme.
export function setTheme(theme, sea, land) {
    const root = document.documentElement;
    for (const name of CUSTOM_VAR_NAMES) root.style.removeProperty(name);
    root.dataset.theme = theme;
    let bs = theme === 'light' || theme === 'sand' ? 'light' : 'dark';
    let stored = null;
    if (theme === 'custom') {
        const c = customColors(sea, land);
        const t = customThemeVars(c.sea, c.land);
        for (const [name, value] of Object.entries(t.vars)) root.style.setProperty(name, value);
        bs = t.bs;
        stored = JSON.stringify(t);
    }
    root.dataset.bsTheme = bs;
    try {
        localStorage.setItem(THEME_KEY, theme);
        if (stored) localStorage.setItem(CUSTOM_VARS_KEY, stored);
    } catch { /* storage unavailable */ }
}

export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject(new Error('Location is not supported by this browser.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            err => reject(new Error(
                err.code === err.PERMISSION_DENIED ? 'Location permission was denied.'
                    : err.code === err.TIMEOUT ? 'Timed out getting your location.'
                        : 'Could not get your location.')),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    });
}

export function scrollIntoView(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function capturePointer(element, pointerId) {
    try { element.setPointerCapture(pointerId); } catch { /* pointer already gone */ }
}

export function elementWidth(element) {
    return element.getBoundingClientRect().width;
}

// Saves text as a file in the browser's downloads.
export function downloadText(fileName, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function promptText(message, value) {
    return window.prompt(message, value ?? '');
}

export function getQueryParam(name) {
    return new URLSearchParams(location.search).get(name);
}

// Puts ?map=<id> in the address bar (without reloading) so the tab can be bookmarked or reloaded on this map.
export function setQueryParam(name, value) {
    const url = new URL(location.href);
    url.searchParams.set(name, value);
    history.replaceState(history.state, '', url);
}

export function openWithQueryParam(name, value) {
    const url = new URL(location.href);
    url.searchParams.set(name, value);
    window.open(url.toString(), '_blank', 'noopener');
}

// Tells .NET when another tab changes saved data, so this tab can stay in sync.
export function watchStorage(dotnet) {
    const handler = e => { if (e.key) dotnet.invokeMethodAsync('OnStorageChanged', e.key); };
    window.addEventListener('storage', handler);
    return { dispose: () => window.removeEventListener('storage', handler) };
}
