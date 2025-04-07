import {describe, expect, test} from 'vitest';
import {Context} from '../gl/context';
import {Texture} from './texture';
import {RGBAImage} from '../util/image';

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
});
