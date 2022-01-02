import '../../stub_loader';
import {cacheGet, cachePut, cacheClose} from '../util/tile_request_cache';
import sinon from 'sinon';

describe('tile_request_cache', done => {
    t.beforeEach(callback => {
        cacheClose();
        global.caches = sinon.stub();
        callback();
    });

    t.afterEach(callback => {
        delete global.caches;
        callback();
    });

    test('cachePut, no caches', done => {
        delete global.caches;

        let result;
        try {
            result = cachePut({url:''});
            t.pass('should return successfully');
            expect(result).toBeFalsy();
        } catch (e) {
            expect(e).toBeFalsy();
        }
        done();
    });

    test('cacheGet, no caches', done => {
        delete global.caches;

        cacheGet({url:''}, (result) => {
            expect(result).toBeFalsy();
            expect(result).toBeNull();
            done();
        });
    });

    test('cacheGet, cache open error', done => {
        global.caches.open = sinon.stub().rejects(new Error('The operation is insecure'));

        cacheGet({url:''}, (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toBe('The operation is insecure');
            done();
        });
    });

    test('cacheGet, cache match error', done => {
        const fakeCache = sinon.stub();
        fakeCache.match = sinon.stub().withArgs('someurl').rejects(new Error('ohno'));
        global.caches.open = sinon.stub().resolves(fakeCache);

        cacheGet({url:'someurl'}, (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toBe('ohno');
            done();
        });
    });

    test('cacheGet, happy path', done => {
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
            done();
        });
    });

    done();
});
