import {Texture} from './texture';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {DepthMode} from '../gl/depth_mode';
import {StencilMode} from '../gl/stencil_mode';
import {ColorMode} from '../gl/color_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {type Context} from '../gl/context';
import {type Framebuffer} from '../gl/framebuffer';
import {type Tile} from '../tile/tile';
import {
    heatmapUniformValues,
    heatmapTextureUniformValues
} from './program/heatmap_program';
import {HEATMAP_FULL_RENDER_FBO_KEY} from '../style/style_layer/heatmap_style_layer';
import {pixelsToTileUnits} from '../source/pixels_to_tile_units';
import {shaders} from '../shaders/shaders';
import {UniformBlock} from '../gfx/uniform_block';
import {mat4} from 'gl-matrix';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {HeatmapStyleLayer} from '../style/style_layer/heatmap_style_layer';
import type {HeatmapBucket} from '../data/bucket/heatmap_bucket';
import type {OverscaledTileID} from '../tile/tile_id';

export function drawHeatmap(painter: Painter, tileManager: TileManager, layer: HeatmapStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (layer.paint.get('heatmap-opacity') === 0) {
        return;
    }

    // WebGPU drawable path: both passes happen during 'translucent'
    // (offscreen uses a separate command encoder, then composite uses the main render pass)
    if (painter.device && painter.device.type === 'webgpu') {
        if (painter.renderPass === 'translucent') {
            prepareHeatmapWebGPU(painter, tileManager, layer, tileIDs);
            compositeHeatmapWebGPU(painter, layer);
        }
        return;
    }

    const context = painter.context;
    const {isRenderingToTexture, isRenderingGlobe} = renderOptions;

    if (painter.style.map.terrain) {
        for (const coord of tileIDs) {
            const tile = tileManager.getTile(coord);
            if (tileManager.hasRenderableParent(coord)) continue;
            if (painter.renderPass === 'offscreen') {
                prepareHeatmapTerrain(painter, tile, layer, coord, isRenderingGlobe);
            } else if (painter.renderPass === 'translucent') {
                renderHeatmapTerrain(painter, layer, coord, isRenderingToTexture, isRenderingGlobe);
            }
        }
        context.viewport.set([0, 0, painter.width, painter.height]);
    } else {
        if (painter.renderPass === 'offscreen') {
            prepareHeatmapFlat(painter, tileManager, layer, tileIDs);
        } else if (painter.renderPass === 'translucent') {
            renderHeatmapFlat(painter, layer);
        }

    }
}

/**
 * WebGPU heatmap Pass 1: Render kernel density to offscreen texture.
 * Called during 'offscreen' render pass (before main render pass starts).
 */
function prepareHeatmapWebGPU(painter: Painter, tileManager: TileManager, layer: HeatmapStyleLayer, tileIDs: Array<OverscaledTileID>) {
    const device = painter.device as any;
    const gpuDevice = device.handle;
    const transform = painter.transform;
    if (!gpuDevice) return;

    // Get or create offscreen texture (4x downscaled for performance)
    const fboWidth = Math.max(Math.floor(painter.width / 4), 1);
    const fboHeight = Math.max(Math.floor(painter.height / 4), 1);

    let heatmapState = (layer as any)._webgpuHeatmapState;
    if (!heatmapState || heatmapState.width !== fboWidth || heatmapState.height !== fboHeight) {
        if (heatmapState?.texture) heatmapState.texture.destroy();
        const texture = gpuDevice.createTexture({
            size: [fboWidth, fboHeight],
            format: 'rgba16float',
            usage: 0x10 | 0x04, // RENDER_ATTACHMENT | TEXTURE_BINDING
        });
        heatmapState = {texture, width: fboWidth, height: fboHeight};
        (layer as any)._webgpuHeatmapState = heatmapState;
    }

    // Create a separate command encoder for offscreen pass
    const offscreenEncoder = gpuDevice.createCommandEncoder();
    const offscreenPass = offscreenEncoder.beginRenderPass({
        colorAttachments: [{
            view: heatmapState.texture.createView(),
            clearValue: {r: 0, g: 0, b: 0, a: 0},
            loadOp: 'clear',
            storeOp: 'store',
        }],
    });

    // Get or create the heatmap pipeline (additive blending)
    let pipeline = (painter as any)._heatmapPipeline;
    if (!pipeline) {
        let wgslSource = (shaders as any).heatmapWgsl;
        if (!wgslSource) { offscreenPass.end(); gpuDevice.queue.submit([offscreenEncoder.finish()]); return; }

        // Generate VertexInput from a typical heatmap bucket
        // Heatmap has: a_pos (Int16 x2) + optional paint attributes (weight, radius)
        let vertexInputStruct = 'struct VertexInput {\n    @location(0) pos: vec2<i32>,\n};\n';
        const vertexBufferLayouts: any[] = [{
            arrayStride: 4, // 2 × Int16
            stepMode: 'vertex',
            attributes: [{shaderLocation: 0, format: 'sint16x2', offset: 0}],
        }];

        wgslSource = `${vertexInputStruct}\n${wgslSource}`;

        const shaderModule = gpuDevice.createShaderModule({code: wgslSource});
        pipeline = gpuDevice.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: vertexBufferLayouts,
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: 'rgba16float',
                    // Additive blending: src + dst (key for kernel density estimation)
                    blend: {
                        color: {srcFactor: 'one', dstFactor: 'one', operation: 'add'},
                        alpha: {srcFactor: 'one', dstFactor: 'one', operation: 'add'},
                    },
                }],
            },
            primitive: {topology: 'triangle-list', cullMode: 'none'},
        });
        (painter as any)._heatmapPipeline = pipeline;
    }

    offscreenPass.setPipeline(pipeline);

    // Render each tile's heatmap data
    const intensity = layer.paint.get('heatmap-intensity') as number || 1;
    const radiusVal = layer.paint.get('heatmap-radius').constantOr(undefined) as number ?? (layer.paint.get('heatmap-radius') as any)?.evaluate?.({zoom: transform.zoom}) ?? 30;
    const weightVal = layer.paint.get('heatmap-weight').constantOr(undefined) as number ?? (layer.paint.get('heatmap-weight') as any)?.evaluate?.({zoom: transform.zoom}) ?? 1;

    for (const coord of tileIDs) {
        if (tileManager.hasRenderableParent(coord)) continue;
        const tile = tileManager.getTile(coord);
        const bucket: HeatmapBucket = (tile.getBucket(layer) as any);
        if (!bucket || !bucket.layoutVertexBuffer || !bucket.indexBuffer) continue;

        const projectionData = transform.getProjectionData({overscaledTileID: coord, applyGlobeMatrix: true, applyTerrainMatrix: false});

        // Create UBOs

        // Drawable UBO (80 bytes: matrix + extrude_scale + _t factors)
        const drawableUBO = new UniformBlock(80);
        drawableUBO.setMat4(0, projectionData.mainMatrix as Float32Array);
        drawableUBO.setFloat(64, pixelsToTileUnits(tile, 1, transform.zoom));

        // Props UBO (16 bytes: weight + radius + intensity + pad, padded to 32 for WebGPU min)
        const propsUBO = new UniformBlock(32);
        propsUBO.setFloat(0, typeof weightVal === 'number' ? weightVal : 1);
        propsUBO.setFloat(4, typeof radiusVal === 'number' ? radiusVal : 30);
        propsUBO.setFloat(8, typeof intensity === 'number' ? intensity : 1);

        // GlobalIndex UBO
        const globalIndexUBO = new UniformBlock(32);
        globalIndexUBO.setInt(0, 0);

        // Upload and bind
        const globalIndexBuf = globalIndexUBO.upload(device);
        const drawableVecBuf = uploadAsStorage(device, drawableUBO);
        const propsBuf = propsUBO.upload(device);

        const bindGroup = gpuDevice.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {binding: 1, resource: {buffer: globalIndexBuf.handle}},
                {binding: 2, resource: {buffer: drawableVecBuf.handle}},
                {binding: 4, resource: {buffer: propsBuf.handle}},
            ],
        });

        offscreenPass.setBindGroup(0, bindGroup);

        if (!bucket.layoutVertexBuffer.webgpuBuffer) continue;
        offscreenPass.setVertexBuffer(0, bucket.layoutVertexBuffer.webgpuBuffer.handle);
        offscreenPass.setIndexBuffer(bucket.indexBuffer.webgpuBuffer.handle, 'uint16');

        for (const segment of bucket.segments.get()) {
            offscreenPass.drawIndexed(segment.primitiveLength * 3, 1, segment.primitiveOffset * 3, segment.vertexOffset);
        }
    }

    offscreenPass.end();
    gpuDevice.queue.submit([offscreenEncoder.finish()]);
}

/**
 * WebGPU heatmap Pass 2: Composite offscreen texture with color ramp.
 * Called during 'translucent' render pass (main render pass is active).
 */
function compositeHeatmapWebGPU(painter: Painter, layer: HeatmapStyleLayer) {
    const device = painter.device as any;
    const gpuDevice = device.handle;
    if (!gpuDevice) return;

    const heatmapState = (layer as any)._webgpuHeatmapState;
    if (!heatmapState) return;

    const mainRenderPass = (painter.renderPassWGSL as any)?.handle;
    if (!mainRenderPass) return;

    // Get or create color ramp GPU texture
    let colorRampGPU = (layer as any)._webgpuColorRamp;
    if (!colorRampGPU && layer.colorRamp) {
        const ramp = layer.colorRamp;
        colorRampGPU = gpuDevice.createTexture({
            size: [ramp.width, ramp.height],
            format: 'rgba8unorm',
            usage: 0x04 | 0x02, // TEXTURE_BINDING | COPY_DST
        });
        gpuDevice.queue.writeTexture(
            {texture: colorRampGPU},
            ramp.data,
            {bytesPerRow: ramp.width * 4},
            [ramp.width, ramp.height]
        );
        (layer as any)._webgpuColorRamp = colorRampGPU;
    }
    if (!colorRampGPU) return;

    // Get or create the composite pipeline
    let compositePipeline = (painter as any)._heatmapCompositePipeline;
    if (!compositePipeline) {
        let wgslSource = (shaders as any).heatmapTextureWgsl;
        if (!wgslSource) return;

        const vertexInputStruct = 'struct VertexInput {\n    @location(0) pos: vec2<i32>,\n};\n';
        wgslSource = `${vertexInputStruct}\n${wgslSource}`;

        const canvasFormat = (navigator as any).gpu.getPreferredCanvasFormat();
        const shaderModule = gpuDevice.createShaderModule({code: wgslSource});
        compositePipeline = gpuDevice.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [{
                    arrayStride: 4,
                    stepMode: 'vertex',
                    attributes: [{shaderLocation: 0, format: 'sint16x2', offset: 0}],
                }],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: canvasFormat,
                    blend: {
                        color: {srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add'},
                        alpha: {srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add'},
                    },
                }],
            },
            primitive: {topology: 'triangle-list', cullMode: 'none'},
            depthStencil: {
                format: 'depth24plus-stencil8',
                depthWriteEnabled: false,
                depthCompare: 'always',
            },
        });
        (painter as any)._heatmapCompositePipeline = compositePipeline;
    }

    // Create UBO for the composite pass
    const compositeUBO = new UniformBlock(80);
    // Ortho matrix: maps [0,width]x[0,height] to clip space (same as GL heatmapTextureUniformValues)
    const ortho = mat4.create();
    mat4.ortho(ortho, 0, painter.width, painter.height, 0, 0, 1);
    compositeUBO.setMat4(0, ortho as Float32Array);
    compositeUBO.setVec2(64, painter.width, painter.height);
    const opacityRaw = layer.paint.get('heatmap-opacity');
    const opacityVal = typeof opacityRaw === 'number' ? opacityRaw : (opacityRaw as any)?.constantOr?.(1) ?? 1;
    compositeUBO.setFloat(72, opacityVal);

    const globalIndexUBO2 = new UniformBlock(32);
    globalIndexUBO2.setInt(0, 0);

    const compositeVecBuf = uploadAsStorage(device, compositeUBO);
    const globalIndexBuf = globalIndexUBO2.upload(device);

    const compositeBindGroup = gpuDevice.createBindGroup({
        layout: compositePipeline.getBindGroupLayout(0),
        entries: [
            {binding: 1, resource: {buffer: globalIndexBuf.handle}},
            {binding: 2, resource: {buffer: compositeVecBuf.handle}},
        ],
    });

    // Texture bind group with heatmap FBO texture + color ramp
    const sampler = gpuDevice.createSampler({minFilter: 'linear', magFilter: 'linear'});
    const texBindGroup = gpuDevice.createBindGroup({
        layout: compositePipeline.getBindGroupLayout(1),
        entries: [
            {binding: 0, resource: sampler},
            {binding: 1, resource: heatmapState.texture.createView()},
            {binding: 2, resource: colorRampGPU.createView()},
        ],
    });

    mainRenderPass.setPipeline(compositePipeline);
    mainRenderPass.setBindGroup(0, compositeBindGroup);
    mainRenderPass.setBindGroup(1, texBindGroup);

    // Use the viewport buffer (fullscreen quad)
    if (!painter.viewportBuffer?.webgpuBuffer) return;
    mainRenderPass.setVertexBuffer(0, painter.viewportBuffer.webgpuBuffer.handle);
    mainRenderPass.setIndexBuffer(painter.quadTriangleIndexBuffer.webgpuBuffer.handle, 'uint16');
    mainRenderPass.drawIndexed(6, 1, 0, 0);
}

/** Upload UniformBlock as storage buffer */
function uploadAsStorage(device: any, ubo: any): any {
    if (!(ubo as any)._storageBuffer) {
        (ubo as any)._storageBuffer = device.createBuffer({
            byteLength: ubo._byteLength,
            usage: 128 | 8, // STORAGE | COPY_DST
        });
    }
    (ubo as any)._storageBuffer.write(new Uint8Array(ubo._data));
    return (ubo as any)._storageBuffer;
}

function prepareHeatmapFlat(painter: Painter, tileManager: TileManager, layer: HeatmapStyleLayer, coords: Array<OverscaledTileID>) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    // Allow kernels to be drawn across boundaries, so that
    // large kernels are not clipped to tiles
    const stencilMode = StencilMode.disabled;
    // Turn on additive blending for kernels, which is a key aspect of kernel density estimation formula
    const colorMode = new ColorMode([gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);

    bindFramebuffer(context, painter, layer);

    context.clear({color: Color.transparent});

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];

        // Skip tiles that have uncovered parents to avoid flickering; we don't need
        // to use complex tile masking here because the change between zoom levels is subtle,
        // so it's fine to simply render the parent until all its 4 children are loaded
        if (tileManager.hasRenderableParent(coord)) continue;

        const tile = tileManager.getTile(coord);
        const bucket: HeatmapBucket = (tile.getBucket(layer) as any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('heatmap', programConfiguration);

        const projectionData = transform.getProjectionData({overscaledTileID: coord, applyGlobeMatrix: true, applyTerrainMatrix: false});

        const radiusCorrectionFactor = transform.getCircleRadiusCorrection();

        program.draw(context, gl.TRIANGLES, DepthMode.disabled, stencilMode, colorMode, CullFaceMode.backCCW,
            heatmapUniformValues(tile, transform.zoom, layer.paint.get('heatmap-intensity'), radiusCorrectionFactor) as any,
            null, projectionData as any,
            layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
            bucket.segments, layer.paint, transform.zoom,
            programConfiguration);
    }

    context.viewport.set([0, 0, painter.width, painter.height]);
}

function renderHeatmapFlat(painter: Painter, layer: HeatmapStyleLayer) {
    const context = painter.context;
    const gl = context.gl;

    context.setColorMode(painter.colorModeForRenderPass());

    // Here we bind two different textures from which we'll sample in drawing
    // heatmaps: the kernel texture, prepared in the offscreen pass, and a
    // color ramp texture.
    const fbo = layer.heatmapFbos.get(HEATMAP_FULL_RENDER_FBO_KEY);
    if (!fbo) return;
    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    context.activeTexture.set(gl.TEXTURE1);
    const colorRampTexture = getColorRampTexture(context, layer);
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    const textureProgram = painter.useProgram('heatmapTexture');

    textureProgram.draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        heatmapTextureUniformValues(painter, layer, 0, 1) as any, null, null,
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}

function prepareHeatmapTerrain(painter: Painter, tile: Tile, layer: HeatmapStyleLayer, coord: OverscaledTileID, isRenderingGlobe: boolean) {
    const context = painter.context;
    const gl = context.gl;

    const stencilMode = StencilMode.disabled;
    // Turn on additive blending for kernels, which is a key aspect of kernel density estimation formula
    const colorMode = new ColorMode([gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);

    const bucket: HeatmapBucket = (tile.getBucket(layer) as any);
    if (!bucket) return;

    const tileKey = coord.key;
    let fbo = layer.heatmapFbos.get(tileKey);
    if (!fbo) {
        fbo = createHeatmapFbo(context, tile.tileSize, tile.tileSize);
        layer.heatmapFbos.set(tileKey, fbo);
    }

    context.bindFramebuffer.set(fbo.framebuffer);
    context.viewport.set([0, 0, tile.tileSize, tile.tileSize]);

    context.clear({color: Color.transparent});

    const programConfiguration = bucket.programConfigurations.get(layer.id);
    const program = painter.useProgram('heatmap', programConfiguration, !isRenderingGlobe);

    const projectionData = painter.transform.getProjectionData({overscaledTileID: tile.tileID, applyGlobeMatrix: true, applyTerrainMatrix: true});

    const terrainData = painter.style.map.terrain.getTerrainData(coord);

    program.draw(context, gl.TRIANGLES, DepthMode.disabled, stencilMode, colorMode, CullFaceMode.disabled,
        heatmapUniformValues(tile, painter.transform.zoom, layer.paint.get('heatmap-intensity'), 1.0) as any, terrainData as any, projectionData as any,
        layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
        bucket.segments, layer.paint, painter.transform.zoom,
        programConfiguration);
}

function renderHeatmapTerrain(painter: Painter, layer: HeatmapStyleLayer, coord: OverscaledTileID, isRenderingToTexture: boolean, isRenderingGlobe: boolean) {
    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    context.setColorMode(painter.colorModeForRenderPass());

    const colorRampTexture = getColorRampTexture(context, layer);

    // Here we bind two different textures from which we'll sample in drawing
    // heatmaps: the kernel texture, prepared in the offscreen pass, and a
    // color ramp texture.
    const tileKey = coord.key;
    const fbo = layer.heatmapFbos.get(tileKey);
    if (!fbo) return;

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    context.activeTexture.set(gl.TEXTURE1);
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    const projectionData = transform.getProjectionData({overscaledTileID: coord, applyTerrainMatrix: isRenderingGlobe, applyGlobeMatrix: !isRenderingToTexture});

    const textureProgram = painter.useProgram('heatmapTexture');

    textureProgram.draw(context, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, painter.colorModeForRenderPass(), CullFaceMode.disabled,
        heatmapTextureUniformValues(painter, layer, 0, 1) as any, null, projectionData as any,
        layer.id, painter.rasterBoundsBuffer, painter.quadTriangleIndexBuffer,
        painter.rasterBoundsSegments, layer.paint, transform.zoom);

    // destroy the FBO after rendering
    fbo.destroy();
    layer.heatmapFbos.delete(tileKey);
}

function bindFramebuffer(context: Context, painter: Painter, layer: HeatmapStyleLayer) {
    const gl = context.gl;
    context.activeTexture.set(gl.TEXTURE1);

    // Use a 4x downscaled screen texture for better performance
    context.viewport.set([0, 0, painter.width / 4, painter.height / 4]);

    let fbo = layer.heatmapFbos.get(HEATMAP_FULL_RENDER_FBO_KEY);

    if (!fbo) {
        fbo = createHeatmapFbo(context, painter.width / 4, painter.height / 4);
        layer.heatmapFbos.set(HEATMAP_FULL_RENDER_FBO_KEY, fbo);
    } else {
        gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());
        context.bindFramebuffer.set(fbo.framebuffer);
    }
}

function createHeatmapFbo(context: Context, width: number, height: number): Framebuffer {
    const gl = context.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Use the higher precision half-float texture where available (producing much smoother looking heatmaps);
    // Otherwise, fall back to a low precision texture
    const numType = context.HALF_FLOAT ?? gl.UNSIGNED_BYTE;
    const internalFormat = context.RGBA16F ?? gl.RGBA;

    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, numType, null);

    const fbo = context.createFramebuffer(width, height, false, false);
    fbo.colorAttachment.set(texture);

    return fbo;
}

function getColorRampTexture(context: Context, layer: HeatmapStyleLayer): Texture {
    if (!layer.colorRampTexture) {
        layer.colorRampTexture = new Texture(context, layer.colorRamp, context.gl.RGBA);
    }
    return layer.colorRampTexture;
}
