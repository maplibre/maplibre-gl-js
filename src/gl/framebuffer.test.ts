import {describe, test, expect, vi} from 'vitest';
import {Context} from './context';
import {Framebuffer} from './framebuffer';

describe('Framebuffer', () => {
    test('constructor does not check framebuffer status before attachments are set', () => {
        const gl = document.createElement('canvas').getContext('webgl');
        vi.spyOn(gl, 'checkFramebufferStatus').mockReturnValue(0);
        const context = new Context(gl);

        expect(() => new Framebuffer(context, 256, 256, false, false)).not.toThrow();
    });

    test('checkFramebufferStatus throws when framebuffer is incomplete', () => {
        const gl = document.createElement('canvas').getContext('webgl');
        vi.spyOn(gl, 'checkFramebufferStatus').mockReturnValue(0);
        const context = new Context(gl);
        const fbo = new Framebuffer(context, 256, 256, false, false);

        expect(() => fbo.checkFramebufferStatus()).toThrow('Framebuffer is not complete');
    });
});
