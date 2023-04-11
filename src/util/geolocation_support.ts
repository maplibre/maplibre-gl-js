let supportsGeolocation;

export function checkGeolocationSupport(callback: (supported: boolean) => void, forceRecalculation = false): void {
    if (supportsGeolocation !== undefined && !forceRecalculation) {
        callback(supportsGeolocation);
    } else if (window.navigator.permissions !== undefined) {
        // navigator.permissions has incomplete browser support
        // http://caniuse.com/#feat=permissions-api
        // Test for the case where a browser disables Geolocation because of an
        // insecure origin
        window.navigator.permissions.query({name: 'geolocation'}).then((p) => {
            supportsGeolocation = p.state !== 'denied';
            callback(supportsGeolocation);
        }).catch(() => {
            // Fix for iOS16 which rejects query but still supports geolocation
            supportsGeolocation = !!window.navigator.geolocation;
            callback(supportsGeolocation);
        });

    } else {
        supportsGeolocation = !!window.navigator.geolocation;
        callback(supportsGeolocation);
    }
}
