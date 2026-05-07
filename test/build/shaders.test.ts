import {describe, test, expect} from 'vitest';
import {globSync} from 'glob';
import fs from 'fs';

describe('Shaders', () => {
    // reference: https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html
    test('built-in shaders should be written in WebGL2', () => {
        const shaderFiles = globSync('../../src/shaders/glsl/*.glsl');
        for (const shaderFile of shaderFiles) {
            const shaderSource = fs.readFileSync(shaderFile, 'utf8');
            expect(shaderSource.includes('attribute')).toBe(false);
            expect(shaderSource.includes('varying')).toBe(false);
            expect(shaderSource.includes('gl_FragColor')).toBe(false);
            expect(shaderSource.includes('texture2D')).toBe(false);
        }
    });
});
