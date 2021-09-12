import {test} from '../../util/test';
import Anchor from '../../../rollup/build/tsc/symbol/anchor';

test('Anchor', (t) => {
    t.test('#constructor', (t) => {
        expect(new Anchor(0, 0, 0, []) instanceof Anchor).toBeTruthy();
        expect(new Anchor(0, 0, 0, [], []) instanceof Anchor).toBeTruthy();
        t.end();
    });
    t.test('#clone', (t) => {
        const a = new Anchor(1, 2, 3, []);
        const b = new Anchor(1, 2, 3, []);
        expect(a.clone()).toEqual(b);
        expect(a.clone()).toEqual(a);
        t.end();
    });

    t.end();
});
