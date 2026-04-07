import {TileLayerGroup} from '../gfx/tile_layer_group';
import {PipelineCache} from '../gfx/pipeline_cache';
import {UniformBlock} from '../gfx/uniform_block';
import type {LayerTweaker} from '../gfx/layer_tweaker';
import type {Painter} from '../render/painter';
import type {StyleLayer} from '../style/style_layer';
import type {OverscaledTileID} from '../tile/tile_id';

/**
 * Manages all WebGPU-specific rendering state and operations.
 * Owns the WebGPU render pass, depth/stencil textures, stencil clipping,
 * RTT (render-to-texture) passes, and the drawable architecture resources.
 *
 * Created by Painter when the device is WebGPU; accessed as painter.webgpu.
 */
export class WebGPUPainter {
    painter: Painter;
    device: any;

    // Current WebGPU render pass (GPURenderPassEncoder wrapper)
    renderPassWGSL?: any;
    // Saved main render pass (swapped with tile-RTT passes when terrain is active)
    _webgpuMainRenderPass?: any;
    // Per-tile RTT color textures (GPUTexture) keyed by stack+tile
    _webgpuRttTextures?: Map<string, any>;
    _webgpuRttDepthTexture?: any;

    _webgpuDepthStencilTexture: any;
    _webgpuStencilClipPipeline: any;
    _webgpuClipUBOBuffers: any[];
    _webgpuTileStencilRefs: { [_: string]: number };
    _webgpuNextStencilID: number;
    _webgpuCurrentStencilSource: string;

    // Drawable architecture fields
    layerGroups: Map<string, TileLayerGroup>;
    layerTweakers: Map<string, LayerTweaker>;
    pipelineCache: PipelineCache;
    globalUBO: UniformBlock;
    useDrawables: Set<string>;

    constructor(painter: Painter, device: any) {
        this.painter = painter;
        this.device = device;

        // Initialize WebGPU stencil state
        this._webgpuDepthStencilTexture = null;
        this._webgpuStencilClipPipeline = null;
        this._webgpuClipUBOBuffers = [];
        this._webgpuTileStencilRefs = {};
        this._webgpuNextStencilID = 1;
        this._webgpuCurrentStencilSource = '';

        // Initialize drawable architecture
        this.layerGroups = new Map();
        this.layerTweakers = new Map();
        this.pipelineCache = new PipelineCache();
        this.globalUBO = new UniformBlock(64); // GlobalPaintParamsUBO size
        this.useDrawables = new Set();

        // Drawables are ONLY used for WebGPU.
        // WebGL1/2 uses the original program.draw() path from main branch — unchanged.
        if (this.device && this.device.type === 'webgpu') {
            this.useDrawables.add('background');
            this.useDrawables.add('circle');
            this.useDrawables.add('fill');
            this.useDrawables.add('line');
            this.useDrawables.add('raster');
            this.useDrawables.add('fill-extrusion');
            this.useDrawables.add('symbol');
        }
    }

    /**
     * Begin a new WebGPU frame: create the depth/stencil texture, render pass,
     * set renderPassWGSL, and reset stencil state.
     * Called at the start of Painter.render() for WebGPU.
     */
    beginFrame(): void {
        try {
            // Create a fresh command encoder for this frame
            if ((this.device as any).beginFrame) {
                (this.device as any).beginFrame();
            }

            const gpuDevice = (this.device as any).handle;
            const canvasCtx = (this.device as any).canvasContext;
            const currentTexture = canvasCtx.handle.getCurrentTexture();
            const colorView = currentTexture.createView();

            // Create or reuse depth-stencil texture with stencil
            if (!this._webgpuDepthStencilTexture ||
                this._webgpuDepthStencilTexture.width !== currentTexture.width ||
                this._webgpuDepthStencilTexture.height !== currentTexture.height) {
                if (this._webgpuDepthStencilTexture) this._webgpuDepthStencilTexture.destroy();
                this._webgpuDepthStencilTexture = gpuDevice.createTexture({
                    size: [currentTexture.width, currentTexture.height],
                    format: 'depth24plus-stencil8',
                    usage: 16, // GPUTextureUsage.RENDER_ATTACHMENT
                });
            }
            const dsView = this._webgpuDepthStencilTexture.createView();

            // Use the device command encoder
            const commandEncoder = (this.device as any).commandEncoder.handle;
            const rpEncoder = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: colorView,
                    clearValue: {r: 0, g: 0, b: 0, a: 0},
                    loadOp: 'clear',
                    storeOp: 'store',
                }],
                depthStencilAttachment: {
                    view: dsView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                    stencilClearValue: 0,
                    stencilLoadOp: 'clear',
                    stencilStoreOp: 'store',
                },
            });

            // Wrap in object with .handle so _drawWebGPU can access the raw encoder
            this.renderPassWGSL = {handle: rpEncoder, _isRawEncoder: true};

            // Reset stencil state for this frame
            this._webgpuNextStencilID = 1;
            this._webgpuCurrentStencilSource = '';
            this._webgpuTileStencilRefs = {};
        } catch (e) {
            console.error('[WebGPUPainter.beginFrame] WebGPU RenderPass failed!', e);
        }
    }

    /**
     * End the WebGPU frame: end the render pass, submit the command buffer,
     * and clear renderPassWGSL and _webgpuMainRenderPass.
     * Called at the end of Painter.render() for WebGPU.
     */
    endFrame(): void {
        if (this.renderPassWGSL) {
            if (this.renderPassWGSL._isRawEncoder) {
                // Raw GPURenderPassEncoder — end and submit
                this.renderPassWGSL.handle.end();
                this.renderPassWGSL = null;
                this._webgpuMainRenderPass = null;
                if (this.device && (this.device as any).submit) {
                    (this.device as any).submit();
                }
            } else {
                this.renderPassWGSL.end();
                this.renderPassWGSL = null;
                this._webgpuMainRenderPass = null;
                if (this.device && (this.device as any).submit) {
                    (this.device as any).submit();
                }
            }
        }
    }

    /**
     * WebGPU stencil clipping: writes unique stencil IDs per tile.
     * Called before rendering layers that need tile clipping (fill, line, etc).
     */
    renderTileClippingMasks(layer: StyleLayer, tileIDs: Array<OverscaledTileID>, renderToTexture: boolean) {
        if (!this.renderPassWGSL || !tileIDs || !tileIDs.length) return;
        if (!layer.isTileClipped()) return;

        // Skip if we already rendered stencil masks for this source (same tiles)
        if (this._webgpuCurrentStencilSource === layer.source) return;
        this._webgpuCurrentStencilSource = layer.source;

        if (this._webgpuNextStencilID + tileIDs.length > 256) {
            this._webgpuNextStencilID = 1;
        }

        const gpuDevice = (this.device as any).handle;
        const rpEncoder = this.renderPassWGSL.handle;
        const projection = this.painter.style.projection;
        const transform = this.painter.transform;

        // Get or create stencil clipping pipeline
        if (!this._webgpuStencilClipPipeline) {
            const shaderCode = `
struct ClipUBO { matrix: mat4x4<f32> };
@group(0) @binding(0) var<uniform> clip: ClipUBO;

struct VertexInput { @location(0) pos: vec2<i32> };
struct VertexOutput { @builtin(position) position: vec4<f32> };

@vertex fn vertexMain(vin: VertexInput) -> VertexOutput {
    var vout: VertexOutput;
    let p = vec2<f32>(f32(vin.pos.x), f32(vin.pos.y));
    vout.position = clip.matrix * vec4<f32>(p, 0.0, 1.0);
    vout.position.z = (vout.position.z + vout.position.w) * 0.5;
    return vout;
}

@fragment fn fragmentMain() -> @location(0) vec4<f32> {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}`;
            const module = gpuDevice.createShaderModule({code: shaderCode});
            const canvasFormat = (navigator as any).gpu.getPreferredCanvasFormat();
            this._webgpuStencilClipPipeline = gpuDevice.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module,
                    entryPoint: 'vertexMain',
                    buffers: [{
                        arrayStride: 4, // 2x Int16
                        stepMode: 'vertex' as any,
                        attributes: [{shaderLocation: 0, format: 'sint16x2' as any, offset: 0}],
                    }],
                },
                fragment: {
                    module,
                    entryPoint: 'fragmentMain',
                    targets: [{
                        format: canvasFormat,
                        writeMask: 0, // Don't write to color buffer
                    }],
                },
                primitive: {topology: 'triangle-list'},
                depthStencil: {
                    format: 'depth24plus-stencil8',
                    depthWriteEnabled: false,
                    depthCompare: 'always',
                    stencilFront: {compare: 'always', passOp: 'replace', failOp: 'keep', depthFailOp: 'keep'},
                    stencilBack: {compare: 'always', passOp: 'replace', failOp: 'keep', depthFailOp: 'keep'},
                    stencilReadMask: 0xFF,
                    stencilWriteMask: 0xFF,
                },
            });
        }

        const pipeline = this._webgpuStencilClipPipeline;
        rpEncoder.setPipeline(pipeline);


        // Draw each tile's stencil mask with a unique ref.
        // Create a fresh UBO buffer per tile (matching native's approach) to avoid
        // writeBuffer race conditions with reused buffers.
        for (let i = 0; i < tileIDs.length; i++) {
            const tileID = tileIDs[i];
            const stencilRef = this._webgpuNextStencilID++;
            this._webgpuTileStencilRefs[tileID.key] = stencilRef;

            const mesh = projection.getMeshFromTileID(this.painter.context, tileID.canonical, false, true, 'stencil');
            const projectionData = transform.getProjectionData({
                overscaledTileID: tileID,
                applyGlobeMatrix: !renderToTexture,
                applyTerrainMatrix: true
            });

            // Create a mapped buffer with the matrix data baked in
            const matrixData = projectionData.mainMatrix as Float32Array;
            const clipUBOBuffer = gpuDevice.createBuffer({
                size: 64,
                usage: 64 | 8, // UNIFORM | COPY_DST
                mappedAtCreation: true,
            });
            new Float32Array(clipUBOBuffer.getMappedRange()).set(matrixData);
            clipUBOBuffer.unmap();

            const bindGroup = gpuDevice.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [{binding: 0, resource: {buffer: clipUBOBuffer}}],
            });

            rpEncoder.setStencilReference(stencilRef);
            rpEncoder.setBindGroup(0, bindGroup);
            rpEncoder.setVertexBuffer(0, mesh.vertexBuffer.webgpuBuffer.handle);
            rpEncoder.setIndexBuffer(mesh.indexBuffer.webgpuBuffer.handle, 'uint16');

            for (const segment of mesh.segments.get()) {
                const indexCount = segment.primitiveLength * 3;
                const firstIndex = segment.primitiveOffset * 3;
                rpEncoder.drawIndexed(indexCount, 1, firstIndex, segment.vertexOffset);
            }
        }
    }

    /**
     * Begin a WebGPU render pass targeting a tile's RTT texture.
     * The main render pass is saved and this tile pass becomes the active renderPassWGSL.
     * Call endRttPass() when done.
     */
    beginRttPass(key: string, size: number): any | null {
        if (!this.device || this.device.type !== 'webgpu') return null;
        const gpuDevice = (this.device as any).handle;
        if (!gpuDevice) return null;

        // Save current (main) render pass. Always overwrite since it changes each frame.
        // But only save if the current pass is NOT itself an RTT pass (nested RTT not supported).
        if (this.renderPassWGSL && !this.renderPassWGSL._isRtt) {
            this._webgpuMainRenderPass = this.renderPassWGSL;
        }

        if (!this._webgpuRttTextures) this._webgpuRttTextures = new Map();

        // Get or create RTT color texture for this key
        let colorTex = this._webgpuRttTextures.get(key);
        if (!colorTex || colorTex._size !== size) {
            if (colorTex) colorTex.destroy();
            colorTex = gpuDevice.createTexture({
                size: [size, size],
                format: (navigator as any).gpu.getPreferredCanvasFormat(),
                usage: 0x10 | 0x04, // RENDER_ATTACHMENT | TEXTURE_BINDING
            });
            colorTex._size = size;
            this._webgpuRttTextures.set(key, colorTex);
        }

        // Shared depth-stencil texture (reused across tiles since we clear each pass)
        if (!this._webgpuRttDepthTexture || this._webgpuRttDepthTexture._size !== size) {
            if (this._webgpuRttDepthTexture) this._webgpuRttDepthTexture.destroy();
            this._webgpuRttDepthTexture = gpuDevice.createTexture({
                size: [size, size],
                format: 'depth24plus-stencil8',
                usage: 0x10,
            });
            this._webgpuRttDepthTexture._size = size;
        }

        // Create a separate command encoder for this tile's RTT pass
        const cmdEncoder = gpuDevice.createCommandEncoder();
        const rpEncoder = cmdEncoder.beginRenderPass({
            colorAttachments: [{
                view: colorTex.createView(),
                clearValue: {r: 0, g: 0, b: 0, a: 0},
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: this._webgpuRttDepthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                stencilClearValue: 0,
                stencilLoadOp: 'clear',
                stencilStoreOp: 'store',
            },
        });

        // Swap the active render pass so subsequent draws target this tile
        this.renderPassWGSL = {handle: rpEncoder, _isRawEncoder: true, _cmdEncoder: cmdEncoder, _isRtt: true};

        // Reset stencil tracking for this isolated pass
        this._webgpuNextStencilID = 1;
        this._webgpuCurrentStencilSource = '';
        this._webgpuTileStencilRefs = {};

        return colorTex;
    }

    /**
     * End the current RTT render pass, submit it, and restore the main render pass.
     */
    endRttPass(): void {
        if (!this.renderPassWGSL || !this.renderPassWGSL._isRtt) return;
        const gpuDevice = (this.device as any).handle;
        try {
            this.renderPassWGSL.handle.end();
            const cmdBuffer = this.renderPassWGSL._cmdEncoder.finish();
            gpuDevice.queue.submit([cmdBuffer]);
        } catch (e) {
            console.error('[endRttPass] failed', e);
        }
        // Restore main render pass
        this.renderPassWGSL = this._webgpuMainRenderPass;
        // Restore main stencil tracking — masks will be re-written on demand
        this._webgpuNextStencilID = 1;
        this._webgpuCurrentStencilSource = '';
        this._webgpuTileStencilRefs = {};
    }

    /**
     * Get the WebGPU RTT texture for a given key (set by beginRttPass).
     */
    getRttTexture(key: string): any | null {
        return this._webgpuRttTextures?.get(key) || null;
    }

    /**
     * Get the WebGPU stencil reference for a tile (set during clipping mask pass).
     */
    getStencilRef(tileID: OverscaledTileID): number {
        const ref = this._webgpuTileStencilRefs?.[tileID.key];
        if (ref === undefined) {
            console.warn(`[STENCIL MISS] key=${tileID.key} z=${tileID.canonical.z} oZ=${tileID.overscaledZ} avail=[${Object.keys(this._webgpuTileStencilRefs || {}).slice(0, 8).join(',')}]`);
        }
        return ref ?? 0;
    }

    /**
     * Update the global UBO once per frame with camera/viewport parameters.
     * This UBO is shared across all drawables.
     */
    updateGlobalUBO(): void {
        const transform = this.painter.transform;
        const ubo = this.globalUBO;

        // GlobalPaintParamsUBO layout matches circle.wgsl:
        // pattern_atlas_texsize: vec2<f32>   offset 0
        // units_to_pixels: vec2<f32>         offset 8
        // world_size: vec2<f32>              offset 16
        // camera_to_center_distance: f32     offset 24
        // symbol_fade_change: f32            offset 28
        // aspect_ratio: f32                  offset 32
        // pixel_ratio: f32                   offset 36
        // map_zoom: f32                      offset 40
        // pad1: f32                          offset 44
        ubo.setVec2(0, 0, 0); // pattern_atlas_texsize - set if pattern atlas available
        ubo.setVec2(8,
            1 / transform.pixelsToGLUnits[0],
            1 / transform.pixelsToGLUnits[1]
        );
        ubo.setVec2(16, this.painter.width, this.painter.height);
        ubo.setFloat(24, transform.cameraToCenterDistance);
        ubo.setFloat(28, this.painter.symbolFadeChange || 0);
        ubo.setFloat(32, transform.width / transform.height);
        ubo.setFloat(36, this.painter.pixelRatio);
        ubo.setFloat(40, transform.zoom);
    }

    /**
     * Destroy all WebGPU-specific resources.
     */
    destroy(): void {
        if (this.layerGroups) {
            for (const group of this.layerGroups.values()) {
                group.destroy();
            }
            this.layerGroups.clear();
        }
        if (this.layerTweakers) {
            for (const tweaker of this.layerTweakers.values()) {
                tweaker.destroy();
            }
            this.layerTweakers.clear();
        }
        if (this.pipelineCache) {
            this.pipelineCache.destroy();
        }
        if (this.globalUBO) {
            this.globalUBO.destroy();
        }
        if (this._webgpuDepthStencilTexture) {
            this._webgpuDepthStencilTexture.destroy();
            this._webgpuDepthStencilTexture = null;
        }
        if (this._webgpuRttDepthTexture) {
            this._webgpuRttDepthTexture.destroy();
            this._webgpuRttDepthTexture = null;
        }
        if (this._webgpuRttTextures) {
            for (const tex of this._webgpuRttTextures.values()) {
                tex.destroy();
            }
            this._webgpuRttTextures.clear();
        }
    }
}
