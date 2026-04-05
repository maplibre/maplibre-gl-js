import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {terrainUniformValues, terrainDepthUniformValues, terrainCoordsUniformValues} from './program/terrain_program';
import type {Painter, RenderOptions} from './painter';
import type {Tile} from '../tile/tile';
import {CullFaceMode} from '../gl/cull_face_mode';
import {Color} from '@maplibre/maplibre-gl-style-spec';
import {ColorMode} from '../gl/color_mode';
import {type Terrain} from './terrain';
import {UniformBlock} from './drawable/uniform_block';
import {shaders} from '../shaders/shaders';

/**
 * Redraw the Depth Framebuffer
 * @param painter - the painter
 * @param terrain - the terrain
 */
function drawDepth(painter: Painter, terrain: Terrain) {
    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;
    const colorMode = ColorMode.unblended;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const tiles = terrain.tileManager.getRenderableTiles();
    const program = painter.useProgram('terrainDepth');
    context.bindFramebuffer.set(terrain.getFramebuffer('depth').framebuffer);
    context.viewport.set([0, 0, painter.width / devicePixelRatio, painter.height / devicePixelRatio]);
    context.clear({color: Color.transparent, depth: 1});
    for (const tile of tiles) {
        const mesh = terrain.getTerrainMesh(tile.tileID);
        const terrainData = terrain.getTerrainData(tile.tileID);
        const projectionData = tr.getProjectionData({overscaledTileID: tile.tileID, applyTerrainMatrix: false, applyGlobeMatrix: true});
        const uniformValues = terrainDepthUniformValues(terrain.getMeshFrameDelta(tr.zoom));
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues as any, terrainData as any, projectionData as any, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);
}

/**
 * Redraw the Coords Framebuffers
 * @param painter - the painter
 * @param terrain - the terrain
 */
function drawCoords(painter: Painter, terrain: Terrain) {
    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;
    const colorMode = ColorMode.unblended;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const coords = terrain.getCoordsTexture();
    const tiles = terrain.tileManager.getRenderableTiles();

    // draw tile-coords into framebuffer
    const program = painter.useProgram('terrainCoords');
    context.bindFramebuffer.set(terrain.getFramebuffer('coords').framebuffer);
    context.viewport.set([0, 0, painter.width / devicePixelRatio, painter.height / devicePixelRatio]);
    context.clear({color: Color.transparent, depth: 1});
    terrain.coordsIndex = [];
    for (const tile of tiles) {
        const mesh = terrain.getTerrainMesh(tile.tileID);
        const terrainData = terrain.getTerrainData(tile.tileID);
        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, coords.texture);
        const uniformValues = terrainCoordsUniformValues(255 - terrain.coordsIndex.length, terrain.getMeshFrameDelta(tr.zoom));
        const projectionData = tr.getProjectionData({overscaledTileID: tile.tileID, applyTerrainMatrix: false, applyGlobeMatrix: true});
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues as any, terrainData as any, projectionData as any, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
        terrain.coordsIndex.push(tile.tileID.key);
    }
    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);
}

function drawTerrain(painter: Painter, terrain: Terrain, tiles: Array<Tile>, renderOptions: RenderOptions) {
    const isWebGPU = painter.device?.type === 'webgpu';
    if (isWebGPU) {
        drawTerrainWebGPU(painter, terrain, tiles, renderOptions);
        return;
    }

    const {isRenderingGlobe} = renderOptions;
    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;
    const colorMode = painter.colorModeForRenderPass();
    const depthMode = painter.getDepthModeFor3D();
    const program = painter.useProgram('terrain');

    context.bindFramebuffer.set(null);
    context.viewport.set([0, 0, painter.width, painter.height]);

    for (const tile of tiles) {
        const mesh = terrain.getTerrainMesh(tile.tileID);
        const texture = painter.renderToTexture.getTexture(tile);
        const terrainData = terrain.getTerrainData(tile.tileID);
        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
        const eleDelta = terrain.getMeshFrameDelta(tr.zoom);
        const fogMatrix = tr.calculateFogMatrix(tile.tileID.toUnwrapped());
        const uniformValues = terrainUniformValues(eleDelta, fogMatrix, painter.style.sky, tr.pitch, isRenderingGlobe);
        const projectionData = tr.getProjectionData({overscaledTileID: tile.tileID, applyTerrainMatrix: false, applyGlobeMatrix: true});
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues as any, terrainData as any, projectionData as any, 'terrain', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
    }
}

function drawTerrainWebGPU(painter: Painter, terrain: Terrain, tiles: Array<Tile>, renderOptions: RenderOptions) {
    const device = painter.device as any;
    const gpuDevice = device?.handle;
    if (!gpuDevice) return;

    const rp = (painter.renderPassWGSL as any)?.handle;
    if (!rp) return;

    const tr = painter.transform;
    const isRenderingGlobe = renderOptions.isRenderingGlobe;
    const eleDelta = terrain.getMeshFrameDelta(tr.zoom);
    const sky = painter.style.sky;

    // Cache pipeline
    let terrainPipeline = (painter as any)._terrainPipeline;
    if (!terrainPipeline) {
        let wgslSource = (shaders as any).terrainWgsl;
        if (!wgslSource) return;
        // Prepend VertexInput struct
        const vertexInputStruct = 'struct VertexInput {\n    @location(0) pos3d: vec3<i32>,\n};\n';
        wgslSource = `${vertexInputStruct}\n${wgslSource}`;
        const shaderModule = gpuDevice.createShaderModule({code: wgslSource});
        const canvasFormat = (navigator as any).gpu.getPreferredCanvasFormat();
        terrainPipeline = gpuDevice.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [{
                    // Terrain mesh vertex: 3 x Int16 = 6 bytes, padded to 8
                    arrayStride: 8,
                    stepMode: 'vertex',
                    attributes: [{shaderLocation: 0, format: 'sint16x4', offset: 0}],
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
            primitive: {topology: 'triangle-list', cullMode: 'back'},
            depthStencil: {
                format: 'depth24plus-stencil8',
                depthWriteEnabled: true,
                depthCompare: 'less-equal',
            },
        });
        (painter as any)._terrainPipeline = terrainPipeline;
    }

    rp.setPipeline(terrainPipeline);

    for (const tile of tiles) {
        const mesh = terrain.getTerrainMesh(tile.tileID);
        const rttKey = (tile as any)._webgpuRttKey;
        if (!rttKey) continue;
        const surfaceTexture = painter.getWebGPURttTexture(rttKey);
        if (!surfaceTexture) continue;

        const fogMatrix = tr.calculateFogMatrix(tile.tileID.toUnwrapped());
        const projectionData = tr.getProjectionData({overscaledTileID: tile.tileID, applyTerrainMatrix: false, applyGlobeMatrix: true});
        const terrainData = terrain.getTerrainData(tile.tileID);

        // Build TerrainDrawableUBO (288 bytes rounded to 288)
        const ubo = new UniformBlock(288);
        ubo.setMat4(0, projectionData.mainMatrix as Float32Array);
        ubo.setMat4(64, fogMatrix as Float32Array);
        ubo.setMat4(128, (terrainData as any).u_terrain_matrix as Float32Array);
        ubo.setFloat(192, eleDelta);
        ubo.setFloat(196, (terrainData as any).u_terrain_dim);
        ubo.setFloat(200, (terrainData as any).u_terrain_exaggeration);
        ubo.setInt(204, isRenderingGlobe ? 1 : 0);
        // Fog/sky params
        const fogGroundBlend = sky ? (sky as any).calculateFogBlendOpacity?.(tr.pitch) ?? 0 : 0;
        ubo.setFloat(208, 1.0);  // fog_ground_blend — disabled by setting high
        ubo.setFloat(212, 0.0);  // fog_ground_blend_opacity
        ubo.setFloat(216, 1.0);  // horizon_fog_blend
        const unpack = (terrainData as any).u_terrain_unpack;
        ubo.setVec4(224, unpack[0], unpack[1], unpack[2], unpack[3]);
        // Fog colors (default black)
        ubo.setVec4(240, 0, 0, 0, 0);
        ubo.setVec4(256, 0.5, 0.6, 0.7, 1);

        const globalIndexUBO = new UniformBlock(32);
        globalIndexUBO.setInt(0, 0);

        const drawableBuf = (ubo as any)._uploadAsStorage ? (ubo as any)._uploadAsStorage(device) : null;
        // Fall back to manual storage upload
        let drawableBufHandle;
        if (!(ubo as any)._storageBuffer) {
            (ubo as any)._storageBuffer = device.createBuffer({
                byteLength: (ubo as any)._byteLength,
                usage: 128 | 8, // STORAGE | COPY_DST
            });
        }
        (ubo as any)._storageBuffer.write(new Uint8Array((ubo as any)._data));
        drawableBufHandle = (ubo as any)._storageBuffer.handle;

        const globalIndexBuf = globalIndexUBO.upload(device);

        const bindGroup = gpuDevice.createBindGroup({
            layout: terrainPipeline.getBindGroupLayout(0),
            entries: [
                {binding: 1, resource: {buffer: globalIndexBuf.handle}},
                {binding: 2, resource: {buffer: drawableBufHandle}},
            ],
        });
        rp.setBindGroup(0, bindGroup);

        // Bind textures — surface (rendered tile content) + DEM
        const surfaceSampler = gpuDevice.createSampler({minFilter: 'linear', magFilter: 'linear'});
        const demSampler = gpuDevice.createSampler({minFilter: 'nearest', magFilter: 'nearest'});

        // Get DEM texture from terrain data
        const demTexSource = (terrainData as any).u_terrain;
        let demGpuTex = null;
        // The terrain dem texture is a GL texture; we need the WebGPU version.
        // Fallback: use a dummy 1x1 texture if unavailable.
        if (!demGpuTex) {
            if (!(painter as any)._dummyDemTex) {
                (painter as any)._dummyDemTex = gpuDevice.createTexture({
                    size: [1, 1], format: 'rgba8unorm', usage: 4 | 2,
                });
                gpuDevice.queue.writeTexture(
                    {texture: (painter as any)._dummyDemTex},
                    new Uint8Array([0, 0, 0, 255]), {bytesPerRow: 4}, [1, 1]
                );
            }
            demGpuTex = (painter as any)._dummyDemTex;
        }

        const texBindGroup = gpuDevice.createBindGroup({
            layout: terrainPipeline.getBindGroupLayout(1),
            entries: [
                {binding: 0, resource: surfaceSampler},
                {binding: 1, resource: surfaceTexture.createView()},
                {binding: 2, resource: demSampler},
                {binding: 3, resource: demGpuTex.createView()},
            ],
        });
        rp.setBindGroup(1, texBindGroup);

        // Set vertex buffer and draw
        const vertBuf = (mesh.vertexBuffer as any).webgpuBuffer;
        if (!vertBuf) continue;
        rp.setVertexBuffer(0, vertBuf.handle);
        const idxBuf = (mesh.indexBuffer as any).webgpuBuffer;
        if (!idxBuf) continue;
        rp.setIndexBuffer(idxBuf.handle, 'uint16');

        for (const segment of mesh.segments.get()) {
            const indexCount = segment.primitiveLength * 3;
            const firstIndex = segment.primitiveOffset * 3;
            rp.drawIndexed(indexCount, 1, firstIndex, segment.vertexOffset);
        }
    }
}

export {
    drawTerrain,
    drawDepth,
    drawCoords
};
