import {register, serialize, deserialize} from './web_worker_transfer';

describe('web worker transfer', () => {
    test('round trip', () => {
        class SerializableMock {
            n;
            buffer;
            blob;
            _cached;

            constructor(n) {
                this.n = n;
                this.buffer = new ArrayBuffer(100);
                this.blob = new Blob();
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

        const serializableMock = new SerializableMock(10);
        const transferables = [];
        const deserialized = deserialize(serialize(serializableMock, transferables)) as SerializableMock;
        expect(deserialize(serialize(serializableMock, transferables)) instanceof SerializableMock).toBeTruthy();

        expect(serializableMock !== deserialized).toBeTruthy();
        expect(deserialized.constructor === SerializableMock).toBeTruthy();
        expect(deserialized.n === 10).toBeTruthy();
        expect(deserialized.buffer === serializableMock.buffer).toBeTruthy();
        expect(deserialized.blob === serializableMock.blob).toBeTruthy();
        expect(transferables[0] === serializableMock.buffer).toBeTruthy();
        expect(deserialized._cached === undefined).toBeTruthy();
        expect(deserialized.squared() === 100).toBeTruthy();
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
        class CustomSerialization {
            id;
            _deserialized;
            constructor(id) {
                this.id = id;
                this._deserialized = false;
            }

            static serialize(b) {
                return {custom: `custom serialization,${b.id}`};
            }

            static deserialize(input) {
                const b = new CustomSerialization(input.custom.split(',')[1]);
                b._deserialized = true;
                return b;
            }
        }

        register('CustomSerialization', CustomSerialization);

        const customSerialization = new CustomSerialization('a');
        expect(!customSerialization._deserialized).toBeTruthy();

        const deserialized = deserialize(serialize(customSerialization)) as CustomSerialization;
        expect(deserialize(serialize(customSerialization)) instanceof CustomSerialization).toBeTruthy();
        expect(deserialized.id).toBe(customSerialization.id);
        expect(deserialized._deserialized).toBeTruthy();
    });
});
