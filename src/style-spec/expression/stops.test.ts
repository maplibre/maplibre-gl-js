import {findStopLessThanOrEqualTo} from './stops';

describe('findStopLessThanOrEqualTo', () => {
    test('When the input > all stops it returns the last stop.', () => {
        const index = findStopLessThanOrEqualTo([0, 1, 2, 3, 4, 5, 6, 7], 8);
        expect(index).toBe(7);
    });

    test('When more than one stop has the same value it always returns the last stop', () => {
        let index;

        index = findStopLessThanOrEqualTo([0.5, 0.5], 0.5);
        expect(index).toBe(1);

        index = findStopLessThanOrEqualTo([0.5, 0.5, 0.5], 0.5);
        expect(index).toBe(2);

        index = findStopLessThanOrEqualTo([0.4, 0.5, 0.5, 0.6, 0.7], 0.5);
        expect(index).toBe(2);

    });

});
