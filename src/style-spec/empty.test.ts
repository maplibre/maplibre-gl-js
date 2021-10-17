import emptyStyle from '../style-spec/empty';
import validateStyleMin from '../style-spec/validate_style.min';

describe('it generates something', () => {
    const style = emptyStyle();
    expect(style).toBeTruthy();
});

describe('generated empty style is a valid style', () => {
    const errors = validateStyleMin(emptyStyle());
    expect(errors.length).toBe(0);
});
