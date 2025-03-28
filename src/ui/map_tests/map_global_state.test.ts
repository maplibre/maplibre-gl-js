import {describe, beforeEach, afterEach, test, expect} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {fakeServer, type FakeServer} from 'nise';

let server: FakeServer;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});

describe('#setGlobalStateProperty', () => {
    test('sets state', () => {
        const map = createMap({
            style: {
                version: 8,
                state: {
                    backgroundColor: {
                        type: 'string',
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

        map.on('style.load', () => {
            map.setGlobalStateProperty('backgroundColor', 'blue');
            expect(map.getGlobalState()).toEqual({backgroundColor: 'blue'});
            expect(map._update).toHaveBeenCalledWith(true);
        });
    });

    test('resets state to default value when called with null', () => {
        const map = createMap({
            style: {
                version: 8,
                state: {
                    backgroundColor: {
                        type: 'string',
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

        map.on('style.load', () => {
            map.setGlobalStateProperty('backgroundColor', 'blue');
            expect(map.getGlobalState()).toEqual({backgroundColor: 'blue'});
            map.setGlobalStateProperty('backgroundColor', null);
            expect(map.getGlobalState()).toEqual({backgroundColor: 'red'});
            expect(map._update).toHaveBeenCalledWith(true);
        });
    });
});
