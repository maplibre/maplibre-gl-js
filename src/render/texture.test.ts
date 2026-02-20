import {describe, expect, test} from 'vitest';
import {Context} from '../gl/context';
import {Texture} from './texture';
import {RGBAImage, premultiplyAlpha} from '../util/image';

describe('Texture', () => {
    describe('glPixelStore state is reset after texture creation', () => {
        const testImage = new RGBAImage({
            width: 2,
            height: 1,
        }, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

        function getContext(): Context {
            const gl = document.createElement('canvas').getContext('webgl') as WebGL2RenderingContext;
            return new Context(gl);
        }

        function checkPixelStoreState(context: Context): void {
            expect(context.pixelStoreUnpack.current).toEqual(context.pixelStoreUnpack.default);
            expect(context.pixelStoreUnpackFlipY.current).toEqual(context.pixelStoreUnpackFlipY.default);
            expect(context.pixelStoreUnpackPremultiplyAlpha.current).toEqual(context.pixelStoreUnpackPremultiplyAlpha.default);
        }

        test('premultiply=false', () => {
            const context = getContext();
            // We test the Texture constructor's side effects
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _texture = new Texture(context, testImage, context.gl.RGBA, {premultiply: false});
            checkPixelStoreState(context);
        });

        test('premultiply=true', () => {
            const context = getContext();
            // We test the Texture constructor's side effects
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _texture = new Texture(context, testImage, context.gl.RGBA, {premultiply: true});
            checkPixelStoreState(context);
        });
    });

    test('bind restores handle after corruption (#2811)', () => {
        const gl = document.createElement('canvas').getContext('webgl') as WebGL2RenderingContext;
        const context = new Context(gl);
        const image = new RGBAImage({width: 2, height: 1}, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
        const texture = new Texture(context, image, gl.RGBA);

        const originalHandle = texture.texture;
        const bogusHandle = gl.createTexture();
        texture.texture = bogusHandle;

        texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        expect(texture.texture).toBe(originalHandle);
    });

    test('premultiplyAlpha produces correct output', () => {
        // pixel: r=200, g=100, b=50, a=128 (half transparent)
        const data = new Uint8Array([200, 100, 50, 128]);
        const result = premultiplyAlpha(data);
        expect(result[0]).toBe(Math.round(200 * 128 / 255)); // 100
        expect(result[1]).toBe(Math.round(100 * 128 / 255)); // 50
        expect(result[2]).toBe(Math.round(50 * 128 / 255));  // 25
        expect(result[3]).toBe(128);
    });
});
