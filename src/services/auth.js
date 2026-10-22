const AUTH_STORAGE_KEY = 'thandalAuth';

export function getAuthSession() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    } catch {
        return null;
    }
}

export function hasAuthToken() {
    const session = getAuthSession();
    return typeof session?.token === 'string' && session.token.length > 0;
}

export function saveAuthSession(session) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    localStorage.removeItem('thandalMobile');
}

export function clearAuthSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('thandalMobile');
}
