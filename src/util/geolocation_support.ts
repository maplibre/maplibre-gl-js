let supportsGeolocation;

export async function checkGeolocationSupport(forceRecalculation = false): Promise<boolean> {
    if (supportsGeolocation !== undefined && !forceRecalculation) {
        return supportsGeolocation;
    }
    if (window.navigator.permissions === undefined) {
        supportsGeolocation = !!window.navigator.geolocation;
        return supportsGeolocation;
    }
    // navigator.permissions has incomplete browser support
    // https://caniuse.com/#feat=permissions-api
    // Test for the case where a browser disables Geolocation because of an
    // insecure origin
    try {
        const permissions = await window.navigator.permissions.query({name: 'geolocation'});
        supportsGeolocation = permissions.state !== 'denied'; // eslint-disable-line require-atomic-updates
    } catch {
        // Fix for iOS16 which rejects query but still supports geolocation
        supportsGeolocation = !!window.navigator.geolocation; // eslint-disable-line require-atomic-updates
    }
    return supportsGeolocation;
}
