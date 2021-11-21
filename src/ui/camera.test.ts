import '../../stub_loader';
import {test} from '../../util/test';
import Camera from '../../../rollup/build/tsc/src/ui/camera';
import Transform from '../../../rollup/build/tsc/src/geo/transform';
import TaskQueue from '../../../rollup/build/tsc/src/util/task_queue';
import browser from '../../../rollup/build/tsc/src/util/browser';
import {fixedLngLat, fixedNum} from '../../util/fixed';
import {equalWithPrecision} from '../../util';

test('camera', (t) => {
    function attachSimulateFrame(camera) {
        const queue = new TaskQueue();
        camera._requestRenderFrame = (cb) => queue.add(cb);
        camera._cancelRenderFrame = (id) => queue.remove(id);
        camera.simulateFrame = () => queue.run();
        return camera;
    }

    function createCamera(options) {
        options = options || {};

        const transform = new Transform(0, 20, 0, 60, options.renderWorldCopies);
        transform.resize(512, 512);

        const camera = attachSimulateFrame(new Camera(transform, {}))
            .jumpTo(options);

        camera._update = () => {};

        return camera;
    }

    function assertTransitionTime(test, camera, min, max) {
        let startTime;
        camera
            .on('movestart', () => { startTime = new Date(); })
            .on('moveend', () => {
                const endTime = new Date();
                const timeDiff = endTime - startTime;
                test.ok(timeDiff >= min && timeDiff < max, `Camera transition time exceeded expected range( [${min},${max}) ) :${timeDiff}`);
                test.end();
            });
    }

    t.test('#jumpTo', (t) => {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        const camera = createCamera({zoom: 1});

        t.test('sets center', (t) => {
            camera.jumpTo({center: [1, 2]});
            expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            expect(() => {
                camera.jumpTo({center: 1});
            }).toThrowError(Error);
            t.end();
        });

        t.test('keeps current center if not specified', (t) => {
            camera.jumpTo({});
            expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
            t.end();
        });

        t.test('sets zoom', (t) => {
            camera.jumpTo({zoom: 3});
            expect(camera.getZoom()).toEqual(3);
            t.end();
        });

        t.test('keeps current zoom if not specified', (t) => {
            camera.jumpTo({});
            expect(camera.getZoom()).toEqual(3);
            t.end();
        });

        t.test('sets bearing', (t) => {
            camera.jumpTo({bearing: 4});
            expect(camera.getBearing()).toEqual(4);
            t.end();
        });

        t.test('keeps current bearing if not specified', (t) => {
            camera.jumpTo({});
            expect(camera.getBearing()).toEqual(4);
            t.end();
        });

        t.test('sets pitch', (t) => {
            camera.jumpTo({pitch: 45});
            expect(camera.getPitch()).toEqual(45);
            t.end();
        });

        t.test('keeps current pitch if not specified', (t) => {
            camera.jumpTo({});
            expect(camera.getPitch()).toEqual(45);
            t.end();
        });

        t.test('sets multiple properties', (t) => {
            camera.jumpTo({
                center: [10, 20],
                zoom: 10,
                bearing: 180,
                pitch: 60
            });
            expect(camera.getCenter()).toEqual({lng: 10, lat: 20});
            expect(camera.getZoom()).toEqual(10);
            expect(camera.getBearing()).toEqual(180);
            expect(camera.getPitch()).toEqual(60);
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            camera.jumpTo({center: [1, 2]}, eventData);
            expect(started).toBe('ok');
            expect(moved).toBe('ok');
            expect(ended).toBe('ok');
            t.end();
        });

        t.test('emits zoom events, preserving eventData', (t) => {
            let started, zoomed, ended;
            const eventData = {data: 'ok'};

            camera
                .on('zoomstart', (d) => { started = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { ended = d.data; });

            camera.jumpTo({zoom: 3}, eventData);
            expect(started).toBe('ok');
            expect(zoomed).toBe('ok');
            expect(ended).toBe('ok');
            t.end();
        });

        t.test('emits rotate events, preserving eventData', (t) => {
            let started, rotated, ended;
            const eventData = {data: 'ok'};

            camera
                .on('rotatestart', (d) => { started = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { ended = d.data; });

            camera.jumpTo({bearing: 90}, eventData);
            expect(started).toBe('ok');
            expect(rotated).toBe('ok');
            expect(ended).toBe('ok');
            t.end();
        });

        t.test('emits pitch events, preserving eventData', (t) => {
            let started, pitched, ended;
            const eventData = {data: 'ok'};

            camera
                .on('pitchstart', (d) => { started = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => { ended = d.data; });

            camera.jumpTo({pitch: 10}, eventData);
            expect(started).toBe('ok');
            expect(pitched).toBe('ok');
            expect(ended).toBe('ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            expect(camera.isEasing()).toBeTruthy();
            camera.jumpTo({center: [1, 2]});
            expect(!camera.isEasing()).toBeTruthy();
            t.end();
        });

        t.end();
    });

    t.test('#setCenter', (t) => {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        const camera = createCamera({zoom: 1});

        t.test('sets center', (t) => {
            camera.setCenter([1, 2]);
            expect(camera.getCenter()).toEqual({lng: 1, lat: 2});
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            expect(() => {
                camera.jumpTo({center: 1});
            }).toThrowError(Error);
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera.on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            camera.setCenter([10, 20], eventData);
            expect(started).toBe('ok');
            expect(moved).toBe('ok');
            expect(ended).toBe('ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            expect(camera.isEasing()).toBeTruthy();
            camera.setCenter([1, 2]);
            expect(!camera.isEasing()).toBeTruthy();
            t.end();
        });

        t.end();
    });

    t.test('#setZoom', (t) => {
        const camera = createCamera();

        t.test('sets zoom', (t) => {
            camera.setZoom(3);
            expect(camera.getZoom()).toEqual(3);
            t.end();
        });

        t.test('emits move and zoom events, preserving eventData', (t) => {
            let movestarted, moved, moveended, zoomstarted, zoomed, zoomended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { moveended = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; });

            camera.setZoom(4, eventData);
            expect(movestarted).toBe('ok');
            expect(moved).toBe('ok');
            expect(moveended).toBe('ok');
            expect(zoomstarted).toBe('ok');
            expect(zoomed).toBe('ok');
            expect(zoomended).toBe('ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            expect(camera.isEasing()).toBeTruthy();
            camera.setZoom(5);
            expect(!camera.isEasing()).toBeTruthy();
            t.end();
        });

        t.end();
    });

    t.test('#setBearing', (t) => {
        const camera = createCamera();

        t.test('sets bearing', (t) => {
            camera.setBearing(4);
            expect(camera.getBearing()).toEqual(4);
            t.end();
        });

        t.test('emits move and rotate events, preserving eventData', (t) => {
            let movestarted, moved, moveended, rotatestarted, rotated, rotateended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { moveended = d.data; })
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { rotateended = d.data; });

            camera.setBearing(5, eventData);
            expect(movestarted).toBe('ok');
            expect(moved).toBe('ok');
            expect(moveended).toBe('ok');
            expect(rotatestarted).toBe('ok');
            expect(rotated).toBe('ok');
            expect(rotateended).toBe('ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            expect(camera.isEasing()).toBeTruthy();
            camera.setBearing(6);
            expect(!camera.isEasing()).toBeTruthy();
            t.end();
        });

        t.end();
    });

    t.test('#setPadding', (t) => {
        t.test('sets padding', (t) => {
            const camera = createCamera();
            const padding = {left: 300, top: 100, right: 50, bottom: 10};
            camera.setPadding(padding);
            expect(camera.getPadding()).toEqual(padding);
            t.end();
        });

        t.test('existing padding is retained if no new values are passed in', (t) => {
            const camera = createCamera();
            const padding = {left: 300, top: 100, right: 50, bottom: 10};
            camera.setPadding(padding);
            camera.setPadding({});

            const currentPadding = camera.getPadding();
            expect(currentPadding).toEqual(padding);
            t.end();
        });

        t.test('doesnt change padding thats already present if new value isnt passed in', (t) => {
            const camera = createCamera();
            const padding = {left: 300, top: 100, right: 50, bottom: 10};
            camera.setPadding(padding);
            const padding1 = {right: 100};
            camera.setPadding(padding1);

            const currentPadding = camera.getPadding();
            expect(currentPadding.left).toBe(padding.left);
            expect(currentPadding.top).toBe(padding.top);
            // padding1 here
            expect(currentPadding.right).toBe(padding1.right);
            expect(currentPadding.bottom).toBe(padding.bottom);
            t.end();
        });

        t.end();
    });

    t.test('#panBy', (t) => {
        t.test('pans by specified amount', (t) => {
            const camera = createCamera();
            camera.panBy([100, 0], {duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 70.3125, lat: 0});
            t.end();
        });

        t.test('pans relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.panBy([100, 0], {duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: -70.3125, lat: 0});
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            const camera = createCamera();
            let started, moved;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    expect(started).toBe('ok');
                    expect(moved).toBe('ok');
                    expect(d.data).toBe('ok');
                    t.end();
                });

            camera.panBy([100, 0], {duration: 0}, eventData);
        });

        t.test('supresses movestart if noMoveStart option is true', (t) => {
            const camera = createCamera();
            let started;

            // fire once in advance to satisfy assertions that moveend only comes after movestart
            camera.fire('movestart');

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    expect(!started).toBeTruthy();
                    t.end();
                });

            camera.panBy([100, 0], {duration: 0, noMoveStart: true});
        });

        t.end();
    });

    t.test('#panTo', (t) => {
        t.test('pans to specified location', (t) => {
            const camera = createCamera();
            camera.panTo([100, 0], {duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            const camera = createCamera();
            expect(() => {
                camera.panTo({center: 1});
            }).toThrowError(Error);
            t.end();
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.panTo([100, 0], {offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.panTo([100, 0], {offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            const camera = createCamera();
            let started, moved;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    expect(started).toBe('ok');
                    expect(moved).toBe('ok');
                    expect(d.data).toBe('ok');
                    t.end();
                });

            camera.panTo([100, 0], {duration: 0}, eventData);
        });

        t.test('supresses movestart if noMoveStart option is true', (t) => {
            const camera = createCamera();
            let started;

            // fire once in advance to satisfy assertions that moveend only comes after movestart
            camera.fire('movestart');

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    expect(!started).toBeTruthy();
                    t.end();
                });

            camera.panTo([100, 0], {duration: 0, noMoveStart: true});
        });

        t.end();
    });

    t.test('#zoomTo', (t) => {
        t.test('zooms to specified level', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, {duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            t.end();
        });

        t.test('zooms around specified location', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, {around: [5, 0], duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 4.455905897939886, lat: 0}));
            t.end();
        });

        t.test('zooms with specified offset', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, {offset: [100, 0], duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 62.66117668978015, lat: 0}));
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.zoomTo(3.2, {offset: [100, 0], duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -62.66117668978012, lat: 0}));
            t.end();
        });

        t.test('emits move and zoom events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed;
            const eventData = {data: 'ok'};

            expect.assertions(6);

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    expect(movestarted).toBe('ok');
                    expect(moved).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => {
                    expect(zoomstarted).toBe('ok');
                    expect(zoomed).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera.zoomTo(5, {duration: 0}, eventData);
        });

        t.end();
    });

    t.test('#rotateTo', (t) => {
        t.test('rotates to specified bearing', (t) => {
            const camera = createCamera();
            camera.rotateTo(90, {duration: 0});
            expect(camera.getBearing()).toBe(90);
            t.end();
        });

        t.test('rotates around specified location', (t) => {
            const camera = createCamera({zoom: 3});
            camera.rotateTo(90, {around: [5, 0], duration: 0});
            expect(camera.getBearing()).toBe(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 4.999999999999972, lat: 4.993665859353271}));
            t.end();
        });

        t.test('rotates around specified location, constrained to fit the view', (t) => {
            const camera = createCamera({zoom: 0});
            camera.rotateTo(90, {around: [5, 0], duration: 0});
            expect(camera.getBearing()).toBe(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 4.999999999999972, lat: 0.000002552471840999715}));
            t.end();
        });

        t.test('rotates with specified offset', (t) => {
            const camera = createCamera({zoom: 1});
            camera.rotateTo(90, {offset: [200, 0], duration: 0});
            expect(camera.getBearing()).toBe(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 57.3265212252}));
            t.end();
        });

        t.test('rotates with specified offset, constrained to fit the view', (t) => {
            const camera = createCamera({zoom: 0});
            camera.rotateTo(90, {offset: [100, 0], duration: 0});
            expect(camera.getBearing()).toBe(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 0.000002552471840999715}));
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180, zoom: 1});
            camera.rotateTo(90, {offset: [200, 0], duration: 0});
            expect(camera.getBearing()).toBe(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -70.3125, lat: 57.3265212252}));
            t.end();
        });

        t.test('emits move and rotate events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, moved, rotatestarted, rotated;
            const eventData = {data: 'ok'};

            expect.assertions(6);

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    expect(movestarted).toBe('ok');
                    expect(moved).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => {
                    expect(rotatestarted).toBe('ok');
                    expect(rotated).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera.rotateTo(90, {duration: 0}, eventData);
        });

        t.end();
    });

    t.test('#easeTo', (t) => {
        t.test('pans to specified location', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
            t.end();
        });

        t.test('zooms to specified level', (t) => {
            const camera = createCamera();
            camera.easeTo({zoom: 3.2, duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            t.end();
        });

        t.test('rotates to specified bearing', (t) => {
            const camera = createCamera();
            camera.easeTo({bearing: 90, duration: 0});
            expect(camera.getBearing()).toBe(90);
            t.end();
        });

        t.test('pitches to specified pitch', (t) => {
            const camera = createCamera();
            camera.easeTo({pitch: 45, duration: 0});
            expect(camera.getPitch()).toBe(45);
            t.end();
        });

        t.test('pans and zooms', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], zoom: 3.2, duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
            expect(camera.getZoom()).toBe(3.2);
            t.end();
        });

        t.test('zooms around a point', (t) => {
            const camera = createCamera();
            camera.easeTo({around: [100, 0], zoom: 3, duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 87.5, lat: 0}));
            expect(camera.getZoom()).toBe(3);
            t.end();
        });

        t.test('pans and rotates', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], bearing: 90, duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
            expect(camera.getBearing()).toBe(90);
            t.end();
        });

        t.test('zooms and rotates', (t) => {
            const camera = createCamera();
            camera.easeTo({zoom: 3.2, bearing: 90, duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            expect(camera.getBearing()).toBe(90);
            t.end();
        });

        t.test('pans, zooms, and rotates', (t) => {
            const camera = createCamera({bearing: -90});
            camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 100, lat: 0}));
            expect(camera.getZoom()).toBe(3.2);
            expect(camera.getBearing()).toBe(90);
            t.end();
        });

        t.test('noop', (t) => {
            const camera = createCamera();
            camera.easeTo({duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toBe(0);
            expect(camera.getBearing()).toBe(0);
            t.end();
        });

        t.test('noop with offset', (t) => {
            const camera = createCamera();
            camera.easeTo({offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toBe(0);
            expect(camera.getBearing()).toBe(0);
            t.end();
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
            t.end();
        });

        t.test('zooms with specified offset', (t) => {
            const camera = createCamera();
            camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 62.66117668978015, lat: 0}));
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
            expect(camera.getZoom()).toBe(3.2);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -62.66117668978012, lat: 0}));
            t.end();
        });

        t.test('rotates with specified offset', (t) => {
            const camera = createCamera();
            camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
            expect(camera.getBearing()).toBe(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: 70.3125, lat: 0.000002552471840999715}));
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
            expect(camera.getBearing()).toBe(90);
            expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat({lng: -70.3125, lat: 0.000002552471840999715}));
            t.end();
        });

        t.test('emits move, zoom, rotate, and pitch events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched;
            const eventData = {data: 'ok'};

            expect.assertions(18);

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    expect(camera._zooming).toBeFalsy();
                    expect(camera._panning).toBeFalsy();
                    expect(camera._rotating).toBeFalsy();

                    expect(movestarted).toBe('ok');
                    expect(moved).toBe('ok');
                    expect(zoomed).toBe('ok');
                    expect(rotated).toBe('ok');
                    expect(pitched).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => {
                    expect(zoomstarted).toBe('ok');
                    expect(zoomed).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => {
                    expect(rotatestarted).toBe('ok');
                    expect(rotated).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => {
                    expect(pitchstarted).toBe('ok');
                    expect(pitched).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera.easeTo(
                {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45},
                eventData);
        });

        t.test('does not emit zoom events if not zooming', (t) => {
            const camera = createCamera();

            camera
                .on('zoomstart', () => { t.fail(); })
                .on('zoom', () => { t.fail(); })
                .on('zoomend', () => { t.fail(); })
                .on('moveend', () => { t.end(); });

            camera.easeTo({center: [100, 0], duration: 0});
        });

        t.test('stops existing ease', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [200, 0], duration: 100});
            camera.easeTo({center: [100, 0], duration: 0});
            expect(camera.getCenter()).toEqual({lng: 100, lat: 0});
            t.end();
        });

        t.test('can be called from within a moveend event handler', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            stub.callsFake(() => 0);
            camera.easeTo({center: [100, 0], duration: 10});

            camera.once('moveend', () => {
                camera.easeTo({center: [200, 0], duration: 10});
                camera.once('moveend', () => {
                    camera.easeTo({center: [300, 0], duration: 10});
                    camera.once('moveend', () => {
                        t.end();
                    });

                    setTimeout(() => {
                        stub.callsFake(() => 30);
                        camera.simulateFrame();
                    }, 0);
                });

                // setTimeout to avoid a synchronous callback
                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            });

            // setTimeout to avoid a synchronous callback
            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();
            }, 0);
        });

        t.test('pans eastward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                expect(crossedAntimeridian).toBeTruthy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.easeTo({center: [-170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans westward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                expect(crossedAntimeridian).toBeTruthy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.easeTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('animation occurs when prefers-reduced-motion: reduce is set but overridden by essential: true', (t) => {
            const camera = createCamera();
            const stubPrefersReducedMotion = t.stub(browser, 'prefersReducedMotion');
            const stubNow = t.stub(browser, 'now');

            stubPrefersReducedMotion.get(() => true);

            // camera transition expected to take in this range when prefersReducedMotion is set and essential: true,
            // when a duration of 200 is requested
            const min = 100;
            const max = 300;

            let startTime;
            camera
                .on('movestart', () => { startTime = browser.now(); })
                .on('moveend', () => {
                    const endTime = browser.now();
                    const timeDiff = endTime - startTime;
                    expect(timeDiff >= min && timeDiff < max).toBeTruthy();
                    t.end();
                });

            setTimeout(() => {
                stubNow.callsFake(() => 0);
                camera.simulateFrame();

                camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 200, essential: true});

                setTimeout(() => {
                    stubNow.callsFake(() => 200);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('duration is 0 when prefers-reduced-motion: reduce is set', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'prefersReducedMotion');
            stub.get(() => true);
            assertTransitionTime(t, camera, 0, 10);
            camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 1000});
        });

        t.end();
    });

    t.test('#flyTo', (t) => {
        t.test('pans to specified location', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            const camera = createCamera();
            expect(() => {
                camera.flyTo({center: 1});
            }).toThrowError(Error);
            t.end();
        });

        t.test('does not throw when cameras current zoom is sufficiently greater than passed zoom option', (t) => {
            const camera = createCamera({zoom: 22, center:[0, 0]});
            expect(() => camera.flyTo({zoom:10, center:[0, 0]})).not.toThrow();
            t.end();
        });

        t.test('does not throw when cameras current zoom is above maxzoom and an offset creates infinite zoom out factor', (t) => {
            const transform = new Transform(0, 20.9999, 0, 60, true);
            transform.resize(512, 512);
            const camera = attachSimulateFrame(new Camera(transform, {}))
                .jumpTo({zoom: 21, center:[0, 0]});
            camera._update = () => {};
            expect(() => camera.flyTo({zoom:7.5, center:[0, 0], offset:[0, 70]})).not.toThrow();
            t.end();
        });

        t.test('zooms to specified level', (t) => {
            const camera = createCamera();
            camera.flyTo({zoom: 3.2, animate: false});
            expect(fixedNum(camera.getZoom())).toBe(3.2);
            t.end();
        });

        t.test('zooms to integer level without floating point errors', (t) => {
            const camera = createCamera({zoom: 0.6});
            camera.flyTo({zoom: 2, animate: false});
            expect(camera.getZoom()).toBe(2);
            t.end();
        });

        t.test('Zoom out from the same position to the same position with animation', (t) => {
            const pos = {lng: 0, lat: 0};
            const camera = createCamera({zoom: 20, center: pos});
            const stub = t.stub(browser, 'now');

            camera.once('zoomend', () => {
                expect(fixedLngLat(camera.getCenter())).toEqual(fixedLngLat(pos));
                expect(camera.getZoom()).toBe(19);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({zoom: 19, center: pos, duration: 2});

            stub.callsFake(() => 3);
            camera.simulateFrame();
        });

        t.test('rotates to specified bearing', (t) => {
            const camera = createCamera();
            camera.flyTo({bearing: 90, animate: false});
            expect(camera.getBearing()).toBe(90);
            t.end();
        });

        t.test('tilts to specified pitch', (t) => {
            const camera = createCamera();
            camera.flyTo({pitch: 45, animate: false});
            expect(camera.getPitch()).toBe(45);
            t.end();
        });

        t.test('pans and zooms', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], zoom: 3.2, animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            expect(fixedNum(camera.getZoom())).toBe(3.2);
            t.end();
        });

        t.test('pans and rotates', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], bearing: 90, animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            expect(camera.getBearing()).toBe(90);
            t.end();
        });

        t.test('zooms and rotates', (t) => {
            const camera = createCamera();
            camera.flyTo({zoom: 3.2, bearing: 90, animate: false});
            expect(fixedNum(camera.getZoom())).toBe(3.2);
            expect(camera.getBearing()).toBe(90);
            t.end();
        });

        t.test('pans, zooms, and rotates', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            expect(fixedNum(camera.getZoom())).toBe(3.2);
            expect(camera.getBearing()).toBe(90);
            t.end();
        });

        t.test('noop', (t) => {
            const camera = createCamera();
            camera.flyTo({animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toBe(0);
            expect(camera.getBearing()).toBe(0);
            t.end();
        });

        t.test('noop with offset', (t) => {
            const camera = createCamera();
            camera.flyTo({offset: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 0, lat: 0});
            expect(camera.getZoom()).toBe(0);
            expect(camera.getBearing()).toBe(0);
            t.end();
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], offset: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 29.6875, lat: 0});
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({center: [100, 0], offset: [100, 0], animate: false});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 170.3125, lat: 0});
            t.end();
        });

        t.test('emits move, zoom, rotate, and pitch events, preserving eventData', (t) => {
            expect.assertions(18);

            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('moveend', function(d) {
                    expect(this._zooming).toBeFalsy();
                    expect(this._panning).toBeFalsy();
                    expect(this._rotating).toBeFalsy();

                    expect(movestarted).toBe('ok');
                    expect(moved).toBe('ok');
                    expect(zoomed).toBe('ok');
                    expect(rotated).toBe('ok');
                    expect(pitched).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => {
                    expect(zoomstarted).toBe('ok');
                    expect(zoomed).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => {
                    expect(rotatestarted).toBe('ok');
                    expect(rotated).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => {
                    expect(pitchstarted).toBe('ok');
                    expect(pitched).toBe('ok');
                    expect(d.data).toBe('ok');
                });

            camera.flyTo(
                {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45, animate: false},
                eventData);
        });

        t.test('for short flights, emits (solely) move events, preserving eventData', (t) => {
            //As I type this, the code path for guiding super-short flights is (and will probably remain) different.
            //As such; it deserves a separate test case. This test case flies the map from A to A.
            const camera = createCamera({center: [100, 0]});
            let movestarted, moved,
                zoomstarted, zoomed, zoomended,
                rotatestarted, rotated, rotateended,
                pitchstarted, pitched, pitchended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; })
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { rotateended = d.data; })
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => { pitchended = d.data; })
                .on('moveend', function(d) {
                    expect(this._zooming).toBeFalsy();
                    expect(this._panning).toBeFalsy();
                    expect(this._rotating).toBeFalsy();

                    expect(movestarted).toBe('ok');
                    expect(moved).toBe('ok');
                    expect(zoomstarted).toBe(undefined);
                    expect(zoomed).toBe(undefined);
                    expect(zoomended).toBe(undefined);
                    expect(rotatestarted).toBe(undefined);
                    expect(rotated).toBe(undefined);
                    expect(rotateended).toBe(undefined);
                    expect(pitched).toBe(undefined);
                    expect(pitchstarted).toBe(undefined);
                    expect(pitchended).toBe(undefined);
                    expect(d.data).toBe('ok');
                    t.end();
                });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);

            camera.flyTo({center: [100, 0], duration: 10}, eventData);

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('stops existing ease', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [200, 0], duration: 100});
            camera.flyTo({center: [100, 0], duration: 0});
            expect(fixedLngLat(camera.getCenter())).toEqual({lng: 100, lat: 0});
            t.end();
        });

        t.test('can be called from within a moveend event handler', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);

            camera.flyTo({center: [100, 0], duration: 10});
            camera.once('moveend', () => {
                camera.flyTo({center: [200, 0], duration: 10});
                camera.once('moveend', () => {
                    camera.flyTo({center: [300, 0], duration: 10});
                    camera.once('moveend', () => {
                        t.end();
                    });
                });
            });

            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.callsFake(() => 30);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            }, 0);
        });

        t.test('ascends', (t) => {
            const camera = createCamera();
            camera.setZoom(18);
            let ascended;

            camera.on('zoom', () => {
                if (camera.getZoom() < 18) {
                    ascended = true;
                }
            });

            camera.on('moveend', () => {
                expect(ascended).toBeTruthy();
                t.end();
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);

            camera.flyTo({center: [100, 0], zoom: 18, duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans eastward across the prime meridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-10, 0]);
            let crossedPrimeMeridian;

            camera.on('move', () => {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            camera.on('moveend', () => {
                expect(crossedPrimeMeridian).toBeTruthy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [10, 0], duration: 20});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans westward across the prime meridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([10, 0]);
            let crossedPrimeMeridian;

            camera.on('move', () => {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            camera.on('moveend', () => {
                expect(crossedPrimeMeridian).toBeTruthy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [-10, 0], duration: 20});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans eastward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                expect(crossedAntimeridian).toBeTruthy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [-170, 0], duration: 20});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans westward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                expect(crossedAntimeridian).toBeTruthy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('does not pan eastward across the antimeridian if no world copies', (t) => {
            const camera = createCamera({renderWorldCopies: false});
            const stub = t.stub(browser, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                expect(crossedAntimeridian).toBeFalsy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [-170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('does not pan westward across the antimeridian if no world copies', (t) => {
            const camera = createCamera({renderWorldCopies: false});
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (fixedLngLat(camera.getCenter(), 10).lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                expect(crossedAntimeridian).toBeFalsy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('jumps back to world 0 when crossing the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);

            let leftWorld0 = false;

            camera.on('move', () => {
                leftWorld0 = leftWorld0 || (camera.getCenter().lng < -180);
            });

            camera.on('moveend', () => {
                expect(leftWorld0).toBeFalsy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('peaks at the specified zoom level', (t) => {
            const camera = createCamera({zoom: 20});
            const stub = t.stub(browser, 'now');

            const minZoom = 1;
            let zoomed = false;

            camera.on('zoom', () => {
                const zoom = camera.getZoom();
                if (zoom < 1) {
                    t.fail(`${zoom} should be >= ${minZoom} during flyTo`);
                }

                if (camera.getZoom() < (minZoom + 1)) {
                    zoomed = true;
                }
            });

            camera.on('moveend', () => {
                expect(zoomed).toBeTruthy();
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [1, 0], zoom: 20, minZoom, duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 3);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('respects transform\'s maxZoom', (t) => {
            const transform = new Transform(2, 10, 0, 60, false);
            transform.resize(512, 512);

            const camera = attachSimulateFrame(new Camera(transform, {}));
            camera._update = () => {};

            camera.on('moveend', () => {
                equalWithPrecision(t, camera.getZoom(), 10, 1e-10);
                const {lng, lat} = camera.getCenter();
                equalWithPrecision(t, lng, 12, 1e-10);
                equalWithPrecision(t, lat, 34, 1e-10);

                t.end();
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.flyTo({center: [12, 34], zoom: 30, duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();
            }, 0);
        });

        t.test('respects transform\'s minZoom', (t) => {
            const transform = new Transform(2, 10, 0, 60, false);
            transform.resize(512, 512);

            const camera = attachSimulateFrame(new Camera(transform, {}));
            camera._update = () => {};

            camera.on('moveend', () => {
                equalWithPrecision(t, camera.getZoom(), 2, 1e-10);
                const {lng, lat} = camera.getCenter();
                equalWithPrecision(t, lng, 12, 1e-10);
                equalWithPrecision(t, lat, 34, 1e-10);

                t.end();
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.flyTo({center: [12, 34], zoom: 1, duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();
            }, 0);
        });

        t.test('resets duration to 0 if it exceeds maxDuration', (t) => {
            let startTime, endTime, timeDiff;
            const camera = createCamera({center: [37.63454, 55.75868], zoom: 18});

            camera
                .on('movestart', () => { startTime = new Date(); })
                .on('moveend', () => {
                    endTime = new Date();
                    timeDiff = endTime - startTime;
                    equalWithPrecision(t, timeDiff, 0, 1e+1);
                    t.end();
                });

            camera.flyTo({center: [-122.3998631, 37.7884307], maxDuration: 100});
        });

        t.test('flys instantly when prefers-reduce-motion:reduce is set', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'prefersReducedMotion');
            stub.get(() => true);
            assertTransitionTime(t, camera, 0, 10);
            camera.flyTo({center: [100, 0], bearing: 90, animate: true});
        });

        t.end();
    });

    t.test('#isEasing', (t) => {
        t.test('returns false when not easing', (t) => {
            const camera = createCamera();
            expect(!camera.isEasing()).toBeTruthy();
            t.end();
        });

        t.test('returns true when panning', (t) => {
            const camera = createCamera();
            camera.panTo([100, 0], {duration: 1});
            expect(camera.isEasing()).toBeTruthy();
            t.end();
        });

        t.test('returns false when done panning', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                expect(!camera.isEasing()).toBeTruthy();
                t.end();
            });
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.panTo([100, 0], {duration: 1});
            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.test('returns true when zooming', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, {duration: 1});
            expect(camera.isEasing()).toBeTruthy();
            t.end();
        });

        t.test('returns false when done zooming', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                expect(!camera.isEasing()).toBeTruthy();
                t.end();
            });
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.zoomTo(3.2, {duration: 1});
            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.test('returns true when rotating', (t) => {
            const camera = createCamera();
            camera.rotateTo(90, {duration: 1});
            expect(camera.isEasing()).toBeTruthy();
            t.end();
        });

        t.test('returns false when done rotating', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                expect(!camera.isEasing()).toBeTruthy();
                t.end();
            });
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.rotateTo(90, {duration: 1});
            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.end();
    });

    t.test('#stop', (t) => {
        t.test('resets camera._zooming', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2);
            camera.stop();
            expect(!camera._zooming).toBeTruthy();
            t.end();
        });

        t.test('resets camera._rotating', (t) => {
            const camera = createCamera();
            camera.rotateTo(90);
            camera.stop();
            expect(!camera._rotating).toBeTruthy();
            t.end();
        });

        t.test('emits moveend if panning, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            camera.on('moveend', (d) => {
                expect(d.data).toBe('ok');
                t.end();
            });

            camera.panTo([100, 0], {}, eventData);
            camera.stop();
        });

        t.test('emits moveend if zooming, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            camera.on('moveend', (d) => {
                expect(d.data).toBe('ok');
                t.end();
            });

            camera.zoomTo(3.2, {}, eventData);
            camera.stop();
        });

        t.test('emits moveend if rotating, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            camera.on('moveend', (d) => {
                expect(d.data).toBe('ok');
                t.end();
            });

            camera.rotateTo(90, {}, eventData);
            camera.stop();
        });

        t.test('does not emit moveend if not moving', (t) => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            camera.on('moveend', (d) => {
                expect(d.data).toBe('ok');
                camera.stop();
                t.end(); // Fails with ".end() called twice" if we get here a second time.
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.panTo([100, 0], {duration: 1}, eventData);

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.end();
    });

    t.test('#cameraForBounds', (t) => {
        t.test('no options passed', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(transform.zoom, 3)).toBe(2.469);
            t.end();
        });

        t.test('bearing positive number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 175});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(transform.zoom, 3)).toBe(2.558);
            expect(transform.bearing).toBe(175);
            t.end();
        });

        t.test('bearing negative number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: -30});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(transform.zoom, 3)).toBe(2.392);
            expect(transform.bearing).toBe(-30);
            t.end();
        });

        t.test('padding number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: 15});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(transform.zoom, 3)).toBe(2.382);
            t.end();
        });

        t.test('padding object', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: {top: 15, right: 15, bottom: 15, left: 15}, duration: 0});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.7171});
            t.end();
        });

        t.test('asymmetrical padding', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -96.5558, lat: 32.0833});
            t.end();
        });

        t.test('bearing and asymmetrical padding', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -103.3761, lat: 31.7099});
            t.end();
        });

        t.test('offset', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {offset: [0, 100]});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 44.4717});
            t.end();
        });

        t.test('offset as object', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {offset: {x: 0, y: 100}});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 44.4717});
            t.end();
        });

        t.test('offset and padding', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, offset: [0, 100]});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -96.5558, lat: 44.4189});
            t.end();
        });

        t.test('bearing, asymmetrical padding, and offset', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}, offset: [0, 100], duration: 0});
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -103.3761, lat: 43.0929});
            t.end();
        });

        t.end();
    });

    t.test('#fitBounds', (t) => {
        t.test('no padding passed', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(camera.getZoom(), 3)).toBe(2.469);
            t.end();
        });

        t.test('padding number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: 15, duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
            expect(fixedNum(camera.getZoom(), 3)).toBe(2.382);
            t.end();
        });

        t.test('padding object', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -96.5558, lat: 32.0833});
            t.end();
        });

        t.test('padding does not get propagated to transform.padding', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration:0});
            const padding = camera.transform.padding;
            expect(padding).toEqual({
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            });
            t.end();
        });

        t.end();
    });

    t.test('#fitScreenCoordinates', (t) => {
        t.test('bearing 225', (t) => {
            const camera = createCamera();
            const p0 = [128, 128];
            const p1 = [256, 256];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -45, lat: 40.9799});
            expect(fixedNum(camera.getZoom(), 3)).toBe(1.5);
            expect(camera.getBearing()).toBe(-135);
            t.end();
        });

        t.test('bearing 0', (t) => {
            const camera = createCamera();

            const p0 = [128, 128];
            const p1 = [256, 256];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -45, lat: 40.9799});
            expect(fixedNum(camera.getZoom(), 3)).toBe(2);
            expect(camera.getBearing()).toBe(0);
            t.end();
        });

        t.test('inverted points', (t) => {
            const camera = createCamera();
            const p1 = [128, 128];
            const p0 = [256, 256];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            expect(fixedLngLat(camera.getCenter(), 4)).toEqual({lng: -45, lat: 40.9799});
            expect(fixedNum(camera.getZoom(), 3)).toBe(2);
            expect(camera.getBearing()).toBe(0);
            t.end();
        });

        t.end();
    });

    t.end();
});
