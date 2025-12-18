import {describe, beforeEach, test, expect, vitest} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';

beforeEach(() => {
    beforeMapTest();
});

describe('setGlobalStateProperty', () => {
    test('sets state', async () => {
        const map = createMap({
            style: {
                version: 8,
                state: {
                    backgroundColor: {
                        default: 'red'
                    }
                },
                sources: {},
                layers: [{
                    id: 'background',
                    type: 'background',
                    paint: {
                        'background-color': ['global-state', 'backgroundColor']
                    }
                }]
            }
        });

        await map.once('style.load');
        map._update = vitest.fn();

        map.setGlobalStateProperty('backgroundColor', 'blue');

        expect(map.getGlobalState()).toEqual({backgroundColor: 'blue'});
        expect(map._update).toHaveBeenCalledWith(true);
    });

    test('resets state to default value when called with null', async () => {
        const map = createMap({
            style: {
                version: 8,
                state: {
                    backgroundColor: {
                        default: 'red'
                    }
                },
                sources: {},
                layers: [{
                    id: 'background',
                    type: 'background',
                    paint: {
                        'background-color': ['global-state', 'backgroundColor']
                    }
                }]
            }
        });

        await map.once('style.load');
        map._update = vitest.fn();

        map.setGlobalStateProperty('backgroundColor', 'blue');

        expect(map.getGlobalState()).toEqual({backgroundColor: 'blue'});
        expect(map._update).toHaveBeenCalledTimes(1);
        expect(map._update).toHaveBeenCalledWith(true);

        map.setGlobalStateProperty('backgroundColor', null);

        expect(map.getGlobalState()).toEqual({backgroundColor: 'red'});
        expect(map._update).toHaveBeenCalledTimes(2);
        expect(map._update).toHaveBeenNthCalledWith(2, true);
    });
});
