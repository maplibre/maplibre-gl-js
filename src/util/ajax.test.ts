import {
    getArrayBuffer,
    getJSON,
} from './ajax';
import config from './config';
import webpSupported from './webp_supported';
import {fakeServer, FakeServer} from 'nise';
import {stubAjaxGetImage} from './test/util';
import expect from 'expect';

function readAsText(blob) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = () => reject(fileReader.error);
        fileReader.readAsText(blob);
    });
}

describe('ajax', () => {
    let server: FakeServer;
    beforeEach(() => {
        global.fetch = null;
        server = fakeServer.create();
    });
    afterEach(() => {
        server.restore();
    });

    describe('getJSON', () => {
        test('ok', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, '{"foo": "bar"}');
            });

            try {
                const request = getJSON({url: ''});
                server.respond();

                const response = await request.response;
                expect(response.data).toEqual({foo: 'bar'});
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('404', async () => {
            server.respondWith(request => {
                request.respond(404);
            });

            const request = getJSON({url: ''});
            server.respond();

            await expect(request.response).rejects.toBeInstanceOf(Error);
        });

        test('invalid json', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, 'how do i even');
            });

            const request = getJSON({url: ''});
            server.respond();

            await expect(request.response).rejects.toBeInstanceOf(SyntaxError);
        });
    });

    describe('getArrayBuffer', () => {
        test('ok', async () => {
            server.respondWith(request => {
                request.respond(200, undefined, new ArrayBuffer(0)[Symbol.toStringTag]);
            });

            try {
                const request = getArrayBuffer({url: ''});
                server.respond();

                const response = await request.response;
                expect(response.data).toBeInstanceOf(ArrayBuffer);
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('404', async () => {
            server.respondWith(request => {
                request.respond(404);
            });

            const request = getArrayBuffer({url: ''});
            server.respond();

            await expect(request.response).rejects.toBeInstanceOf(Error);
        });
    });
});
