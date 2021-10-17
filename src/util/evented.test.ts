import {Event, Evented} from '../util/evented';

describe('Evented', done => {

    test('calls listeners added with "on"', done => {
        const evented = new Evented();
        const listener = t.spy();
        evented.on('a', listener);
        evented.fire(new Event('a'));
        evented.fire(new Event('a'));
        expect(listener.calledTwice).toBeTruthy();
        done();
    });

    test('calls listeners added with "once" once', done => {
        const evented = new Evented();
        const listener = t.spy();
        evented.once('a', listener);
        evented.fire(new Event('a'));
        evented.fire(new Event('a'));
        expect(listener.calledOnce).toBeTruthy();
        expect(evented.listens('a')).toBeFalsy();
        done();
    });

    test('passes data to listeners', done => {
        const evented = new Evented();
        evented.on('a', (data) => {
            expect(data.foo).toBe('bar');
        });
        evented.fire(new Event('a', {foo: 'bar'}));
        done();
    });

    test('passes "target" to listeners', done => {
        const evented = new Evented();
        evented.on('a', (data) => {
            expect(data.target).toBe(evented);
        });
        evented.fire(new Event('a'));
        done();
    });

    test('passes "type" to listeners', done => {
        const evented = new Evented();
        evented.on('a', (data) => {
            expect(data.type).toEqual('a');
        });
        evented.fire(new Event('a'));
        done();
    });

    test('removes listeners with "off"', done => {
        const evented = new Evented();
        const listener = t.spy();
        evented.on('a', listener);
        evented.off('a', listener);
        evented.fire(new Event('a'));
        expect(listener.notCalled).toBeTruthy();
        done();
    });

    test('removes one-time listeners with "off"', done => {
        const evented = new Evented();
        const listener = t.spy();
        evented.once('a', listener);
        evented.off('a', listener);
        evented.fire(new Event('a'));
        expect(listener.notCalled).toBeTruthy();
        done();
    });

    test('once listener is removed prior to call', done => {
        const evented = new Evented();
        const listener = t.spy();
        evented.once('a', () => {
            listener();
            evented.fire(new Event('a'));
        });
        evented.fire(new Event('a'));
        expect(listener.calledOnce).toBeTruthy();
        done();
    });

    test('reports if an event has listeners with "listens"', done => {
        const evented = new Evented();
        evented.on('a', () => {});
        expect(evented.listens('a')).toBeTruthy();
        expect(evented.listens('b')).toBeFalsy();
        done();
    });

    test('does not report true to "listens" if all listeners have been removed', done => {
        const evented = new Evented();
        const listener = () => {};
        evented.on('a', listener);
        evented.off('a', listener);
        expect(evented.listens('a')).toBeFalsy();
        done();
    });

    test('does not immediately call listeners added within another listener', done => {
        const evented = new Evented();
        evented.on('a', () => {
            evented.on('a', t.fail.bind(t));
        });
        evented.fire(new Event('a'));
        done();
    });

    test('has backward compatibility for fire(string, object) API', done => {
        const evented = new Evented();
        const listener = t.spy();
        evented.on('a', listener);
        evented.fire('a', {foo: 'bar'});
        expect(listener.calledOnce).toBeTruthy();
        expect(listener.firstCall.args[0].foo).toBeTruthy();
        done();
    });

    test('on is idempotent', done => {
        const evented = new Evented();
        const listenerA = t.spy();
        const listenerB = t.spy();
        evented.on('a', listenerA);
        evented.on('a', listenerB);
        evented.on('a', listenerA);
        evented.fire(new Event('a'));
        expect(listenerA.calledOnce).toBeTruthy();
        expect(listenerA.calledBefore(listenerB)).toBeTruthy();
        done();
    });

    test('evented parents', done => {

        test('adds parents with "setEventedParent"', done => {
            const listener = t.spy();
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSource.setEventedParent(eventedSink);
            eventedSink.on('a', listener);
            eventedSource.fire(new Event('a'));
            eventedSource.fire(new Event('a'));
            expect(listener.calledTwice).toBeTruthy();
            done();
        });

        test('passes original data to parent listeners', done => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSource.setEventedParent(eventedSink);
            eventedSink.on('a', (data) => {
                expect(data.foo).toBe('bar');
            });
            eventedSource.fire(new Event('a', {foo: 'bar'}));
            done();
        });

        test('attaches parent data to parent listeners', done => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSource.setEventedParent(eventedSink, {foz: 'baz'});
            eventedSink.on('a', (data) => {
                expect(data.foz).toBe('baz');
            });
            eventedSource.fire(new Event('a', {foo: 'bar'}));
            done();
        });

        test('attaches parent data from a function to parent listeners', done => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSource.setEventedParent(eventedSink, () => ({foz: 'baz'}));
            eventedSink.on('a', (data) => {
                expect(data.foz).toBe('baz');
            });
            eventedSource.fire(new Event('a', {foo: 'bar'}));
            done();
        });

        test('passes original "target" to parent listeners', done => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSource.setEventedParent(eventedSink);
            eventedSource.setEventedParent(null);
            eventedSink.on('a', (data) => {
                expect(data.target).toBe(eventedSource);
            });
            eventedSource.fire(new Event('a'));
            done();
        });

        test('removes parents with "setEventedParent(null)"', done => {
            const listener = t.spy();
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSink.on('a', listener);
            eventedSource.setEventedParent(eventedSink);
            eventedSource.setEventedParent(null);
            eventedSource.fire(new Event('a'));
            expect(listener.notCalled).toBeTruthy();
            done();
        });

        test('reports if an event has parent listeners with "listens"', done => {
            const eventedSource = new Evented();
            const eventedSink = new Evented();
            eventedSink.on('a', () => {});
            eventedSource.setEventedParent(eventedSink);
            expect(eventedSink.listens('a')).toBeTruthy();
            done();
        });

        test('eventedParent data function is evaluated on every fire', done => {
            const eventedSource = new Evented();
            const eventedParent = new Evented();
            let i = 0;
            eventedSource.setEventedParent(eventedParent, () => i++);
            eventedSource.on('a', () => {});
            eventedSource.fire(new Event('a'));
            expect(i).toBe(1);
            eventedSource.fire(new Event('a'));
            expect(i).toBe(2);
            done();
        });

        done();

    });

    done();
});
