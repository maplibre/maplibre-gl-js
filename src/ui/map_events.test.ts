import {test} from '../../util/test';
import {createMap} from '../../util';
import simulate, {window} from '../../util/simulate_interaction';

test('Map#on adds a non-delegated event listener', (t) => {
    const map = createMap(t);
    const spy = t.spy(function (e) {
        expect(this).toBe(map);
        expect(e.type).toBe('click');
    });

    map.on('click', spy);
    simulate.click(map.getCanvas());

    expect(spy.calledOnce).toBeTruthy();
    t.end();
});

test('Map#off removes a non-delegated event listener', (t) => {
    const map = createMap(t);
    const spy = t.spy();

    map.on('click', spy);
    map.off('click', spy);
    simulate.click(map.getCanvas());

    expect(spy.notCalled).toBeTruthy();
    t.end();
});

test('Map#on adds a listener for an event on a given layer', (t) => {
    const map = createMap(t);
    const features = [{}];

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
        expect(options).toEqual({layers: ['layer']});
        return features;
    });

    const spy = t.spy(function (e) {
        expect(this).toBe(map);
        expect(e.type).toBe('click');
        expect(e.features).toBe(features);
    });

    map.on('click', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy.calledOnce).toBeTruthy();
    t.end();
});

test('Map#on adds a listener not triggered for events not matching any features', (t) => {
    const map = createMap(t);
    const features = [];

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
        expect(options).toEqual({layers: ['layer']});
        return features;
    });

    const spy = t.spy();

    map.on('click', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy.notCalled).toBeTruthy();
    t.end();
});

test(`Map#on adds a listener not triggered when the specified layer does not exiist`, (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns(null);

    const spy = t.spy();

    map.on('click', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy.notCalled).toBeTruthy();
    t.end();
});

test('Map#on distinguishes distinct event types', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spyDown = t.spy((e) => {
        expect(e.type).toBe('mousedown');
    });

    const spyUp = t.spy((e) => {
        expect(e.type).toBe('mouseup');
    });

    map.on('mousedown', 'layer', spyDown);
    map.on('mouseup', 'layer', spyUp);
    simulate.click(map.getCanvas());

    expect(spyDown.calledOnce).toBeTruthy();
    expect(spyUp.calledOnce).toBeTruthy();
    t.end();
});

test('Map#on distinguishes distinct layers', (t) => {
    const map = createMap(t);
    const featuresA = [{}];
    const featuresB = [{}];

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
        return options.layers[0] === 'A' ? featuresA : featuresB;
    });

    const spyA = t.spy((e) => {
        expect(e.features).toBe(featuresA);
    });

    const spyB = t.spy((e) => {
        expect(e.features).toBe(featuresB);
    });

    map.on('click', 'A', spyA);
    map.on('click', 'B', spyB);
    simulate.click(map.getCanvas());

    expect(spyA.calledOnce).toBeTruthy();
    expect(spyB.calledOnce).toBeTruthy();
    t.end();
});

test('Map#on distinguishes distinct listeners', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spyA = t.spy();
    const spyB = t.spy();

    map.on('click', 'layer', spyA);
    map.on('click', 'layer', spyB);
    simulate.click(map.getCanvas());

    expect(spyA.calledOnce).toBeTruthy();
    expect(spyB.calledOnce).toBeTruthy();
    t.end();
});

test('Map#off removes a delegated event listener', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spy = t.spy();

    map.on('click', 'layer', spy);
    map.off('click', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy.notCalled).toBeTruthy();
    t.end();
});

test('Map#off distinguishes distinct event types', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spy = t.spy((e) => {
        expect(e.type).toBe('mousedown');
    });

    map.on('mousedown', 'layer', spy);
    map.on('mouseup', 'layer', spy);
    map.off('mouseup', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy.calledOnce).toBeTruthy();
    t.end();
});

test('Map#off distinguishes distinct layers', (t) => {
    const map = createMap(t);
    const featuresA = [{}];

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
        expect(options).toEqual({layers: ['A']});
        return featuresA;
    });

    const spy = t.spy((e) => {
        expect(e.features).toBe(featuresA);
    });

    map.on('click', 'A', spy);
    map.on('click', 'B', spy);
    map.off('click', 'B', spy);
    simulate.click(map.getCanvas());

    expect(spy.calledOnce).toBeTruthy();
    t.end();
});

test('Map#off distinguishes distinct listeners', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spyA = t.spy();
    const spyB = t.spy();

    map.on('click', 'layer', spyA);
    map.on('click', 'layer', spyB);
    map.off('click', 'layer', spyB);
    simulate.click(map.getCanvas());

    expect(spyA.calledOnce).toBeTruthy();
    expect(spyB.notCalled).toBeTruthy();
    t.end();
});

['mouseenter', 'mouseover'].forEach((event) => {
    test(`Map#on ${event} does not fire if the specified layer does not exist`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns(null);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy.notCalled).toBeTruthy();
        t.end();
    });

    test(`Map#on ${event} fires when entering the specified layer`, (t) => {
        const map = createMap(t);
        const features = [{}];

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
            expect(options).toEqual({layers: ['layer']});
            return features;
        });

        const spy = t.spy(function (e) {
            expect(this).toBe(map);
            expect(e.type).toBe(event);
            expect(e.target).toBe(map);
            expect(e.features).toBe(features);
        });

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());

        expect(spy.calledOnce).toBeTruthy();
        t.end();
    });

    test(`Map#on ${event} does not fire on mousemove within the specified layer`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy.calledOnce).toBeTruthy();
        t.end();
    });

    test(`Map#on ${event} fires when reentering the specified layer`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures')
            .onFirstCall().returns([{}])
            .onSecondCall().returns([])
            .onThirdCall().returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy.calledTwice).toBeTruthy();
        t.end();
    });

    test(`Map#on ${event} fires when reentering the specified layer after leaving the canvas`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy.calledTwice).toBeTruthy();
        t.end();
    });

    test(`Map#on ${event} distinguishes distinct layers`, (t) => {
        const map = createMap(t);
        const featuresA = [{}];
        const featuresB = [{}];

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
            return options.layers[0] === 'A' ? featuresA : featuresB;
        });

        const spyA = t.spy((e) => {
            expect(e.features).toBe(featuresA);
        });

        const spyB = t.spy((e) => {
            expect(e.features).toBe(featuresB);
        });

        map.on(event, 'A', spyA);
        map.on(event, 'B', spyB);

        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spyA.calledOnce).toBeTruthy();
        expect(spyB.calledOnce).toBeTruthy();
        t.end();
    });

    test(`Map#on ${event} distinguishes distinct listeners`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spyA = t.spy();
        const spyB = t.spy();

        map.on(event, 'layer', spyA);
        map.on(event, 'layer', spyB);
        simulate.mousemove(map.getCanvas());

        expect(spyA.calledOnce).toBeTruthy();
        expect(spyB.calledOnce).toBeTruthy();
        t.end();
    });

    test(`Map#off ${event} removes a delegated event listener`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        map.off(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());

        expect(spy.notCalled).toBeTruthy();
        t.end();
    });

    test(`Map#off ${event} distinguishes distinct layers`, (t) => {
        const map = createMap(t);
        const featuresA = [{}];

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
            expect(options).toEqual({layers: ['A']});
            return featuresA;
        });

        const spy = t.spy((e) => {
            expect(e.features).toBe(featuresA);
        });

        map.on(event, 'A', spy);
        map.on(event, 'B', spy);
        map.off(event, 'B', spy);
        simulate.mousemove(map.getCanvas());

        expect(spy.calledOnce).toBeTruthy();
        t.end();
    });

    test(`Map#off ${event} distinguishes distinct listeners`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spyA = t.spy();
        const spyB = t.spy();

        map.on(event, 'layer', spyA);
        map.on(event, 'layer', spyB);
        map.off(event, 'layer', spyB);
        simulate.mousemove(map.getCanvas());

        expect(spyA.calledOnce).toBeTruthy();
        expect(spyB.notCalled).toBeTruthy();
        t.end();
    });
});

['mouseleave', 'mouseout'].forEach((event) => {
    test(`Map#on ${event} does not fire if the specified layer does not exiist`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns(null);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy.notCalled).toBeTruthy();
        t.end();
    });

    test(`Map#on ${event} does not fire on mousemove when entering or within the specified layer`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy.notCalled).toBeTruthy();
        t.end();
    });

    test(`Map#on ${event} fires when exiting the specified layer`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures')
            .onFirstCall().returns([{}])
            .onSecondCall().returns([]);

        const spy = t.spy(function (e) {
            expect(this).toBe(map);
            expect(e.type).toBe(event);
            expect(e.features).toBe(undefined);
        });

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy.calledOnce).toBeTruthy();
        t.end();
    });

    test(`Map#on ${event} fires when exiting the canvas`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy(function (e) {
            expect(this).toBe(map);
            expect(e.type).toBe(event);
            expect(e.features).toBe(undefined);
        });

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());

        expect(spy.calledOnce).toBeTruthy();
        t.end();
    });

    test(`Map#off ${event} removes a delegated event listener`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures')
            .onFirstCall().returns([{}])
            .onSecondCall().returns([]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        map.off(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());

        expect(spy.notCalled).toBeTruthy();
        t.end();
    });
});

test(`Map#on mousedown can have default behavior prevented and still fire subsequent click event`, (t) => {
    const map = createMap(t);

    map.on('mousedown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);

    simulate.click(map.getCanvas());
    expect(click.callCount).toBeTruthy();

    map.remove();
    t.end();
});

test(`Map#on mousedown doesn't fire subsequent click event if mousepos changes`, (t) => {
    const map = createMap(t);

    map.on('mousedown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {}, {clientX: 100, clientY: 100});
    expect(click.notCalled).toBeTruthy();

    map.remove();
    t.end();
});

test(`Map#on mousedown fires subsequent click event if mouse position changes less than click tolerance`, (t) => {
    const map = createMap(t, {clickTolerance: 4});

    map.on('mousedown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 103});
    expect(click.called).toBeTruthy();

    map.remove();
    t.end();
});

test(`Map#on mousedown does not fire subsequent click event if mouse position changes more than click tolerance`, (t) => {
    const map = createMap(t, {clickTolerance: 4});

    map.on('mousedown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 104});
    expect(click.notCalled).toBeTruthy();

    map.remove();
    t.end();
});

test(`Map#on click fires subsequent click event if there is no corresponding mousedown/mouseup event`, (t) => {
    const map = createMap(t, {clickTolerance: 4});

    const click = t.spy();
    map.on('click', click);
    const canvas = map.getCanvas();

    const MouseEvent = window(canvas).MouseEvent;
    const event = new MouseEvent('click', {bubbles: true, clientX: 100, clientY: 100});
    canvas.dispatchEvent(event);
    expect(click.called).toBeTruthy();

    map.remove();
    t.end();
});

test("Map#isMoving() returns false in mousedown/mouseup/click with no movement", (t) => {
    const map = createMap(t, {interactive: true, clickTolerance: 4});
    let mousedown, mouseup, click;
    map.on('mousedown', () => { mousedown = map.isMoving(); });
    map.on('mouseup', () => { mouseup = map.isMoving(); });
    map.on('click', () => { click = map.isMoving(); });

    const canvas = map.getCanvas();
    const MouseEvent = window(canvas).MouseEvent;

    canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 100, clientY: 100}));
    expect(mousedown).toBe(false);
    map._renderTaskQueue.run();
    expect(mousedown).toBe(false);

    canvas.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: 100, clientY: 100}));
    expect(mouseup).toBe(false);
    map._renderTaskQueue.run();
    expect(mouseup).toBe(false);

    canvas.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: 100, clientY: 100}));
    expect(click).toBe(false);
    map._renderTaskQueue.run();
    expect(click).toBe(false);

    map.remove();
    t.end();
});
