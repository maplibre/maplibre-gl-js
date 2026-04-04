/**
 * WebGL2 Renderer for MapLibre GL JS
 *
 * This is the WebGL2-specific rendering backend. It handles:
 * - WebGL2 context and state management
 * - GLSL shader compilation and program caching
 * - Buffer/texture management via WebGL2RenderingContext
 * - Stencil clipping for tile-based rendering
 * - Draw call submission via gl.drawElements
 *
 * The shared code (style, tiles, layout, projection) lives outside this module.
 * This renderer speaks raw WebGL2 — no luma.gl, no HAL.
 *
 * This is the legacy backend. New features are added to WebGPU first.
 * Eventually this will be removed when WebGPU adoption is sufficient.
 */

// TODO: This file will be populated as we extract WebGL2-specific code from:
// - drawable.ts (_drawWebGL method)
// - painter.ts (GL state management)
// - context.ts (WebGL2 state cache)
// - program.ts (GLSL compilation)
//
// Phase 3 of the renderer restructuring will move code here.

export class WebGL2Renderer {
    readonly type = 'webgl2' as const;

    gl: WebGL2RenderingContext;
    canvas: HTMLCanvasElement;

    width = 0;
    height = 0;
    pixelRatio = 1;

    constructor(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) {
        this.gl = gl;
        this.canvas = canvas;
    }

    resize(width: number, height: number, pixelRatio: number): void {
        this.width = Math.floor(width * pixelRatio);
        this.height = Math.floor(height * pixelRatio);
        this.pixelRatio = pixelRatio;
    }

    destroy(): void {
        // WebGL context cleanup
    }
}
