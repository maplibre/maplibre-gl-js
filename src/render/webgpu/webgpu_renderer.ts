/**
 * WebGPU Renderer for MapLibre GL JS
 *
 * This is the WebGPU-specific rendering backend. It handles:
 * - GPU device and render pass management
 * - WGSL shader compilation and pipeline caching
 * - Buffer/texture uploads via GPUDevice
 * - Stencil clipping for tile-based rendering
 * - Draw call submission via GPURenderPassEncoder
 *
 * The shared code (style, tiles, layout, projection) lives outside this module.
 * This renderer speaks raw WebGPU — no luma.gl, no HAL.
 *
 * Reference: maplibre-native/src/mbgl/webgpu/ for the C++ equivalent.
 */

// TODO: This file will be populated as we extract WebGPU-specific code from:
// - drawable.ts (_drawWebGPU method)
// - painter.ts (WebGPU render pass, stencil clipping)
// - map.ts (device initialization)
//
// Phase 2 of the renderer restructuring will move code here.

export class WebGPURenderer {
    readonly type = 'webgpu' as const;

    device: GPUDevice;
    canvas: HTMLCanvasElement;
    context: GPUCanvasContext;
    depthStencilTexture: GPUTexture | null = null;

    // Pipeline cache
    private _pipelines: Map<string, GPURenderPipeline> = new Map();
    private _shaderModules: Map<string, GPUShaderModule> = new Map();

    width = 0;
    height = 0;
    pixelRatio = 1;

    constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
        this.device = device;
        this.canvas = canvas;
        this.context = canvas.getContext('webgpu') as GPUCanvasContext;
        this.context.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied',
        });
    }

    resize(width: number, height: number, pixelRatio: number): void {
        this.width = Math.floor(width * pixelRatio);
        this.height = Math.floor(height * pixelRatio);
        this.pixelRatio = pixelRatio;
    }

    destroy(): void {
        this.depthStencilTexture?.destroy();
        this._pipelines.clear();
        this._shaderModules.clear();
    }
}
