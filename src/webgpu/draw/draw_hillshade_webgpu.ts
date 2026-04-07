// WebGPU drawable path for hillshade layers.
// Extracted from src/render/draw_hillshade.ts

import {UniformBlock} from '../../gfx/uniform_block';
import {shaders} from '../../shaders/shaders';
import {mat4} from 'gl-matrix';

import type {Painter, RenderOptions} from '../../render/painter';
import type {TileManager} from '../../tile/tile_manager';
import type {HillshadeStyleLayer} from '../../style/style_layer/hillshade_style_layer';
import type {OverscaledTileID} from '../../tile/tile_id';

/** Upload UniformBlock as storage buffer */
function uploadAsStorage(device: any, ubo: UniformBlock): any {
    if (!(ubo as any)._storageBuffer) {
        (ubo as any)._storageBuffer = device.createBuffer({
            byteLength: ubo._byteLength,
            usage: 128 | 8, // STORAGE | COPY_DST
        });
    }
    (ubo as any)._storageBuffer.write(new Uint8Array(ubo._data));
    return (ubo as any)._storageBuffer;
}

export function drawHillshadeWebGPU(painter: Painter, tileManager: TileManager, layer: HillshadeStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    const device = painter.device as any;
    const gpuDevice = device.handle;
    const transform = painter.transform;
    if (!gpuDevice) return;

    const {isRenderingToTexture} = renderOptions;

    // === Pass 1: Prepare slopes from DEM for each tile ===
    for (const coord of tileIDs) {
        const tile = tileManager.getTile(coord);
        const dem = tile.dem;
        if (!dem || !dem.data) continue;
        // Only prepare if needed (first time or DEM data changed)
        if (!tile.needsHillshadePrepare && (tile as any)._webgpuHillshade) continue;

        const tileSize = dem.dim;
        const textureStride = dem.stride;

        // Create offscreen slope texture for this tile
        let gpuState = (tile as any)._webgpuHillshade;
        if (!gpuState || gpuState.size !== tileSize) {
            if (gpuState?.texture) gpuState.texture.destroy();
            gpuState = {
                texture: gpuDevice.createTexture({
                    size: [tileSize, tileSize],
                    format: 'rgba16float',
                    usage: 0x10 | 0x04, // RENDER_ATTACHMENT | TEXTURE_BINDING
                }),
                size: tileSize,
            };
            (tile as any)._webgpuHillshade = gpuState;
        }

        // Upload DEM texture
        const pixelData = dem.getPixels();
        let demGPU = (tile as any)._webgpuDemTexture;
        if (!demGPU) {
            demGPU = gpuDevice.createTexture({
                size: [textureStride, textureStride],
                format: 'rgba8unorm',
                usage: 0x04 | 0x02, // TEXTURE_BINDING | COPY_DST
            });
            (tile as any)._webgpuDemTexture = demGPU;
        }
        gpuDevice.queue.writeTexture(
            {texture: demGPU},
            pixelData.data,
            {bytesPerRow: textureStride * 4},
            [textureStride, textureStride]
        );

        // Get or create prepare pipeline
        let preparePipeline = (painter as any)._hillshadePrepPipeline;
        if (!preparePipeline) {
            let wgslSource = (shaders as any).hillshadePrepareWgsl;
            if (!wgslSource) continue;

            const vertexInputStruct = 'struct VertexInput {\n    @location(0) pos: vec2<i32>,\n    @location(1) texture_pos: vec2<i32>,\n};\n';
            wgslSource = `${vertexInputStruct}\n${wgslSource}`;

            const shaderModule = gpuDevice.createShaderModule({code: wgslSource});
            preparePipeline = gpuDevice.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module: shaderModule,
                    entryPoint: 'vertexMain',
                    buffers: [{
                        arrayStride: 8, // 2 x Int16 (pos) + 2 x Int16 (texcoord)
                        stepMode: 'vertex',
                        attributes: [
                            {shaderLocation: 0, format: 'sint16x2', offset: 0},
                            {shaderLocation: 1, format: 'sint16x2', offset: 4},
                        ],
                    }],
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [{format: 'rgba16float'}],
                },
                primitive: {topology: 'triangle-list', cullMode: 'none'},
            });
            (painter as any)._hillshadePrepPipeline = preparePipeline;
        }

        // Create UBOs
        const prepUBO = new UniformBlock(48);
        // Ortho matrix matching GL: maps [0,EXTENT]x[0,EXTENT] to clip space with Y flip
        const EXTENT = 8192;
        const orthoMat = mat4.create();
        mat4.ortho(orthoMat, 0, EXTENT, -EXTENT, 0, 0, 1);
        mat4.translate(orthoMat, orthoMat, [0, -EXTENT, 0]);
        prepUBO.setMat4(0, orthoMat as Float32Array);
        // dimension, zoom, maxzoom
        prepUBO.setVec2(32, textureStride, textureStride);
        prepUBO.setFloat(36, tile.tileID.overscaledZ);
        prepUBO.setFloat(40, 0); // maxzoom
        // unpack vector from DEM data
        const unpack = dem.getUnpackVector();

        const prepUBO2 = new UniformBlock(96);
        prepUBO2.setMat4(0, orthoMat as Float32Array);
        prepUBO2.setVec2(64, textureStride, textureStride);
        prepUBO2.setFloat(72, tile.tileID.overscaledZ);
        prepUBO2.setFloat(76, 0);
        prepUBO2.setVec4(80, unpack[0], unpack[1], unpack[2], unpack[3]);

        const globalIndexUBO = new UniformBlock(32);
        globalIndexUBO.setInt(0, 0);

        // Render prepare pass
        const prepEncoder = gpuDevice.createCommandEncoder();
        const prepPass = prepEncoder.beginRenderPass({
            colorAttachments: [{
                view: gpuState.texture.createView(),
                clearValue: {r: 0, g: 0, b: 0, a: 1},
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        prepPass.setPipeline(preparePipeline);

        const globalBuf = globalIndexUBO.upload(device);
        const drawVecBuf = uploadAsStorage(device, prepUBO2);

        const prepBindGroup = gpuDevice.createBindGroup({
            layout: preparePipeline.getBindGroupLayout(0),
            entries: [
                {binding: 1, resource: {buffer: globalBuf.handle}},
                {binding: 2, resource: {buffer: drawVecBuf.handle}},
            ],
        });
        prepPass.setBindGroup(0, prepBindGroup);

        // Texture bind group
        const demSampler = gpuDevice.createSampler({minFilter: 'nearest', magFilter: 'nearest'});
        const texBindGroup = gpuDevice.createBindGroup({
            layout: preparePipeline.getBindGroupLayout(1),
            entries: [
                {binding: 0, resource: demSampler},
                {binding: 1, resource: demGPU.createView()},
            ],
        });
        prepPass.setBindGroup(1, texBindGroup);

        if (!painter.rasterBoundsBuffer?.webgpuBuffer) { prepPass.end(); gpuDevice.queue.submit([prepEncoder.finish()]); continue; }
        prepPass.setVertexBuffer(0, painter.rasterBoundsBuffer.webgpuBuffer.handle);
        prepPass.setIndexBuffer(painter.quadTriangleIndexBuffer.webgpuBuffer.handle, 'uint16');
        prepPass.drawIndexed(6, 1, 0, 0);
        prepPass.end();
        gpuDevice.queue.submit([prepEncoder.finish()]);

        tile.needsHillshadePrepare = false;
    }

    // === Pass 2: Render hillshade to main render target ===
    const mainRenderPass = (painter.renderPassWGSL as any)?.handle;
    if (!mainRenderPass) return;

    // Get or create render pipeline
    let renderPipeline = (painter as any)._hillshadeRenderPipeline;
    if (!renderPipeline) {
        let wgslSource = (shaders as any).hillshadeWgsl;
        if (!wgslSource) return;

        const vertexInputStruct = 'struct VertexInput {\n    @location(0) pos: vec2<i32>,\n    @location(1) texture_pos: vec2<i32>,\n};\n';
        wgslSource = `${vertexInputStruct}\n${wgslSource}`;

        const canvasFormat = (navigator as any).gpu.getPreferredCanvasFormat();
        const shaderModule = gpuDevice.createShaderModule({code: wgslSource});
        renderPipeline = gpuDevice.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [{
                    arrayStride: 8,
                    stepMode: 'vertex',
                    attributes: [
                        {shaderLocation: 0, format: 'sint16x2', offset: 0},
                        {shaderLocation: 1, format: 'sint16x2', offset: 4},
                    ],
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
        (painter as any)._hillshadeRenderPipeline = renderPipeline;
    }

    // Get hillshade paint properties using the same path as GL
    const illumination = layer.getIlluminationProperties();
    let azimuth = illumination.directionRadians[0];
    if (layer.paint.get('hillshade-illumination-anchor') === 'viewport') {
        azimuth += painter.transform.bearingInRadians;
    }
    const altitude = illumination.altitudeRadians[0];
    const shadowColor = illumination.shadowColor[0];
    const highlightColor = illumination.highlightColor[0];
    const accentColor = layer.paint.get('hillshade-accent-color');
    const exaggeration = layer.paint.get('hillshade-exaggeration');

    mainRenderPass.setPipeline(renderPipeline);

    for (const coord of tileIDs) {
        const tile = tileManager.getTile(coord);
        const gpuState = (tile as any)._webgpuHillshade;
        if (!gpuState) continue;

        const projectionData = transform.getProjectionData({
            overscaledTileID: coord,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true,
        });

        // Compute latitude range for Mercator correction
        const canonical = coord.canonical;
        const n = Math.PI - 2 * Math.PI * canonical.y / (1 << canonical.z);
        const s = Math.PI - 2 * Math.PI * (canonical.y + 1) / (1 << canonical.z);
        const latN = Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) * 180 / Math.PI;
        const latS = Math.atan(0.5 * (Math.exp(s) - Math.exp(-s))) * 180 / Math.PI;

        // Drawable UBO
        const drawUBO = new UniformBlock(32);
        drawUBO.setMat4(0, projectionData.mainMatrix as Float32Array);

        // Expand to include latrange, exaggeration, tex_offset, tex_scale
        const drawUBO2 = new UniformBlock(96);
        drawUBO2.setMat4(0, projectionData.mainMatrix as Float32Array);
        drawUBO2.setVec2(64, latN, latS);
        drawUBO2.setFloat(72, typeof exaggeration === 'number' ? exaggeration : 0.5);

        // Compute sub-tile UV offset/scale for overscaled tiles
        const demTile = tile.tileID;
        const zoomDiff = coord.overscaledZ - demTile.overscaledZ;
        if (zoomDiff > 0) {
            const scale = 1 / (1 << zoomDiff);
            const xOffset = (coord.canonical.x - (demTile.canonical.x << zoomDiff)) * scale;
            const yOffset = (coord.canonical.y - (demTile.canonical.y << zoomDiff)) * scale;
            drawUBO2.setVec2(80, xOffset, yOffset); // tex_offset
            drawUBO2.setVec2(88, scale, scale);      // tex_scale
        } else {
            drawUBO2.setVec2(80, 0, 0);   // tex_offset = (0,0)
            drawUBO2.setVec2(88, 1, 1);   // tex_scale = (1,1)
        }

        // Props UBO
        const propsUBO = new UniformBlock(64);
        propsUBO.setVec4(0, shadowColor.r, shadowColor.g, shadowColor.b, shadowColor.a);
        propsUBO.setVec4(16, highlightColor.r, highlightColor.g, highlightColor.b, highlightColor.a);
        propsUBO.setVec4(32, accentColor.r, accentColor.g, accentColor.b, accentColor.a);
        propsUBO.setFloat(48, altitude);
        propsUBO.setFloat(52, azimuth);

        const globalIndexUBO = new UniformBlock(32);
        globalIndexUBO.setInt(0, 0);

        const globalBuf = globalIndexUBO.upload(device);
        const drawVecBuf = uploadAsStorage(device, drawUBO2);
        const propsBuf = propsUBO.upload(device);
        const globalPaintBuf = (painter.globalUBO as any).upload(device);

        const bindGroup = gpuDevice.createBindGroup({
            layout: renderPipeline.getBindGroupLayout(0),
            entries: [
                {binding: 0, resource: {buffer: globalPaintBuf.handle}},
                {binding: 1, resource: {buffer: globalBuf.handle}},
                {binding: 2, resource: {buffer: drawVecBuf.handle}},
                {binding: 4, resource: {buffer: propsBuf.handle}},
            ],
        });
        mainRenderPass.setBindGroup(0, bindGroup);

        // Texture: slope texture from prepare pass
        const slopeSampler = gpuDevice.createSampler({minFilter: 'linear', magFilter: 'linear'});
        const texBindGroup = gpuDevice.createBindGroup({
            layout: renderPipeline.getBindGroupLayout(1),
            entries: [
                {binding: 0, resource: slopeSampler},
                {binding: 1, resource: gpuState.texture.createView()},
            ],
        });
        mainRenderPass.setBindGroup(1, texBindGroup);

        // Use rasterBounds for the tile quad
        if (!painter.rasterBoundsBuffer?.webgpuBuffer) continue;
        mainRenderPass.setVertexBuffer(0, painter.rasterBoundsBuffer.webgpuBuffer.handle);
        mainRenderPass.setIndexBuffer(painter.quadTriangleIndexBuffer.webgpuBuffer.handle, 'uint16');
        mainRenderPass.drawIndexed(6, 1, 0, 0);
    }
}
