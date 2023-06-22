import {browser} from './browser';

describe('browser', () => {
    test('frame', done => {
        const id = browser.frame(() => {
            expect(id).toBeTruthy();
            done();
        });
    });

    test('now', () => {
        expect(typeof browser.now()).toBe('number');
    });

    test('frame', done => {
        const frame = browser.frame(() => {
            done('test failed: browser.frame callback was called');
        });
        frame.cancel();
        done();
    });

    test('hardwareConcurrency', () => {
        expect(typeof browser.hardwareConcurrency).toBe('number');
    });
});
