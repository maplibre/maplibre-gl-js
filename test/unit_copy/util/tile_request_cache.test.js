import '../../stub_loader';
import {test} from '../../util/test';
import {cacheGet, cachePut, cacheClose} from '../../../rollup/build/tsc/util/tile_request_cache';
import sinon from 'sinon';

test('tile_request_cache', (t) => {
    t.beforeEach(callback => {
        cacheClose();
        global.caches = sinon.stub();
        callback();
    });

    t.afterEach(callback => {
        delete global.caches;
        callback();
    });

    t.test('cachePut, no caches', (t) => {
        delete global.caches;

        let result;
        try {
            result = cachePut({url:''});
            t.pass('should return successfully');
            expect(result).toBeFalsy();
        } catch (e) {
            expect(e).toBeFalsy();
        }
        t.end();
    });

    t.test('cacheGet, no caches', (t) => {
        delete global.caches;

        cacheGet({url:''}, (result) => {
            expect(result).toBeFalsy();
            expect(result).toBe(null);
            t.end();
        });
    });

    t.test('cacheGet, cache open error', (t) => {
        global.caches.open = sinon.stub().rejects(new Error('The operation is insecure'));

        cacheGet({url:''}, (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toBe('The operation is insecure');
            t.end();
        });
    });

    t.test('cacheGet, cache match error', (t) => {
        const fakeCache = sinon.stub();
        fakeCache.match = sinon.stub().withArgs('someurl').rejects(new Error('ohno'));
        global.caches.open = sinon.stub().resolves(fakeCache);

        cacheGet({url:'someurl'}, (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toBe('ohno');
            t.end();
        });
    });

    t.test('cacheGet, happy path', (t) => {
        const fakeResponse = {
            headers: {get: sinon.stub()},
            clone: sinon.stub(),
            body: 'yay'
        };
        fakeResponse.headers.get.withArgs('Expires').returns('2300-01-01');
        fakeResponse.headers.get.withArgs('Cache-Control').returns(null);
        fakeResponse.clone.returns(fakeResponse);

        const fakeCache = sinon.stub();
        fakeCache.match = sinon.stub().withArgs('someurl').resolves(fakeResponse);
        fakeCache.delete = sinon.stub();
        fakeCache.put = sinon.stub();

        global.caches.open = sinon.stub().resolves(fakeCache);

        cacheGet({url:'someurl'}, (error, response, fresh) => {
            expect(error).toBeFalsy();
            expect(fakeCache.match.calledWith('someurl')).toBeTruthy();
            expect(fakeCache.delete.calledWith('someurl')).toBeTruthy();
            expect(response).toBeTruthy();
            expect(response.body).toBe('yay');
            expect(fresh).toBeTruthy();
            expect(fakeCache.put.calledWith('someurl', fakeResponse)).toBeTruthy();
            t.end();
        });
    });

    t.end();
});
