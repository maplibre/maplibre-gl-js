import {describe, test, expect} from 'vitest';
import {transpileToWebGL1} from './shaders';
import {globSync} from 'glob';
import fs from 'fs';

describe('Shaders', () => {
    test('`transpileToWebGL1()` should throw for unexpected type', () => {
        //@ts-expect-error
        expect(() => transpileToWebGL1('invalid', '')).toThrow();
    });

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

    // reference: https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html
    test('built-in shaders should be written in WebGL2', () => {
        const shaderFiles = globSync('./*.glsl');
        for (const shaderFile of shaderFiles) {
            const shaderSource = fs.readFileSync(shaderFile, 'utf8');
            expect(shaderSource.includes('attribute')).toBe(false);
            expect(shaderSource.includes('varying')).toBe(false);
            expect(shaderSource.includes('gl_FragColor')).toBe(false);
            expect(shaderSource.includes('texture2D')).toBe(false);
        }
    });

    test('built-in shaders should be able to `transpileToWebGL1()`', () => {
        const vertexShaderFiles = globSync('./*.vertex.glsl');
        for (const vertexShaderFile of vertexShaderFiles) {
            const vertexShaderSource = fs.readFileSync(vertexShaderFile, 'utf8');
            const vertexShaderTranspiled = transpileToWebGL1('vertex', vertexShaderSource);
            expect(vertexShaderSource.trim()).not.equals(vertexShaderTranspiled.trim());
        }
        const fragmentShaderFiles = globSync('./*.fragment.glsl');
        for (const fragmentShaderFile of fragmentShaderFiles) {
            const fragmentShaderSource = fs.readFileSync(fragmentShaderFile, 'utf8');
            const fragmentShaderTranspiled = transpileToWebGL1('fragment', fragmentShaderSource);
            expect(fragmentShaderSource.trim()).not.equals(fragmentShaderTranspiled.trim());
        }
    });
});
