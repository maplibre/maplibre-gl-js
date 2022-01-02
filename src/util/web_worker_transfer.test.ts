import '../../stub_loader';
import {register, serialize, deserialize} from '../util/web_worker_transfer';

describe('round trip', done => {
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
    expect(bar.n === 10).toBeTruthy();
    expect(bar.buffer === foo.buffer).toBeTruthy();
    expect(transferables[0] === foo.buffer).toBeTruthy();
    expect(bar._cached === undefined).toBeTruthy();
    expect(bar.squared() === 100).toBeTruthy();
    done();
});

describe('anonymous class', done => {
    const Klass = (() => (class {}))();
    expect(!Klass.name).toBeTruthy();
    register('Anon', Klass);
    const x = new Klass();
    const deserialized = deserialize(serialize(x));
    expect(deserialized instanceof Klass).toBeTruthy();
    done();
});

describe('custom serialization', done => {
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
    expect(bar2.id).toBe(bar.id);
    expect(bar2._deserialized).toBeTruthy();
    done();
});

