import {describe, test, expect} from 'vitest';
import {transpileToWebGL1} from './shaders';

describe('Shaders', () => {
    test('webgl2 to webgl1 transpiled shader should be identical', () => {
        const vertexSourceWebGL2 = `
            in vec3 aPos;
            uniform mat4 u_matrix;
            void main() {
                gl_Position = u_matrix * vec4(aPos, 1.0);
                gl_PointSize = 20.0;
            }`;
        const fragmentSourceWebGL2 = `
            out highp vec4 fragColor;
            void main() {
                fragColor = vec4(1.0, 0.0, 0.0, 1.0);
            }`;
        const vertexSourceWebGL1 = `
            attribute vec3 aPos;
            uniform mat4 u_matrix;
            void main() {
                gl_Position = u_matrix * vec4(aPos, 1.0);
                gl_PointSize = 20.0;
            }`;
        const fragmentSourceWebGL1 = `
            void main() {
                gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
            }`;
        const vertexSourceTranspiled = transpileToWebGL1('vertex', vertexSourceWebGL2);
        const fragmentSourceTranspiled = transpileToWebGL1('fragment', fragmentSourceWebGL2);
        expect(vertexSourceTranspiled.trim()).equals(vertexSourceWebGL1.trim());
        expect(fragmentSourceTranspiled.trim()).equals(fragmentSourceWebGL1.trim());
    });

    test('built-in shaders should be written in WebGL2', () => {
    });

    test('built-in shaders should be able to transpiled to WebGL1', () => {
    });
});
