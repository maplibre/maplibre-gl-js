import {
    arrayBufferToCanvasImageSource,
    getArrayBuffer, getImage,
    getJSON, getVideo, makeXMLHttpRequest,
} from './ajax';
import config from './config';
import webpSupported from './webp_supported';
import {fakeServer, FakeServer, fakeXhr} from 'nise';
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

    describe('getImage', () => {
        test('ok', async () => {
            server.respondWith(request => {
                request.respond(200, undefined, new ArrayBuffer(0)[Symbol.toStringTag]);
            });

            try {
                const request = getImage({url: ''});
                server.respond();

                const response = await request.response;
                expect(response.data instanceof ImageBitmap || response.data instanceof HTMLImageElement).toBeTruthy();
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('404', async () => {
            server.respondWith(request => {
                request.respond(404);
            });

            const request = getImage({url: ''});
            server.respond();

            await expect(request.response).rejects.toBeInstanceOf(Error);
        });
    });

    describe('getVideo', () => {
        test('ok', async () => {
            try {
                const request = getVideo(['https://example.com/video']);
                // @ts-ignore
                request._testForceLoadStart();

                const response = await request.response;
                expect(response.data).toBeInstanceOf(HTMLVideoElement);
                expect(response.data.children).toHaveLength(1);
                expect((response.data.children[0] as HTMLSourceElement).src).toBe('https://example.com/video');
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('error', async () => {
            const request = getVideo(['https://example.com/video']);
            // @ts-ignore
            request._testForceError();

            await expect(request.response).rejects.toBeInstanceOf(Error);
        });
    });

    describe('makeXMLHttpRequest', () => {
        test('ok', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify({foo: 'bar'}));
            });

            try {
                const request = makeXMLHttpRequest({url: ''});
                server.respond();

                const response = await request.response;
                expect(response.data).toEqual(JSON.stringify({foo: 'bar'}));
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('respects request headers', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify({foo: 'bar'}));
            });

            try {
                makeXMLHttpRequest({url: '', headers: {foo: 'bar'}});
                server.respond();

                expect(server.requests[0].requestHeaders.foo).toBe('bar');
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('throws on cancel', async () => {
            server.respondWith(request => {
                request.respond(200, {'Content-Type': 'application/json'}, JSON.stringify({foo: 'bar'}));
            });

            const request = makeXMLHttpRequest({url: ''});
            request.cancel();
            server.respond();

            await expect(request.response).rejects.toStrictEqual(Error('cancel'));
        });
    });

    describe('arrayBufferToCanvasImageSource', () => {
        test('ok (via ImageBitmap)', async () => {
            const arrayBuffer = new ArrayBuffer(1);

            try {
                const promisedImage = arrayBufferToCanvasImageSource(arrayBuffer);

                const image = await promisedImage;
                expect(image).toBeInstanceOf(ImageBitmap);
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('error (bad input)', async () => {
            global.createImageBitmap = () => { throw new Error(); };

            const arrayBuffer = new ArrayBuffer(0);

            const promisedImage = arrayBufferToCanvasImageSource(arrayBuffer);

            await expect(promisedImage).rejects.toBeInstanceOf(Error);
        });

        test('ok (via HTMLImageElement)', async () => {
            global.createImageBitmap = null;
            global.URL.revokeObjectURL = () => {};

            const arrayBuffer = new ArrayBuffer(0);

            try {
                const promisedImage = arrayBufferToCanvasImageSource(arrayBuffer, true);

                const image = await promisedImage;
                expect(image).toBeInstanceOf(HTMLImageElement);
            } catch (err) {
                // should never execute
                expect(true).toBe(false);
            }
        });

        test('error (via HTMLImageElement)', async () => {
            global.createImageBitmap = null;
            global.URL.revokeObjectURL = () => {};

            const arrayBuffer = new ArrayBuffer(0);

            const promisedImage = arrayBufferToCanvasImageSource(arrayBuffer, false);

            await expect(promisedImage).rejects.toBeInstanceOf(Error);
        });
    });
});
