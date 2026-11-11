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
