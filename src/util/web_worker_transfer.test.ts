import {AJAXError} from './ajax';
import {register, serialize, deserialize} from './web_worker_transfer';

const mockTransfer = (input, transferables?) => {
    const serialized = serialize(input, transferables);
    return deserialize(structuredClone(serialized, {transfer: transferables}));
};

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
                this.blob = new Blob(['Test'], {type: 'application/text'});
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
        const deserialized = mockTransfer(serializableMock, transferables) as SerializableMock;
        expect(deserialized instanceof SerializableMock).toBeTruthy();
        expect(transferables[0] === serializableMock.buffer).toBeTruthy();
        expect(serializableMock.buffer.byteLength).toBe(0);
        expect(deserialized.buffer.byteLength).toBe(100);
        expect(serializableMock !== deserialized).toBeTruthy();
        expect(deserialized.constructor === SerializableMock).toBeTruthy();
        expect(deserialized.n === 10).toBeTruthy();
        expect(serializableMock.blob.size).toBe(4);
        // seems to be a problem with jsdom + node. it works in
        // node and it works in browsers
        // expect(structuredClone(new Blob())).toBeInstanceOf(Blob);
        // expect(deserialized.blob.size).toBe(4);

        expect(deserialized._cached === undefined).toBeTruthy();
        expect(deserialized.squared() === 100).toBeTruthy();
    });

    test('anonymous class', () => {
        const Klass = (() => (class {}))();
        expect(!Klass.name).toBeTruthy();
        register('Anon', Klass);
        const x = new Klass();
        const deserialized = mockTransfer(x);
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

        const deserialized = mockTransfer(customSerialization) as CustomSerialization;
        expect(mockTransfer(customSerialization) instanceof CustomSerialization).toBeTruthy();
        expect(deserialized.id).toBe(customSerialization.id);
        expect(deserialized._deserialized).toBeTruthy();
    });

    test('AjaxError serialization', () => {
        const status = 404;
        const statusText = 'not found';
        const url = 'https://example.com';

        const ajaxError = new AJAXError(status, statusText, url, new Blob());
        const deserialized = mockTransfer(ajaxError) as AJAXError;
        expect(deserialized.status).toBe(404);
        expect(deserialized.statusText).toBe(statusText);
        expect(deserialized.url).toBe(url);
    });
});
