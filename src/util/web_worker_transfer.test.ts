import {register, serialize, deserialize} from './web_worker_transfer';

describe('web worker transfer', () => {
    test('round trip', () => {
        class Foo {
        n;
        buffer;
        _cached;

        constructor(n) {
            this.n = n;
            this.buffer = new ArrayBuffer(100);
            this.squared();
        }

        squared() {
            if (this._cached) {
                return this._cached;
            }
            this._cached = this.n * this.n;
            return this._cached;
        }
        }

        register('Foo', Foo, {omit: ['_cached']});

        const foo = new Foo(10);
        const transferables = [];
        const deserialized = deserialize(serialize(foo, transferables));
        expect(deserialized instanceof Foo).toBeTruthy();
        const bar = deserialized;

        expect(foo !== bar).toBeTruthy();
        expect(bar.constructor === Foo).toBeTruthy();
        expect((bar as any).n === 10).toBeTruthy();
        expect((bar as any).buffer === foo.buffer).toBeTruthy();
        expect(transferables[0] === foo.buffer).toBeTruthy();
        expect((bar as any)._cached === undefined).toBeTruthy();
        expect((bar as any).squared() === 100).toBeTruthy();
    });

    test('anonymous class', () => {
        const Klass = (() => (class {}))();
        expect(!Klass.name).toBeTruthy();
        register('Anon', Klass);
        const x = new Klass();
        const deserialized = deserialize(serialize(x));
        expect(deserialized instanceof Klass).toBeTruthy();
    });

    test('custom serialization', () => {
        class Bar {
        id;
        _deserialized;
        constructor(id) {
            this.id = id;
            this._deserialized = false;
        }

        static serialize(b) {
            return {foo: `custom serialization,${b.id}`};
        }

        static deserialize(input) {
            const b = new Bar(input.foo.split(',')[1]);
            b._deserialized = true;
            return b;
        }
        }

        register('Bar', Bar);

        const bar = new Bar('a');
        expect(!bar._deserialized).toBeTruthy();

        const deserialized = deserialize(serialize(bar));
        expect(deserialized instanceof Bar).toBeTruthy();
        const bar2 = deserialized;
        expect((bar2 as any).id).toBe(bar.id);
        expect((bar2 as any)._deserialized).toBeTruthy();
    });
});
