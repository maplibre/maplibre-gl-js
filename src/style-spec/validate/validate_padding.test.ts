import validatePadding from './validate_padding';

describe('Validate Padding', () => {
    test('Should return error if type is not number or array', () => {
        let errors = validatePadding({key: 'padding', value: '3'});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding: number expected, string found');

        errors = validatePadding({key: 'padding', value: true});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding: number expected, boolean found');

        errors = validatePadding({key: 'padding', value: null});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding: number expected, null found');

        errors = validatePadding({key: 'padding', value: {x: 1, y: 1}});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding: number expected, object found');

        errors = validatePadding({key: 'padding', value: NaN});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding: number expected, NaN found');
    });

    test('Should pass if type is number', () => {
        const errors = validatePadding({key: 'padding', value: 1});
        expect(errors).toHaveLength(0);
    });

    test('Should return error if array length is invalid', () => {
        let errors = validatePadding({key: 'padding', value: []});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding: padding requires 1 to 4 values; 0 values found');

        errors = validatePadding({key: 'padding', value: [1, 1, 1, 1, 1]});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding: padding requires 1 to 4 values; 5 values found');

        errors = validatePadding({key: 'padding', value: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding: padding requires 1 to 4 values; 12 values found');
    });

    test('Should return error if array contains non-numeric values', () => {
        let errors = validatePadding({key: 'padding', value: ['1']});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding[0]: number expected, string found');

        errors = validatePadding({key: 'padding', value: [true]});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding[0]: number expected, boolean found');

        errors = validatePadding({key: 'padding', value: [NaN]});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding[0]: number expected, NaN found');

        errors = validatePadding({key: 'padding', value: [{x: 1}]});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding[0]: number expected, object found');

        errors = validatePadding({key: 'padding', value: [1, 3, false]});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('padding[2]: number expected, boolean found');

        errors = validatePadding({key: 'padding', value: ['1', 3, false]});
        expect(errors).toHaveLength(2);
        expect(errors[0].message).toBe('padding[0]: number expected, string found');
        expect(errors[1].message).toBe('padding[2]: number expected, boolean found');
    });

    test('Should pass if type is numeric array', () => {
        let errors = validatePadding({key: 'padding', value: [1]});
        expect(errors).toHaveLength(0);
        errors = validatePadding({key: 'padding', value: [1, 1]});
        expect(errors).toHaveLength(0);
        errors = validatePadding({key: 'padding', value: [1, 1, 1]});
        expect(errors).toHaveLength(0);
        errors = validatePadding({key: 'padding', value: [1, 1, 1, 1]});
        expect(errors).toHaveLength(0);
    });
});
