import validateTerrain from './validate_terrain';
import v8 from '../reference/v8.json' assert {type: 'json'};

describe('Validate Terrain', () => {
    test('Should return error in case terrain is not an object', () => {
        const errors = validateTerrain({value: 1 as any, styleSpec: v8, style: {} as any});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('number');
        expect(errors[0].message).toContain('object');
        expect(errors[0].message).toContain('terrain');
    });

    test('Should return error in case terrain source is not a string', () => {
        const errors = validateTerrain({value: {source: 1 as any}, styleSpec: v8, style: {} as any});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('number');
        expect(errors[0].message).toContain('string');
        expect(errors[0].message).toContain('source');
    });

    test('Should return error in case of unknown property', () => {
        const errors = validateTerrain({value: {a: 1} as any, styleSpec: v8, style: {} as any});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('a');
        expect(errors[0].message).toContain('unknown');
    });

    test('Should return errors according to spec violations', () => {
        const errors = validateTerrain({value: {source: 1 as any, exaggeration: {} as any}, styleSpec: v8, style: {} as any});
        expect(errors).toHaveLength(2);
        expect(errors[0].message).toContain('number');
        expect(errors[0].message).toContain('string');
        expect(errors[0].message).toContain('source');
        expect(errors[1].message).toContain('number');
        expect(errors[1].message).toContain('object');
        expect(errors[1].message).toContain('exaggeration');
    });

    test('Should pass if everything is according to spec', () => {
        const errors = validateTerrain({value: {source: 'source-id', exaggeration: 0.2}, styleSpec: v8, style: {} as any});
        expect(errors).toHaveLength(0);
    });
});
