import {describe, test, expect} from 'vitest';
import fs from 'fs';
import path from 'path';

describe('ESM build', () => {
    test('ESM main bundle exists and exports expected API', () => {
        const esmPath = path.join(process.cwd(), 'dist/maplibre-gl-dev.mjs');
        expect(fs.existsSync(esmPath)).toBe(true);
        
        const content = fs.readFileSync(esmPath, 'utf8');
        
        // Check for ES module exports at the end of the file
        expect(content).toMatch(/export\s+\{[^}]+\};\s*$/m);
        expect(content).toContain('Map');
        expect(content).toContain('Marker');
        expect(content).toContain('Popup');
        expect(content).toContain('setWorkerUrl');
        expect(content).toContain('getWorkerUrl');
        
        // The bundle should use ES module format (export statements)
        // Note: Some dependencies may contain module.exports internally,
        // but the bundle itself should export using ES module syntax
        expect(content).toMatch(/^export\s+\{/m);
    });
    
    test('ESM worker bundle exists', () => {
        const workerPath = path.join(process.cwd(), 'dist/maplibre-gl-worker-dev.mjs');
        expect(fs.existsSync(workerPath)).toBe(true);
        
        const content = fs.readFileSync(workerPath, 'utf8');
        
        // Worker should be an ES module
        // The worker doesn't export anything but should not use AMD
        expect(content).not.toContain('define.amd');
        
        // Should contain worker-specific code
        expect(content).toContain('Actor');
    });
    
    test('Production ESM builds exist', () => {
        // These might not exist if only dev build was run
        const mainProd = path.join(process.cwd(), 'dist/maplibre-gl.mjs');
        const workerProd = path.join(process.cwd(), 'dist/maplibre-gl-worker.mjs');
        
        if (fs.existsSync(mainProd)) {
            const content = fs.readFileSync(mainProd, 'utf8');
            // Production build is minified, just check for export statement
            expect(content).toContain('export');
        }
        
        if (fs.existsSync(workerProd)) {
            const content = fs.readFileSync(workerProd, 'utf8');
            // Should be ES module format with export statement
            expect(content).toContain('export');
        }
    });
    
    test('CSP ESM builds follow same pattern', () => {
        const cspMain = path.join(process.cwd(), 'dist/maplibre-gl-csp-dev.mjs');
        const cspWorker = path.join(process.cwd(), 'dist/maplibre-gl-csp-worker-dev.mjs');
        
        if (fs.existsSync(cspMain)) {
            const content = fs.readFileSync(cspMain, 'utf8');
            expect(content).toContain('export {');
            // Should be ES module format with export statement
            expect(content).toContain('export');
        }
        
        if (fs.existsSync(cspWorker)) {
            const content = fs.readFileSync(cspWorker, 'utf8');
            // Should be ES module format with export statement
            expect(content).toContain('export');
        }
    });
});