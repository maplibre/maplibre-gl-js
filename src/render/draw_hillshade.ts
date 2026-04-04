import {Texture} from './texture';
import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {type ColorMode} from '../gl/color_mode';
import {
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
} from './program/hillshade_program';

import {shaders} from '../shaders/shaders';
import {UniformBlock} from './drawable/uniform_block';
import {mat4} from 'gl-matrix';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {HillshadeStyleLayer} from '../style/style_layer/hillshade_style_layer';
import type {OverscaledTileID} from '../tile/tile_id';

export function drawHillshade(painter: Painter, tileManager: TileManager, layer: HillshadeStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions) {
    if (painter.renderPass !== 'offscreen' && painter.renderPass !== 'translucent') return;

    // WebGPU path
    if (painter.device && painter.device.type === 'webgpu') {
        if (painter.renderPass === 'translucent') {
            drawHillshadeWebGPU(painter, tileManager, layer, tileIDs, renderOptions);
        }
        return;
    }

    const {isRenderingToTexture} = renderOptions;
    const context = painter.context;
    const projection = painter.style.projection;
    const useSubdivision = projection.useSubdivision;

    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    if (painter.renderPass === 'offscreen') {
        // Prepare tiles
        prepareHillshade(painter, tileManager, tileIDs, layer, depthMode, StencilMode.disabled, colorMode);
        context.viewport.set([0, 0, painter.width, painter.height]);
    } else if (painter.renderPass === 'translucent') {
        // Globe (or any projection with subdivision) needs two-pass rendering to avoid artifacts when rendering texture tiles.
        // See comments in draw_raster.ts for more details.
        if (useSubdivision) {
            // Two-pass rendering
            const [stencilBorderless, stencilBorders, coords] = painter.stencilConfigForOverlapTwoPass(tileIDs);
            renderHillshade(painter, tileManager, layer, coords, stencilBorderless, depthMode, colorMode, false, isRenderingToTexture); // draw without borders
            renderHillshade(painter, tileManager, layer, coords, stencilBorders, depthMode, colorMode, true, isRenderingToTexture); // draw with borders
        } else {
            // Simple rendering
            const [stencil, coords] = painter.getStencilConfigForOverlapAndUpdateStencilID(tileIDs);
            renderHillshade(painter, tileManager, layer, coords, stencil, depthMode, colorMode, false, isRenderingToTexture);
        }
    }
}

function renderHillshade(
    painter: Painter,
    tileManager: TileManager,
    layer: HillshadeStyleLayer,
    coords: Array<OverscaledTileID>,
    stencilModes: { [_: number]: Readonly<StencilMode> },
    depthMode: Readonly<DepthMode>,
    colorMode: Readonly<ColorMode>,
    useBorder: boolean,
    isRenderingToTexture: boolean
) {
    const projection = painter.style.projection;
    const context = painter.context;
    const transform = painter.transform;
    const gl = context.gl;

    const defines = [`#define NUM_ILLUMINATION_SOURCES ${layer.paint.get('hillshade-highlight-color').values.length}`];
    const program = painter.useProgram('hillshade', null, false, defines);
    const align = !painter.options.moving;

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const fbo = tile.fbo;
        if (!fbo) {
            continue;
        }
        const mesh = projection.getMeshFromTileID(context, coord.canonical, useBorder, true, 'raster');

        const terrainData = painter.style.map.terrain?.getTerrainData(coord);

        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

        const projectionData = transform.getProjectionData({
            overscaledTileID: coord,
            aligned: align,
            applyGlobeMatrix: !isRenderingToTexture,
            applyTerrainMatrix: true
        });

        program.draw(context, gl.TRIANGLES, depthMode, stencilModes[coord.overscaledZ], colorMode, CullFaceMode.backCCW,
            hillshadeUniformValues(painter, tile, layer) as any, terrainData as any, projectionData as any, layer.id, mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}

// hillshade rendering is done in two steps. the prepare step first calculates the slope of the terrain in the x and y
// directions for each pixel, and saves those values to a framebuffer texture in the r and g channels.
function prepareHillshade(
    painter: Painter,
    tileManager: TileManager,
    tileIDs: Array<OverscaledTileID>,
    layer: HillshadeStyleLayer,
    depthMode: Readonly<DepthMode>,
    stencilMode: Readonly<StencilMode>,
    colorMode: Readonly<ColorMode>) {

    const context = painter.context;
    const gl = context.gl;

    for (const coord of tileIDs) {
        const tile = tileManager.getTile(coord);
        const dem = tile.dem;

        if (!dem || !dem.data) {
            continue;
        }

        if (!tile.needsHillshadePrepare) {
            continue;
        }

        const tileSize = dem.dim;
        const textureStride = dem.stride;

        const pixelData = dem.getPixels();
        context.activeTexture.set(gl.TEXTURE1);

        context.pixelStoreUnpackPremultiplyAlpha.set(false);
        tile.demTexture = tile.demTexture || painter.getTileTexture(textureStride);
        if (tile.demTexture) {
            const demTexture = tile.demTexture;
            demTexture.update(pixelData, {premultiply: false});
            demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        } else {
            tile.demTexture = new Texture(context, pixelData, gl.RGBA, {premultiply: false});
            tile.demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        }

        context.activeTexture.set(gl.TEXTURE0);

        let fbo = tile.fbo;

        if (!fbo) {
            const renderTexture = new Texture(context, {width: tileSize, height: tileSize, data: null}, gl.RGBA);
            renderTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

            fbo = tile.fbo = context.createFramebuffer(tileSize, tileSize, true, false);
            fbo.colorAttachment.set(renderTexture.texture);
        }

        context.bindFramebuffer.set(fbo.framebuffer);
        context.viewport.set([0, 0, tileSize, tileSize]);

        const prepareProgram = painter.useProgram('hillshadePrepare');

        prepareProgram.draw(context, gl.TRIANGLES,
            depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            hillshadeUniformPrepareValues(tile.tileID, dem) as any,
            null, null, layer.id, painter.rasterBoundsBuffer,
            painter.quadTriangleIndexBuffer, painter.rasterBoundsSegments);

        tile.needsHillshadePrepare = false;
    }
}

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

function drawHillshadeWebGPU(painter: Painter, tileManager: TileManager, layer: HillshadeStyleLayer, tileIDs: Array<OverscaledTileID>, renderOptions: RenderOptions) {
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
        if (!tile.needsHillshadePrepare) continue;

        const tileSize = dem.dim;
        const textureStride = dem.stride;

        // Create offscreen slope texture for this tile
        let gpuState = (tile as any)._webgpuHillshade;
        if (!gpuState || gpuState.size !== tileSize) {
            if (gpuState?.texture) gpuState.texture.destroy();
            gpuState = {
                texture: gpuDevice.createTexture({
                    size: [tileSize, tileSize],
                    format: 'rgba8unorm',
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
                    targets: [{format: 'rgba8unorm'}],
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

    // Get hillshade paint properties
    const paint = layer.paint;
    const shadowColor = paint.get('hillshade-shadow-color').values?.[0] || paint.get('hillshade-shadow-color');
    const highlightColor = paint.get('hillshade-highlight-color').values?.[0] || paint.get('hillshade-highlight-color');
    const accentColor = paint.get('hillshade-accent-color');
    const illuminationDir = paint.get('hillshade-illumination-direction');
    const illuminationAnchor = paint.get('hillshade-illumination-anchor');
    const exaggeration = paint.get('hillshade-exaggeration');

    const azimuth = (typeof illuminationDir === 'number' ? illuminationDir : 335) / 180 * Math.PI;
    const altitude = 1.0472; // ~60 degrees default

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

        // Expand to include latrange, exaggeration
        const drawUBO2 = new UniformBlock(80);
        drawUBO2.setMat4(0, projectionData.mainMatrix as Float32Array);
        drawUBO2.setVec2(64, latN, latS);
        drawUBO2.setFloat(72, typeof exaggeration === 'number' ? exaggeration : 0.5);

        // Props UBO
        const propsUBO = new UniformBlock(64);
        const sc = typeof shadowColor === 'object' && 'r' in shadowColor ? shadowColor : {r: 0.075, g: 0.075, b: 0.075, a: 1};
        const hc = typeof highlightColor === 'object' && 'r' in highlightColor ? highlightColor : {r: 1, g: 1, b: 1, a: 1};
        const ac = typeof accentColor === 'object' && 'r' in accentColor ? accentColor : {r: 0, g: 0, b: 0, a: 1};
        propsUBO.setVec4(0, sc.r, sc.g, sc.b, sc.a);
        propsUBO.setVec4(16, hc.r, hc.g, hc.b, hc.a);
        propsUBO.setVec4(32, ac.r, ac.g, ac.b, ac.a);
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
