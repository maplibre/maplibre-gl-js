import {cacheGet, cachePut, cacheClose} from './tile_request_cache';

describe('tile_request_cache', () => {
    beforeEach(() => {
        cacheClose();
        global.caches = {
            delete: jest.fn(),
            has: jest.fn(),
            keys: jest.fn(),
            match: jest.fn(),
            open: jest.fn(),
        };
    });

    afterEach(() => {
        delete global.caches;
    });

    test('cachePut, no caches', done => {
        delete global.caches;

        let result;
        try {
            result = cachePut({url:''} as Request, undefined, undefined);
            expect(result).toBeFalsy();
        } catch (e) {
            expect(e).toBeFalsy();
        }
        done();
    });

    test('cacheGet, no caches', done => {
        delete global.caches;

        cacheGet({url:''} as Request, (result) => {
            expect(result).toBeFalsy();
            expect(result).toBeNull();
            done();
        });
    });

    test('cacheGet, cache open error', done => {
        global.caches.open = jest.fn().mockRejectedValue(new Error('The operation is insecure'));

        cacheGet({url:''} as Request, (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toBe('The operation is insecure');
            done();
        });
    });

    test('cacheGet, cache match error', done => {
        const fakeCache = {
            match: jest.fn().mockRejectedValue(new Error('ohno')),
        };
        global.caches.open = jest.fn().mockResolvedValue(fakeCache);

        cacheGet({url:'someurl'} as Request, (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toBe('ohno');
            done();
        });
    });

    test('cacheGet, happy path', done => {
        const fakeResponse = {
            headers: {
                get: jest.fn().mockImplementation(arg => {
                    if (arg === 'Expires') {
                        return '2300-01-01';
                    }
                    if (arg === 'Cache-Control') {
                        return null;
                    }
                })
            },
            clone: jest.fn(),
            body: 'yay'
        };
        fakeResponse.clone.mockReturnValue(fakeResponse);

        const fakeCache = {
            match: jest.fn().mockResolvedValue(fakeResponse),
            delete: jest.fn(),
            put: jest.fn(),
        };
        global.caches.open = jest.fn().mockResolvedValue(fakeCache);

        cacheGet({url:'someurl'} as Request, (error, response, fresh) => {
            expect(error).toBeFalsy();
            expect(fakeCache.match).toHaveBeenCalledWith('someurl');
            expect(fakeCache.delete).toHaveBeenCalledWith('someurl');
            expect(response).toBeTruthy();
            expect(response.body).toBe('yay');
            expect(fresh).toBeTruthy();
            expect(fakeCache.put).toHaveBeenCalledWith('someurl', fakeResponse);
            done();
        });
    });

});
