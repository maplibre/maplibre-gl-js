import {describe, test, expect, vi} from 'vitest';
import {Event, Evented} from './evented';

describe('Evented', () => {

    test('calls listeners added with "on"', () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.on('a', listener);
        evented.fire(new Event('a'));
        evented.fire(new Event('a'));
        expect(listener).toHaveBeenCalledTimes(2);
    });

    test('calls listeners added with "once" once', () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.once('a', listener);
        evented.fire(new Event('a'));
        evented.fire(new Event('a'));
        expect(listener).toHaveBeenCalledTimes(1);
        expect(evented.listens('a')).toBeFalsy();
    });

    test('calls listeners added with "on" and allows to unsubscribe', () => {
        const evented = new Evented();
        const listener = vi.fn();
        const subscription = evented.on('a', listener);
        evented.fire(new Event('a'));
        subscription.unsubscribe();
        evented.fire(new Event('a'));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('returns a promise when no listener is provided to "once" method', async () => {
        const evented = new Evented();
        const promise = evented.once('a');
        evented.fire(new Event('a'));
        evented.fire(new Event('a'));
        await promise;
        expect(evented.listens('a')).toBeFalsy();

    });

    test('passes data to listeners', () => {
        const evented = new Evented();
        evented.on('a', (data) => {
            expect(data.foo).toBe('bar');
        });
        evented.fire(new Event('a', {foo: 'bar'}));

    });

    test('passes "target" to listeners', () => {
        const evented = new Evented();
        evented.on('a', (data) => {
            expect(data.target).toBe(evented);
        });
        evented.fire(new Event('a'));

    });

    test('passes "type" to listeners', () => {
        const evented = new Evented();
        evented.on('a', (data) => {
            expect(data.type).toBe('a');
        });
        evented.fire(new Event('a'));

    });

    test('removes listeners with "off"', () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.on('a', listener);
        evented.off('a', listener);
        evented.fire(new Event('a'));
        expect(listener).not.toHaveBeenCalled();
    });

    test('removes one-time listeners with "off"', () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.once('a', listener);
        evented.off('a', listener);
        evented.fire(new Event('a'));
        expect(listener).not.toHaveBeenCalled();
    });

    test('once listener is removed prior to call', () => {
        const evented = new Evented();
        const listener = vi.fn();
        evented.once('a', () => {
            listener();
            evented.fire(new Event('a'));
        });
        evented.fire(new Event('a'));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('reports if an event has listeners with "listens"', () => {
        const evented = new Evented();
        evented.on('a', () => {});
        expect(evented.listens('a')).toBeTruthy();
        expect(evented.listens('b')).toBeFalsy();

    });

    test('does not report true to "listens" if all listeners have been removed', () => {
        const evented = new Evented();
        const listener = () => {};
        evented.on('a', listener);
        evented.off('a', listener);
        expect(evented.listens('a')).toBeFalsy();

    });

    test('does not immediately call listeners added within another listener', () => {
        const evented = new Evented();
        evented.on('a', () => {
            evented.on('a', () => { throw new Error('fail'); });
        });
        evented.fire(new Event('a'));
    });

    test('has backward compatibility for fire(string, object) API', () => {
        const evented = new Evented();
        const listener = vi.fn(x => x);
        evented.on('a', listener);
        evented.fire('a' as any as Event, {foo: 'bar'});
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].foo).toBe('bar');

    });

    test('on is idempotent', () => {
        const evented = new Evented();
        const order = [];
        const listenerA = vi.fn(() => order.push('A'));
        const listenerB = vi.fn(() => order.push('B'));
        evented.on('a', listenerA);
        evented.on('a', listenerB);
        evented.on('a', listenerA);
        evented.fire(new Event('a'));
        expect(listenerA).toHaveBeenCalledTimes(1);
        expect(order).toEqual(['A', 'B']);

    });
});

describe('evented parents', () => {

    test('adds parents with "setEventedParent"', () => {
        const listener = vi.fn();
        const eventedSource = new Evented();
        const eventedSink = new Evented();
        eventedSource.setEventedParent(eventedSink);
        eventedSink.on('a', listener);
        eventedSource.fire(new Event('a'));
        eventedSource.fire(new Event('a'));
        expect(listener).toHaveBeenCalledTimes(2);
    });

    test('passes original data to parent listeners', () => {
        const eventedSource = new Evented();
        const eventedSink = new Evented();
        eventedSource.setEventedParent(eventedSink);
        eventedSink.on('a', (data) => {
            expect(data.foo).toBe('bar');
        });
        eventedSource.fire(new Event('a', {foo: 'bar'}));

    });

    test('attaches parent data to parent listeners', () => {
        const eventedSource = new Evented();
        const eventedSink = new Evented();
        eventedSource.setEventedParent(eventedSink, {foz: 'baz'});
        eventedSink.on('a', (data) => {
            expect(data.foz).toBe('baz');
        });
        eventedSource.fire(new Event('a', {foo: 'bar'}));

    });

    test('attaches parent data from a function to parent listeners', () => {
        const eventedSource = new Evented();
        const eventedSink = new Evented();
        eventedSource.setEventedParent(eventedSink, () => ({foz: 'baz'}));
        eventedSink.on('a', (data) => {
            expect(data.foz).toBe('baz');
        });
        eventedSource.fire(new Event('a', {foo: 'bar'}));

    });

    test('passes original "target" to parent listeners', () => {
        const eventedSource = new Evented();
        const eventedSink = new Evented();
        eventedSource.setEventedParent(eventedSink);
        eventedSource.setEventedParent(null);
        eventedSink.on('a', (data) => {
            expect(data.target).toBe(eventedSource);
        });
        eventedSource.fire(new Event('a'));

    });

    test('removes parents with "setEventedParent(null)"', () => {
        const listener = vi.fn();
        const eventedSource = new Evented();
        const eventedSink = new Evented();
        eventedSink.on('a', listener);
        eventedSource.setEventedParent(eventedSink);
        eventedSource.setEventedParent(null);
        eventedSource.fire(new Event('a'));
        expect(listener).not.toHaveBeenCalled();
    });

    test('reports if an event has parent listeners with "listens"', () => {
        const eventedSource = new Evented();
        const eventedSink = new Evented();
        eventedSink.on('a', () => {});
        eventedSource.setEventedParent(eventedSink);
        expect(eventedSink.listens('a')).toBeTruthy();

    });

    test('eventedParent data function is evaluated on every fire', () => {
        const eventedSource = new Evented();
        const eventedParent = new Evented();
        let i = 0;
        eventedSource.setEventedParent(eventedParent, () => i++);
        eventedSource.on('a', () => {});
        eventedSource.fire(new Event('a'));
        expect(i).toBe(1);
        eventedSource.fire(new Event('a'));
        expect(i).toBe(2);

    });
});
