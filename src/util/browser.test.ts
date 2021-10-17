import '../../stub_loader';
import browser from '../util/browser';

describe('browser', done => {
    test('frame', done => {
        const id = browser.frame(() => {
            t.pass('called frame');
            expect(id).toBeTruthy();
            done();
        });
    });

    test('now', done => {
        expect(typeof browser.now()).toBe('number');
        done();
    });

    test('frame', done => {
        const frame = browser.frame(() => {
            t.fail();
        });
        frame.cancel();
        done();
    });

    test('hardwareConcurrency', done => {
        expect(typeof browser.hardwareConcurrency).toBe('number');
        done();
    });

    done();
});
