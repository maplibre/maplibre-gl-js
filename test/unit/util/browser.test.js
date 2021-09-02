import '../../stub_loader';
import {test} from '../../util/test';
import browser from '../../../rollup/build/tsc/util/browser';

test('browser', (t) => {
    t.test('frame', (t) => {
        const id = browser.frame(() => {
            t.pass('called frame');
            t.ok(id, 'returns id');
            t.end();
        });
    });

    t.test('now', (t) => {
        t.equal(typeof browser.now(), 'number');
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
        t.equal(typeof browser.hardwareConcurrency, 'number');
        t.end();
    });

    t.end();
});
