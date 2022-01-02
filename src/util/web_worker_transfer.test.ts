import {register, serialize, deserialize} from './web_worker_transfer';

describe('web worker transfer', () => {
    test('round trip', () => {
        class SerializableMock {
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

        register('SerializableMock', SerializableMock, {omit: ['_cached']});

        const foo = new SerializableMock(10);
        const transferables = [];
        const deserialized = deserialize(serialize(foo, transferables));
        expect(deserialized instanceof SerializableMock).toBeTruthy();
        const bar = deserialized as SerializableMock;

        expect(foo !== bar).toBeTruthy();
        expect(bar.constructor === SerializableMock).toBeTruthy();
        expect(bar.n === 10).toBeTruthy();
        expect(bar.buffer === foo.buffer).toBeTruthy();
        expect(transferables[0] === foo.buffer).toBeTruthy();
        expect(bar._cached === undefined).toBeTruthy();
        expect(bar.squared() === 100).toBeTruthy();
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
