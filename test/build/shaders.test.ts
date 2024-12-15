import {transpileVertexShaderToWebGL1, transpileFragmentShaderToWebGL1} from '../../src/shaders/shaders';
import {describe, test, expect} from 'vitest';
import {globSync} from 'glob';
import fs from 'fs';

describe('Shaders', () => {
    test('webgl2 to webgl1 transpiled shaders should be identical', () => {
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
        const vertexSourceTranspiled = transpileVertexShaderToWebGL1(vertexSourceWebGL2);
        const fragmentSourceTranspiled = transpileFragmentShaderToWebGL1(fragmentSourceWebGL2);
        expect(vertexSourceTranspiled.trim()).equals(vertexSourceWebGL1.trim());
        expect(fragmentSourceTranspiled.trim()).equals(fragmentSourceWebGL1.trim());
    });

    // reference: https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html
    test('built-in shaders should be written in WebGL2', () => {
        const shaderFiles = globSync('../../src/shaders/*.glsl');
        for (const shaderFile of shaderFiles) {
            const shaderSource = fs.readFileSync(shaderFile, 'utf8');
            expect(shaderSource.includes('attribute')).toBe(false);
            expect(shaderSource.includes('varying')).toBe(false);
            expect(shaderSource.includes('gl_FragColor')).toBe(false);
            expect(shaderSource.includes('texture2D')).toBe(false);
        }
    });
});
