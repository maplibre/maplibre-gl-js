import browser from './browser';

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
        expect(() => {
            const frame = browser.frame(() => {
                done.fail();
            });
            frame.cancel();
            done();
        }).not.toThrow();
    });

    test('hardwareConcurrency', () => {
        expect(typeof browser.hardwareConcurrency).toBe('number');
    });
});
