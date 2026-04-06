// WebGPU drawable path for heatmap layers.
// Extracted from src/render/draw_heatmap.ts

import {UniformBlock} from '../../gfx/uniform_block';
import {shaders} from '../../shaders/shaders';
import {pixelsToTileUnits} from '../../source/pixels_to_tile_units';
import {mat4} from 'gl-matrix';

import type {Painter} from '../../render/painter';
import type {TileManager} from '../../tile/tile_manager';
import type {HeatmapStyleLayer} from '../../style/style_layer/heatmap_style_layer';
import type {HeatmapBucket} from '../../data/bucket/heatmap_bucket';
import type {OverscaledTileID} from '../../tile/tile_id';

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

/**
 * WebGPU heatmap Pass 1: Render kernel density to offscreen texture.
 * Called during 'offscreen' render pass (before main render pass starts).
 */
export function prepareHeatmapWebGPU(painter: Painter, tileManager: TileManager, layer: HeatmapStyleLayer, tileIDs: Array<OverscaledTileID>) {
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
export function compositeHeatmapWebGPU(painter: Painter, layer: HeatmapStyleLayer) {
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
