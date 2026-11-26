// Small browser helpers for the atlas UI.

const THEME_KEY = 'katrina-atlas.theme';

export function getTheme() {
    return document.documentElement.dataset.theme || 'light';
}

export function setTheme(theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.bsTheme = theme === 'light' || theme === 'sand' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable */ }
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
