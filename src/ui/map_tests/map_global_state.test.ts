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
    test('calls map._udpate', () => { 
        const map = createMap({
            style: {
                version: 8,
                state: {
                    backgroundColor: 'red'
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
            expect(map._update).toHaveBeenCalledWith(true);
        });
    });

    test('fires an error if new property value type does not match default property value type', () => new Promise<void>(done => { 
        const map = createMap({
            style: {
                version: 8,
                state: {
                    backgroundColor: 'red'
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
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/State property "backgroundColor" type "number" does not match expected type "string"./);

                done();
            });
            map.setGlobalStateProperty('backgroundColor', 1);
            expect(map._update).toHaveBeenCalledWith(true);
        });
    }));

    test('fires an error if new property value is an invalid expression', () => new Promise<void>(done => { 
        const map = createMap({
            style: {
                version: 8,
                state: {
                    backgroundColor: 'red'
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
            map.on('error', ({error}) => {
                expect(error.message).toMatch(/State property "backgroundColor" cannot be parsed: Unknown expression "does-not-exist". If you wanted a literal array, use \["literal", \[...]]/);
                done();
            });
            map.setGlobalStateProperty('backgroundColor', ['does-not-exist']);
        });
    }));
});
