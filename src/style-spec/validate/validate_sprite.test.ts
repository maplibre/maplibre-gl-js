import validateSprite from './validate_sprite';
import validateSpec from './validate';

describe('Validate Sprite', () => {
    test('Should return error if type is not string or array', () => {
        let errors = validateSprite({validateSpec, key: 'sprite', value: 3});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('sprite: string expected, number found');

        errors = validateSprite({validateSpec, key: 'sprite', value: true});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('sprite: string expected, boolean found');

        errors = validateSprite({validateSpec, key: 'sprite', value: null});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('sprite: string expected, null found');

        errors = validateSprite({validateSpec, key: 'sprite', value: {x: 1, y: 1}});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('sprite: string expected, object found');
    });

    test('Should pass if type is string', () => {
        const errors = validateSprite({validateSpec, key: 'sprite', value: 'url'});
        expect(errors).toHaveLength(0);
    });

    test('Should return error if array contains non-object values', () => {
        let errors = validateSprite({validateSpec, key: 'sprite', value: ['1']});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('sprite[0]: object expected, string found');

        errors = validateSprite({validateSpec, key: 'sprite', value: [true]});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('sprite[0]: object expected, boolean found');

        errors = validateSprite({validateSpec, key: 'sprite', value: [3]});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('sprite[0]: object expected, number found');

        errors = validateSprite({validateSpec, key: 'sprite', value: [{id: 'id1', url: 'url1'}, {id: 'id2', url: 'url2'}, false]});
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toBe('sprite[2]: object expected, boolean found');

        errors = validateSprite({validateSpec, key: 'sprite', value: ['string', {id: 'id1', url: 'url1'}, {id: 'id2', url: 'url2'}, false]});
        expect(errors).toHaveLength(2);
        expect(errors[0].message).toBe('sprite[0]: object expected, string found');
        expect(errors[1].message).toBe('sprite[3]: object expected, boolean found');
    });

    test('Should return error if array\'s objects are not of form {id: string, url: string}', () => {
        let errors = validateSprite({validateSpec, key: 'sprite', value: [{id: 2, url: 2}]});
        expect(errors).toHaveLength(2);
        expect(errors[0].message).toBe('sprite[0].id: string expected, number found');
        expect(errors[1].message).toBe('sprite[0].url: string expected, number found');

        errors = validateSprite({validateSpec, key: 'sprite', value: [{test: 'string'}]});
        expect(errors).toHaveLength(3);
        expect(errors[0].message).toBe('sprite[0]: unknown property "test"');
        expect(errors[1].message).toBe('sprite[0]: missing required property "id"');
        expect(errors[2].message).toBe('sprite[0]: missing required property "url"');
    });

    test('Should return error if array\'s objects contain duplicated IDs or URLs', () => {
        const errors = validateSprite({validateSpec, key: 'sprite', value: [{id: 'id1', url: 'url1'}, {id: 'id1', url: 'url1'}]});
        expect(errors).toHaveLength(2);
        expect(errors[0].message).toBe('sprite: all the sprites\' ids must be unique, but id1 is duplicated');
        expect(errors[1].message).toBe('sprite: all the sprites\' URLs must be unique, but url1 is duplicated');
    });

    test('Should pass if correct array of objects', () => {
        const errors = validateSprite({validateSpec, key: 'sprite', value: [{id: 'id1', url: 'url1'}, {id: 'id2', url: 'url2'}, {id: 'id3', url: 'url3'}]});
        expect(errors).toHaveLength(0);
    });
});
