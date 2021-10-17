import '../../stub_loader';
import {test} from '../../util/test';
import browser from '../../../rollup/build/tsc/src/util/browser';

test('browser', (t) => {
    t.test('frame', (t) => {
        const id = browser.frame(() => {
            t.pass('called frame');
            expect(id).toBeTruthy();
            t.end();
        });
    });

    t.test('now', (t) => {
        expect(typeof browser.now()).toBe('number');
        t.end();
    });

    t.test('frame', (t) => {
        const frame = browser.frame(() => {
            t.fail();
        });
        frame.cancel();
        t.end();
    });

    t.test('hardwareConcurrency', (t) => {
        expect(typeof browser.hardwareConcurrency).toBe('number');
        t.end();
    });

    t.end();
});
