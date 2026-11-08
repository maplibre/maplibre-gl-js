import {describe, test, expect} from 'vitest';
import fs from 'fs';

describe('Node.js version', () => {
    test('docker-compose.yml node image is in sync with .nvmrc', () => {        
        const nvmrc = fs.readFileSync('.nvmrc', 'utf-8').trim();
        const compose = fs.readFileSync('docker-compose.yml', 'utf-8');
        const images = [...compose.matchAll(/^\s*image:\s*node:(\S+)/gm)].map(match => match[1]);
        expect(images.length).toBeGreaterThan(0);

        const expected = nvmrc.split('.')[0];
        for (const image of images) {
            expect(image.split('.')[0], `docker-compose.yml uses node:${image} but .nvmrc says ${nvmrc}, update both together`).toBe(expected);
        }
    });
});
