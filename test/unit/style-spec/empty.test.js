import {test} from '../../util/test';
import emptyStyle from '../../../rollup/build/tsc/src/style-spec/empty';
import validateStyleMin from '../../../rollup/build/tsc/src/style-spec/validate_style.min';

test('it generates something', (t) => {
    const style = emptyStyle();
    t.ok(style);
    t.end();
});

test('generated empty style is a valid style', (t) => {
    const errors = validateStyleMin(emptyStyle());
    t.equal(errors.length, 0);
    t.end();
});
