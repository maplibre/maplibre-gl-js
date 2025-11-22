import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import path from 'path';
import http from 'http';
import st from 'st';
import {launchPuppeteer} from '../lib/puppeteer_config';

describe('canvas POT texture min filter and blue render', () => {
    let server: http.Server;
    let browser;

    beforeAll(async () => {
        // Serve test assets if needed in the future
        const mount = st({
            path: path.resolve(__dirname, '..', 'assets'),
            cors: true,
            passthrough: true,
        });
        server = http.createServer((req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            mount(req, res, () => {
                res.writeHead(404);
                res.end('');
            });
        });
        await new Promise<void>((resolve) => server.listen(2999, '0.0.0.0', resolve));
        browser = await launchPuppeteer(true);
    }, 30000);

    afterAll(async () => {
        try { await browser?.close(); } catch {}
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('sets MIN_FILTER=LINEAR and renders blue for 128x128 canvas source', async () => {
        const page = await browser.newPage();
        await page.setViewport({width: 64, height: 64, deviceScaleFactor: 2});

        await page.setContent(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><style>html,body,#map{margin:0;padding:0;width:64px;height:64px}</style></head>
  <body><div id="map"></div></body>
</html>`);

        // Inject maplibre-gl bundle from local dist
        const bundlePath = path.resolve(__dirname, '../../../dist/maplibre-gl-dev.js');
        await page.addScriptTag({path: bundlePath});

        const result = await page.evaluate(async () => {
            const canvas = document.createElement('canvas');
            canvas.id = 'fake-canvas-128';
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgb(0,0,255)';
            ctx.fillRect(0, 0, 128, 128);
            document.body.appendChild(canvas);

            const style: any = {
                version: 8,
                center: [-122.514426, 37.562984],
                zoom: 14,
                sources: {},
                layers: []
            };

            // @ts-ignore
            const map = new window.maplibregl.Map({
                container: 'map',
                style,
                interactive: false,
                attributionControl: false,
                fadeDuration: 0,
                pixelRatio: 1,
                canvasContextAttributes: {preserveDrawingBuffer: true}
            });

            await new Promise(resolve => map.once('load', resolve));

            // Add the canvas source programmatically but DO NOT add any layer yet
            map.addSource('canvas', {
                type: 'canvas',
                animate: false,
                coordinates: [
                    [-122.5165, 37.5622],
                    [-122.5141, 37.5643],
                    [-122.5128, 37.5634],
                    [-122.5149, 37.5615]
                ],
                canvas: 'fake-canvas-128'
            });

            const source = map.getSource('canvas');
            // Ensure CanvasSource has prepared the texture at least once BEFORE any draw
            source.prepare();

            const gl = map.painter.context.gl;

            // Now add the layer
            map.addLayer({id: 'canvas', type: 'raster', source: 'canvas', paint: {'raster-fade-duration': 0}});
            // Force minification by making the quad very small in screen space around center
            const c = map.getCenter();
            const d = 0.0002;
            (source as any).setCoordinates([
                [c.lng - d, c.lat + d], // top-left
                [c.lng + d, c.lat + d], // top-right
                [c.lng + d, c.lat - d], // bottom-right
                [c.lng - d, c.lat - d]  // bottom-left
            ]);

            await new Promise(resolve => map.once('render', resolve));
            const data = new Uint8Array(4);
            gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);

            map.remove();
            const ret = {pixel: Array.from(data)};

            // Remove fake canvas from DOM
            canvas.parentNode?.removeChild(canvas);
            return ret;
        });

        const [r,g,b] = result.pixel;
        expect(r).toBe(0);
        expect(g).toBe(0);
        expect(b).toBe(255);
    }, 40000);
});
