import geolocation from 'mock-geolocation';
import {createMap, setWebGlContext, setPerformance, setMatchMedia} from '../../util/test/util';
import GeolocateControl from './geolocate_control';

geolocation.use();
let map;

// convert the coordinates of a LngLat object to a fixed number of digits
function lngLatAsFixed(lngLat, digits) {
    return Object.keys(lngLat).reduce((previous, current) => {
        previous[current] = lngLat[current].toFixed(digits);
        return previous;
    }, {});
}

beforeEach(() => {
    setWebGlContext();
    setPerformance();
    setMatchMedia();
    map = createMap(undefined, undefined);
});

afterEach(() => {
    map.remove();
});

describe('GeolocateControl with no options', () => {
    test('error event', done => {
        const geolocate = new GeolocateControl(undefined);
        map.addControl(geolocate);

        const click = new window.Event('click');

        geolocate.on('error', (error) => {
            expect(error.code).toBe(2);
            expect(error.message).toBe('error message');
            done();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.sendError({code: 2, message: 'error message'});
    });

    test('outofmaxbounds event in active lock state', done => {
        const geolocate = new GeolocateControl(undefined);
        map.addControl(geolocate);
        map.setMaxBounds([[0, 0], [10, 10]]);
        geolocate._watchState = 'ACTIVE_LOCK';

        const click = new window.Event('click');

        geolocate.on('outofmaxbounds', (position) => {
            expect(geolocate._watchState).toBe('ACTIVE_ERROR');
            expect(position.coords.latitude).toBe(10);
            expect(position.coords.longitude).toBe(20);
            expect(position.coords.accuracy).toBe(3);
            expect(position.timestamp).toBe(4);
            done();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 3, timestamp: 4});
    });

    test('outofmaxbounds event in background state', done => {
        const geolocate = new GeolocateControl(undefined);
        map.addControl(geolocate);
        map.setMaxBounds([[0, 0], [10, 10]]);
        geolocate._watchState = 'BACKGROUND';

        const click = new window.Event('click');

        geolocate.on('outofmaxbounds', (position) => {
            expect(geolocate._watchState).toBe('BACKGROUND_ERROR');
            expect(position.coords.latitude).toBe(10);
            expect(position.coords.longitude).toBe(20);
            expect(position.coords.accuracy).toBe(3);
            expect(position.timestamp).toBe(4);
            done();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 3, timestamp: 4});
    });

    test('geolocate event', done => {
        const geolocate = new GeolocateControl(undefined);
        map.addControl(geolocate);

        const click = new window.Event('click');

        geolocate.on('geolocate', (position) => {
            expect(position.coords.latitude).toBe(10);
            expect(position.coords.longitude).toBe(20);
            expect(position.coords.accuracy).toBe(30);
            expect(position.timestamp).toBe(40);
            done();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });

    test('trigger', () => {
        const geolocate = new GeolocateControl(undefined);
        map.addControl(geolocate);

        expect(geolocate.trigger()).toBeTruthy();
    });

    test('trigger before added to map', () => {
        jest.spyOn(console, 'warn').mockImplementation(() => { });

        const geolocate = new GeolocateControl(undefined);

        expect(geolocate.trigger()).toBeFalsy();
        expect(console.warn).toHaveBeenCalledWith('Geolocate control triggered before added to a map');
    });

    test('geolocate fitBoundsOptions', done => {
        const geolocate = new GeolocateControl({
            fitBoundsOptions: {
                duration: 0,
                maxZoom: 10
            }
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        map.once('moveend', () => {
            expect(map.getZoom()).toBe(10);
            done();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 1});
    });

    test('with removed before Geolocation callback', () => {
        expect(() => {
            const geolocate = new GeolocateControl(undefined);
            map.addControl(geolocate);
            geolocate.trigger();
            map.removeControl(geolocate);
        }).not.toThrow();
    });

    test('non-zero bearing', done => {
        map.setBearing(45);
        const geolocate = new GeolocateControl({
            fitBoundsOptions: {
                duration: 0,
                maxZoom: 10
            }
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        map.once('moveend', () => {
            expect(lngLatAsFixed(map.getCenter(), 4)).toEqual({'lat': '10.0000', 'lng': '20.0000'});
            expect(map.getBearing()).toBe(45);
            expect(map.getZoom()).toBe(10);
            done();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 1});
    });

    test('no watching map camera on geolocation', done => {
        const geolocate = new GeolocateControl({
            fitBoundsOptions: {
                maxZoom: 20,
                duration: 0
            }
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        map.once('moveend', () => {
            expect(lngLatAsFixed(map.getCenter(), 4)).toEqual({'lat': '10.0000', 'lng': '20.0000'});

            const mapBounds = map.getBounds();

            // map bounds should contain or equal accuracy bounds, that is the ensure accuracy bounds doesn't fall outside the map bounds
            const accuracyBounds = map.getCenter().toBounds(1000);
            expect(accuracyBounds.getNorth().toFixed(4) <= mapBounds.getNorth().toFixed(4)).toBeTruthy();
            expect(accuracyBounds.getSouth().toFixed(4) >= mapBounds.getSouth().toFixed(4)).toBeTruthy();
            expect(accuracyBounds.getEast().toFixed(4) <= mapBounds.getEast().toFixed(4)).toBeTruthy();
            expect(accuracyBounds.getWest().toFixed(4) >= mapBounds.getWest().toFixed(4)).toBeTruthy();

            // map bounds should not be too much bigger on all edges of the accuracy bounds (this test will only work for an orthogonal bearing),
            // ensures map bounds does not contain buffered accuracy bounds, as if it does there is too much gap around the accuracy bounds
            const bufferedAccuracyBounds = map.getCenter().toBounds(1100);
            expect(
                (bufferedAccuracyBounds.getNorth().toFixed(4) < mapBounds.getNorth().toFixed(4)) &&
                (bufferedAccuracyBounds.getSouth().toFixed(4) > mapBounds.getSouth().toFixed(4)) &&
                (bufferedAccuracyBounds.getEast().toFixed(4) < mapBounds.getEast().toFixed(4)) &&
                (bufferedAccuracyBounds.getWest().toFixed(4) > mapBounds.getWest().toFixed(4))
            ).toBeFalsy();
            done();
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 1000});
    });

    test('watching map updates recenter on location with dot', done => {
        const geolocate = new GeolocateControl({
            trackUserLocation: true,
            showUserLocation: true,
            fitBoundsOptions: {
                duration: 0
            }
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        let moveendCount = 0;
        map.once('moveend', () => {
            // moveend was being called a second time, this ensures that we don't run the tests a second time
            if (moveendCount > 0) return;
            moveendCount++;

            expect(lngLatAsFixed(map.getCenter(), 4)).toEqual({'lat': '10.0000', 'lng': '20.0000'});
            expect(geolocate._userLocationDotMarker._map).toBeTruthy();
            expect(
                geolocate._userLocationDotMarker._element.classList.contains('maplibregl-user-location-dot-stale')
            ).toBeFalsy();
            map.once('moveend', () => {
                expect(lngLatAsFixed(map.getCenter(), 4)).toEqual({'lat': '40.0000', 'lng': '50.0000'});
                geolocate.once('error', () => {
                    expect(geolocate._userLocationDotMarker._map).toBeTruthy();
                    expect(
                        geolocate._userLocationDotMarker._element.classList.contains('maplibregl-user-location-dot-stale')
                    ).toBeTruthy();
                    done();
                });
                geolocation.changeError({code: 2, message: 'position unavaliable'});
            });
            geolocation.change({latitude: 40, longitude: 50, accuracy: 60});
        });
        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });

    test('watching map background event', done => {
        const geolocate = new GeolocateControl({
            trackUserLocation: true,
            fitBoundsOptions: {
                duration: 0
            }
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        let moveendCount = 0;
        map.once('moveend', () => {
            // moveend was being called a second time, this ensures that we don't run the tests a second time
            if (moveendCount > 0) return;
            moveendCount++;

            geolocate.once('trackuserlocationend', () => {
                expect(map.getCenter()).toEqual({lng: 10, lat: 5});
                done();
            });

            // manually pan the map away from the geolocation position which should trigger the 'trackuserlocationend' event above
            map.jumpTo({
                center: [10, 5]
            });
        });
        // click the button to activate it into the enabled watch state
        geolocate._geolocateButton.dispatchEvent(click);
        // send through a location update which should reposition the map and trigger the 'moveend' event above
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });

    test('watching map background state', done => {
        const geolocate = new GeolocateControl({
            trackUserLocation: true,
            fitBoundsOptions: {
                duration: 0
            }
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        let moveendCount = 0;
        map.once('moveend', () => {
            // moveend was being called a second time, this ensures that we don't run the tests a second time
            if (moveendCount > 0) return;
            moveendCount++;

            map.once('moveend', () => {
                geolocate.once('geolocate', () => {
                    expect(map.getCenter()).toEqual({lng: 10, lat: 5});
                    done();
                });
                //  update the geolocation position, since we are in background state when 'geolocate' is triggered above, the camera shouldn't have changed
                geolocation.change({latitude: 0, longitude: 0, accuracy: 10});
            });

            // manually pan the map away from the geolocation position which should trigger the 'moveend' event above
            map.jumpTo({
                center: [10, 5]
            });
        });
        // click the button to activate it into the enabled watch state
        geolocate._geolocateButton.dispatchEvent(click);
        // send through a location update which should reposition the map and trigger the 'moveend' event above
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30});
    });

    test('trackuserlocationstart event', done => {
        const geolocate = new GeolocateControl({
            trackUserLocation: true,
            fitBoundsOptions: {
                duration: 0
            }
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        geolocate.once('trackuserlocationstart', () => {
            expect(map.getCenter()).toEqual({lng: 0, lat: 0});
            done();
        });

        geolocate._geolocateButton.dispatchEvent(click);
    });

    test('does not switch to BACKGROUND and stays in ACTIVE_LOCK state on window resize', done => {
        const geolocate = new GeolocateControl({
            trackUserLocation: true,
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            expect(geolocate._watchState).toBe('ACTIVE_LOCK');
            window.dispatchEvent(new window.Event('resize'));
            expect(geolocate._watchState).toBe('ACTIVE_LOCK');
            done();
        });

        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });

    test('switches to BACKGROUND state on map manipulation', done => {
        const geolocate = new GeolocateControl({
            trackUserLocation: true,
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            expect(geolocate._watchState).toBe('ACTIVE_LOCK');
            map.jumpTo({
                center: [0, 0]
            });
            expect(geolocate._watchState).toBe('BACKGROUND');
            done();
        });

        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 30, timestamp: 40});
    });

    test('accuracy circle not shown if showAccuracyCircle = false', done => {
        const geolocate = new GeolocateControl({
            trackUserLocation: true,
            showUserLocation: true,
            showAccuracyCircle: false,
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            map.jumpTo({
                center: [10, 20]
            });
            map.once('zoomend', () => {
                expect(!geolocate._circleElement.style.width).toBeTruthy();
                done();
            });
            map.zoomTo(10, {duration: 0});
        });

        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 700});
    });

    test('accuracy circle radius matches reported accuracy', done => {
        const geolocate = new GeolocateControl({
            trackUserLocation: true,
            showUserLocation: true,
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            expect(geolocate._accuracyCircleMarker._map).toBeTruthy();
            expect(geolocate._accuracy).toBe(700);
            map.jumpTo({
                center: [10, 20]
            });
            map.once('zoomend', () => {
                expect(geolocate._circleElement.style.width).toBe('20px'); // 700m = 20px at zoom 10
                map.once('zoomend', () => {
                    expect(geolocate._circleElement.style.width).toBe('79px'); // 700m = 79px at zoom 12
                    done();
                });
                map.zoomTo(12, {duration: 0});
            });
            map.zoomTo(10, {duration: 0});
        });

        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 700});
    });

    test('shown even if trackUserLocation = false', done => {
        const geolocate = new GeolocateControl({
            trackUserLocation: false,
            showUserLocation: true,
            showAccuracyCircle: true,
        });
        map.addControl(geolocate);

        const click = new window.Event('click');

        geolocate.once('geolocate', () => {
            map.jumpTo({
                center: [10, 20]
            });
            map.once('zoomend', () => {
                expect(geolocate._circleElement.style.width).toBeTruthy();
                done();
            });
            map.zoomTo(10, {duration: 0});
        });

        geolocate._geolocateButton.dispatchEvent(click);
        geolocation.send({latitude: 10, longitude: 20, accuracy: 700});
    });
});
