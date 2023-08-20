import {Context} from './context';
import {RenderPool} from './render_pool';
import gl from 'gl';

describe('render pool', () => {
    const POOL_SIZE = 3;

    function createAndFillPool(): RenderPool {
        const pool = new RenderPool(new Context(gl(1, 1) as any), POOL_SIZE, 512);
        for (let i = 0; i < POOL_SIZE; i++) {
            pool.useObject(pool.getOrCreateFreeObject());
        }
        return pool;
    }

    test('create pool should not be full', () =>  {
        const pool = new RenderPool(new Context(gl(1, 1) as any), POOL_SIZE, 512);
        expect(pool.isFull()).toBeFalsy();
    });

    test('create pool should be full', () =>  {
        const pool = createAndFillPool();
        expect(() => pool.getOrCreateFreeObject()).toThrow('No free RenderPool available, call freeAllObjects() required!');
    });

    test('create pool and fill it', () =>  {
        const pool = createAndFillPool();
        expect(pool.isFull()).toBeTruthy();
    });

    test('check recently used after using two objects', () =>  {
        const pool = createAndFillPool();
        pool.freeAllObjects();
        const obj0 = pool.getObjectForId(0);
        pool.useObject(obj0);
        pool.freeAllObjects();
        const obj1 = pool.getOrCreateFreeObject();
        expect(obj1.id).toBe(1);
    });

    test('not full after freeing an object', () =>  {
        const pool = createAndFillPool();
        const obj = pool.getObjectForId(0);
        pool.freeObject(obj);
        expect(pool.isFull()).toBeFalsy();
        expect(obj.stamp).toBe(-1);
    });

    test('stamp object should get stamped', () =>  {
        const pool = createAndFillPool();
        const obj = pool.getObjectForId(0);
        pool.stampObject(obj);
        expect(obj.stamp).toBe(1);
    });

    test('free all objects, first object should be the first free object', () =>  {
        const pool = createAndFillPool();
        pool.freeAllObjects();
        expect(pool.getOrCreateFreeObject().id).toBe(0);
    });

    test('destruct should remove textures', () =>  {
        const pool = createAndFillPool();
        pool.destruct();
        expect(pool.getObjectForId(0).texture.texture).toBeNull();
    });
});
