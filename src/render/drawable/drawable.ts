import type {Device, VertexFormat} from '@luma.gl/core';
import {Model} from '@luma.gl/engine';
import {getShaderLayoutFromWGSL} from '@luma.gl/shadertools';
import type {OverscaledTileID} from '../../tile/tile_id';
import type {VertexBuffer} from '../../gl/vertex_buffer';
import type {IndexBuffer} from '../../gl/index_buffer';
import type {SegmentVector} from '../../data/segment';
import type {ProgramConfiguration} from '../../data/program_configuration';
import type {Program} from '../program';
import type {Context} from '../../gl/context';
import type {Painter} from '../painter';
import type {UniformValues} from '../uniform_binding';
import type {DepthMode} from '../../gl/depth_mode';
import type {StencilMode} from '../../gl/stencil_mode';
import type {ColorMode} from '../../gl/color_mode';
import type {CullFaceMode} from '../../gl/cull_face_mode';
import type {LayerTweaker} from './layer_tweaker';
import {UniformBlock} from './uniform_block';
import type {ProjectionData} from '../../geo/projection/projection_data';
import type {TerrainData} from '../terrain';
import {VertexArrayObject} from '../vertex_array_object';
import {shaders} from '../../shaders/shaders';
import {preprocessWGSL} from '../wgsl_preprocessor';
import {renderStateHash} from './render_state';

function wgslTypeFromFormat(format: string): string {
    if (format.startsWith('sint16')) return format === 'sint16' ? 'i32' : `vec${format.charAt(format.length - 1)}<i32>`;
    if (format.startsWith('uint8')) return format === 'uint8' ? 'u32' : `vec${format.charAt(format.length - 1)}<u32>`;
    if (format.startsWith('float32')) return format === 'float32' ? 'f32' : `vec${format.charAt(format.length - 1)}<f32>`;
    return 'vec4<f32>';
}

let nextDrawableId = 0;

export interface DrawableTexture {
    name: string;
    textureUnit: number;
    texture: any; // WebGLTexture or GPUTexture
    filter?: number;
    wrap?: number;
}

/**
 * A self-contained draw call object created once (when tile data arrives)
 * and updated per-frame via tweakers (for matrices/uniforms).
 */
export class Drawable {
    static _loggedOnce = false;
    id: number;
    name: string;
    enabled: boolean;
    tileID: OverscaledTileID | null;

    // Shader
    shaderName: string;
    programConfiguration: ProgramConfiguration | null;

    // Vertex data (references into existing bucket buffers)
    layoutVertexBuffer: VertexBuffer;
    indexBuffer: IndexBuffer;
    segments: SegmentVector;
    dynamicLayoutBuffer: VertexBuffer | null;
    dynamicLayoutBuffer2: VertexBuffer | null;

    // Pipeline state
    depthMode: Readonly<DepthMode>;
    stencilMode: Readonly<StencilMode>;
    colorMode: Readonly<ColorMode>;
    cullFaceMode: Readonly<CullFaceMode>;

    // Draw mode: gl.TRIANGLES (default) or gl.LINES for outlines
    drawMode: number | null;

    // Render pass & ordering
    renderPass: 'opaque' | 'translucent' | 'offscreen';
    drawPriority: number;
    subLayerIndex: number;

    // Uniforms - WebGL uses uniformValues, WebGPU uses UBO buffers
    uniformValues: UniformValues<any> | null;
    drawableUBO: UniformBlock | null;
    layerUBO: UniformBlock | null;
    globalUBO: UniformBlock | null;

    // Projection & terrain
    projectionData: ProjectionData | null;
    terrainData: TerrainData | null;

    // Textures
    textures: DrawableTexture[];

    // Tweaker reference
    layerTweaker: LayerTweaker | null;

    // Cached GL Program for WebGL
    _glProgram: Program<any> | null;

    // Paint properties (for binder uniforms)
    _paintProperties: any;
    _zoom: number | null;

    // Layer ID for VAO caching
    _layerID: string;

    // Cached globalIndex UBO (reused across frames, must not be destroyed before GPU submission)
    _globalIndexUBO: UniformBlock | null;
    _loggedDraw: boolean;

    constructor() {
        this.id = nextDrawableId++;
        this.name = '';
        this.enabled = true;
        this.tileID = null;
        this.shaderName = '';
        this.programConfiguration = null;
        this.layoutVertexBuffer = null as any;
        this.indexBuffer = null as any;
        this.segments = null as any;
        this.dynamicLayoutBuffer = null;
        this.dynamicLayoutBuffer2 = null;
        this.depthMode = null as any;
        this.stencilMode = null as any;
        this.colorMode = null as any;
        this.cullFaceMode = null as any;
        this.drawMode = null; // null = gl.TRIANGLES (default)
        this.renderPass = 'translucent';
        this.drawPriority = 0;
        this.subLayerIndex = 0;
        this.uniformValues = null;
        this.drawableUBO = null;
        this.layerUBO = null;
        this.globalUBO = null;
        this.projectionData = null;
        this.terrainData = null;
        this.textures = [];
        this.layerTweaker = null;
        this._glProgram = null;
        this._paintProperties = null;
        this._zoom = null;
        this._layerID = '';
        this._globalIndexUBO = null;
        this._loggedDraw = false;
    }

    /**
     * Draw this drawable. Branches based on WebGL vs WebGPU.
     */
    draw(context: Context, device: Device | null, painter: Painter, renderPass?: any): void {
        if (!this.enabled) return;

        const isWebGPU = device && device.type === 'webgpu';
        if (isWebGPU) {
            this._drawWebGPU(device, painter, renderPass);
        } else {
            this._drawWebGL(context, painter);
        }
    }

    /**
     * WebGL draw path: sets GL state + uniforms, binds VAO, issues gl.drawElements per segment.
     * Same logic as current LumaModel.draw() WebGL path.
     */
    private _drawWebGL(context: Context, painter: Painter): void {
        const gl = context.gl;
        const program = this._glProgram;
        if (!program || program.failedToCreate) return;

        context.program.set(program.program);
        context.setDepthMode(this.depthMode);
        context.setStencilMode(this.stencilMode);
        context.setColorMode(this.colorMode);
        context.setCullFace(this.cullFaceMode);

        // Bind textures (gradient, pattern, etc.)
        for (const tex of this.textures) {
            context.activeTexture.set(gl.TEXTURE0 + tex.textureUnit);
            gl.bindTexture(gl.TEXTURE_2D, tex.texture);
            if (tex.filter !== undefined) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, tex.filter);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, tex.filter);
            }
            if (tex.wrap !== undefined) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, tex.wrap);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, tex.wrap);
            }
        }

        // Terrain uniforms
        if (this.terrainData) {
            context.activeTexture.set(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, this.terrainData.depthTexture);
            context.activeTexture.set(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, this.terrainData.texture);
            for (const name in program.terrainUniforms) {
                program.terrainUniforms[name].set((this.terrainData as any)[name]);
            }
        }

        // Projection uniforms
        if (this.projectionData) {
            const projMap: any = {
                mainMatrix: 'u_projection_matrix',
                tileMercatorCoords: 'u_projection_tile_mercator_coords',
                clippingPlane: 'u_projection_clipping_plane',
                projectionTransition: 'u_projection_transition',
                fallbackMatrix: 'u_projection_fallback_matrix'
            };
            for (const fieldName in this.projectionData) {
                const uniformName = projMap[fieldName];
                if (program.projectionUniforms && program.projectionUniforms[uniformName]) {
                    program.projectionUniforms[uniformName].set((this.projectionData as any)[fieldName]);
                }
            }
        }

        // Fixed uniforms
        if (this.uniformValues) {
            for (const name in program.fixedUniforms) {
                program.fixedUniforms[name].set(this.uniformValues[name]);
            }
        }

        // Binder uniforms (data-driven properties)
        if (this.programConfiguration) {
            this.programConfiguration.setUniforms(
                context,
                program.binderUniforms,
                this._paintProperties,
                {zoom: this._zoom as any}
            );
        }

        // Draw each segment
        const mode = this.drawMode ?? gl.TRIANGLES;
        const verticesPerPrimitive = mode === gl.LINES ? 2 : 3;
        for (const segment of this.segments.get()) {
            const vaos = segment.vaos || (segment.vaos = {});
            const vao: VertexArrayObject = vaos[this._layerID] || (vaos[this._layerID] = new VertexArrayObject());

            vao.bind(
                context,
                program,
                this.layoutVertexBuffer,
                this.programConfiguration ? this.programConfiguration.getPaintVertexBuffers() : [],
                this.indexBuffer,
                segment.vertexOffset,
                this.dynamicLayoutBuffer,
                this.dynamicLayoutBuffer2
            );

            gl.drawElements(
                mode,
                segment.primitiveLength * verticesPerPrimitive,
                gl.UNSIGNED_SHORT,
                segment.primitiveOffset * verticesPerPrimitive * 2
            );
        }
    }

    /**
     * WebGPU draw path: raw GPURenderPipeline with dynamic bind group entries.
     */
    private _drawWebGPU(device: Device, painter: Painter, renderPass?: any): void {
        if (!renderPass || !this.layoutVertexBuffer || !this.indexBuffer || !this.segments) {
            if (!(this as any)._loggedEarly) {
                (this as any)._loggedEarly = true;
                console.warn(`[${this.shaderName} EARLY] rp=${!!renderPass} vb=${!!this.layoutVertexBuffer} ib=${!!this.indexBuffer} seg=${!!this.segments}`);
            }
            return;
        }
        if (!this.drawableUBO || !this.layerUBO) {
            if (!(this as any)._loggedEarly2) {
                (this as any)._loggedEarly2 = true;
                console.warn(`[${this.shaderName} EARLY2] drawableUBO=${!!this.drawableUBO} layerUBO=${!!this.layerUBO}`);
            }
            return;
        }

        try {
            const gpuDevice = (device as any).handle;
            const rpEncoder = (renderPass as any).handle;
            if (!gpuDevice || !rpEncoder) {
                if (!(this as any)._loggedRP) {
                    (this as any)._loggedRP = true;
                    console.warn(`[${this.shaderName} EARLY3] gpuDevice=${!!gpuDevice} rpEncoder=${!!rpEncoder} renderPass=${renderPass} rpKeys=${renderPass ? Object.keys(renderPass).join(',') : 'null'}`);
                }
                return;
            }

            // Reuse globalIndex UBO across frames (32 bytes for WGSL alignment)
            if (!this._globalIndexUBO) {
                this._globalIndexUBO = new UniformBlock(32);
                this._globalIndexUBO.setInt(0, 0);
            }

            // Upload UBOs
            const globalIndexBuf = this._globalIndexUBO.upload(device);
            const drawableVecBuf = this._uploadAsStorage(device, this.drawableUBO);
            const propsBuf = this.layerUBO.upload(device);

            // Get or create pipeline (cached on painter, keyed by shader+stencil state)
            const definesKey = this.programConfiguration ? this.programConfiguration.cacheKey : '';
            const topologyKey = this.drawMode === 1 ? 'L' : 'T';
            const blendKey = this.renderPass === 'translucent' ? 'B' : 'O';
            const cacheKey = `raw_${this.shaderName}_${definesKey}_${topologyKey}_${blendKey}`;
            if (!(painter as any)._rawPipelines) (painter as any)._rawPipelines = {};
            if (!(painter as any)._rawPipelines[cacheKey]) {
                const wgslKey = `${this.shaderName}Wgsl`;
                let rawWgsl = (shaders as any)[wgslKey];
                if (!rawWgsl) return;

                // Preprocess WGSL (handle #ifdef/#ifndef for data-driven properties)
                const defines: Record<string, boolean> = {};
                if (this.programConfiguration) {
                    const binders = (this.programConfiguration as any).binders || {};
                    // Map shader property names to style property names per layer type
                    const shaderName = this.shaderName;
                    const prefix = shaderName === 'line' || shaderName === 'lineSDF' || shaderName === 'lineGradient' || shaderName === 'lineGradientSDF' || shaderName === 'linePattern' ? 'line' :
                        shaderName === 'circle' ? 'circle' :
                        shaderName === 'fill' || shaderName === 'fillOutline' || shaderName === 'fillPattern' || shaderName === 'fillOutlinePattern' ? 'fill' : '';
                    const paintProperties = ['color', 'radius', 'blur', 'opacity', 'stroke_color', 'stroke_width', 'stroke_opacity',
                        'outline_color', 'width', 'gapwidth', 'offset', 'floorwidth'];
                    for (const prop of paintProperties) {
                        // Convert shader prop (e.g. 'color') to style prop (e.g. 'fill-color')
                        const styleProp = prefix ? `${prefix}-${prop.replace(/_/g, '-')}` : prop;
                        const binder = binders[styleProp] || null;
                        const hasPaintBuffer = binder && binder.paintVertexBuffer;
                        const isComposite = hasPaintBuffer && binder.uniformNames && binder.uniformNames.length > 0;
                        const isSource = hasPaintBuffer && !isComposite;
                        defines[`HAS_UNIFORM_u_${prop}`] = !isSource && !isComposite;
                        defines[`HAS_DATA_DRIVEN_u_${prop}`] = !!isSource;
                        defines[`HAS_COMPOSITE_u_${prop}`] = !!isComposite;
                    }
                }
                let wgslSource = preprocessWGSL(rawWgsl, defines);

                // Generate VertexInput struct and vertex buffer layouts
                let vertexInputStruct = 'struct VertexInput {\n';
                const vertexBufferLayouts: any[] = [];
                let locationIndex = 0;

                // Slot 0: layout vertex buffer
                const layoutAttrs: any[] = [];
                for (const member of this.layoutVertexBuffer.attributes) {
                    const format = getWebGPUVertexFormat(member.type, member.components);
                    layoutAttrs.push({shaderLocation: locationIndex, format, offset: member.offset});
                    const wgslType = wgslTypeFromFormat(format);
                    vertexInputStruct += `    @location(${locationIndex}) ${member.name.replace('a_', '')}: ${wgslType},\n`;
                    locationIndex++;
                }
                vertexBufferLayouts.push({
                    arrayStride: this.layoutVertexBuffer.itemSize,
                    stepMode: 'vertex',
                    attributes: layoutAttrs,
                });

                // Slots 1+: paint vertex buffers (for data-driven properties)
                const paintBuffers = this.programConfiguration ? this.programConfiguration.getPaintVertexBuffers() : [];
                for (const paintBuf of paintBuffers) {
                    const paintAttrs: any[] = [];
                    for (const member of paintBuf.attributes) {
                        const format = getWebGPUVertexFormat(member.type, member.components);
                        paintAttrs.push({shaderLocation: locationIndex, format, offset: member.offset});
                        const wgslType = wgslTypeFromFormat(format);
                        vertexInputStruct += `    @location(${locationIndex}) ${member.name.replace('a_', '')}: ${wgslType},\n`;
                        locationIndex++;
                    }
                    vertexBufferLayouts.push({
                        arrayStride: paintBuf.itemSize,
                        stepMode: 'vertex',
                        attributes: paintAttrs,
                    });
                }

                vertexInputStruct += '};\n';

                if (wgslSource.includes('struct VertexInput {')) {
                    wgslSource = wgslSource.replace(/struct\s+VertexInput\s*\{[^}]*\};/m, vertexInputStruct);
                } else {
                    wgslSource = `${vertexInputStruct}\n${wgslSource}`;
                }

                // Cache which bindings are declared in the WGSL source
                const declaredBindings = new Set<number>();
                const bindingRegex = /@binding\((\d+)\)/g;
                let match: RegExpExecArray | null;
                while ((match = bindingRegex.exec(wgslSource)) !== null) {
                    declaredBindings.add(parseInt(match[1]));
                }
                if (!(painter as any)._rawBindings) (painter as any)._rawBindings = {};
                (painter as any)._rawBindings[cacheKey] = declaredBindings;

                // Cache paint buffer count for setVertexBuffer calls later
                if (!(painter as any)._rawPaintBufCounts) (painter as any)._rawPaintBufCounts = {};
                (painter as any)._rawPaintBufCounts[cacheKey] = paintBuffers.length;

                const shaderModule = gpuDevice.createShaderModule({code: wgslSource});
                shaderModule.getCompilationInfo().then((info: any) => {
                    for (const msg of info.messages) {
                        console.warn(`[WGSL ${msg.type}] ${this.shaderName}: ${msg.message} (line ${msg.lineNum})`);
                    }
                });
                const canvasFormat = (navigator as any).gpu.getPreferredCanvasFormat();

                const needsStencilClip = this.shaderName === 'fill' || this.shaderName === 'line';
                const depthStencilState: any = {
                    format: 'depth24plus-stencil8',
                    depthWriteEnabled: false,
                    depthCompare: 'always',
                };
                if (needsStencilClip) {
                    depthStencilState.stencilFront = {compare: 'equal', passOp: 'keep', failOp: 'keep', depthFailOp: 'keep'};
                    depthStencilState.stencilBack = {compare: 'equal', passOp: 'keep', failOp: 'keep', depthFailOp: 'keep'};
                    depthStencilState.stencilReadMask = 0xFF;
                    depthStencilState.stencilWriteMask = 0x00;
                }

                const pipeline = gpuDevice.createRenderPipeline({
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
                            format: canvasFormat,
                            // Fill body renders opaque (no blend) to avoid tile-boundary bands.
                            // Lines, circles, outlines need premultiplied alpha blending.
                            ...(this.shaderName !== 'fill' && this.shaderName !== 'fillPattern' ? {
                                blend: {
                                    color: {srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add'},
                                    alpha: {srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add'},
                                },
                            } : {}),
                        }],
                    },
                    primitive: {topology: this.drawMode === 1 /* gl.LINES */ ? 'line-list' : 'triangle-list'},
                    depthStencil: depthStencilState,
                });

                (painter as any)._rawPipelines[cacheKey] = pipeline;
            }

            const pipeline = (painter as any)._rawPipelines[cacheKey];
            const declaredBindings: Set<number> = (painter as any)._rawBindings[cacheKey];

            // Build bind group entries dynamically based on shader declarations
            const entries: any[] = [];
            if (declaredBindings.has(0) && painter.globalUBO) {
                const globalPaintBuf = painter.globalUBO.upload(device);
                entries.push({binding: 0, resource: {buffer: globalPaintBuf.handle}});
            }
            if (declaredBindings.has(1)) {
                entries.push({binding: 1, resource: {buffer: globalIndexBuf.handle}});
            }
            if (declaredBindings.has(2)) {
                entries.push({binding: 2, resource: {buffer: drawableVecBuf.handle}});
            }
            if (declaredBindings.has(4)) {
                entries.push({binding: 4, resource: {buffer: propsBuf.handle}});
            }

            const bindGroupLayout = pipeline.getBindGroupLayout(0);
            const bindGroup = gpuDevice.createBindGroup({
                layout: bindGroupLayout,
                entries,
            });

            rpEncoder.setPipeline(pipeline);
            rpEncoder.setBindGroup(0, bindGroup);

            // Bind textures at @group(1) only for shaders that declare texture bindings
            const shadersWithTextures = ['lineSDF', 'lineGradient', 'lineGradientSDF', 'linePattern', 'fillPattern', 'fillOutlinePattern'];
            const hasGroup1 = shadersWithTextures.includes(this.shaderName);

            if (hasGroup1) {
                try {
                    // Get or create a dummy texture for fallback
                    if (!(painter as any)._dummyGPUTexture) {
                        (painter as any)._dummyGPUTexture = gpuDevice.createTexture({
                            size: [1, 1], format: 'r8unorm', usage: 4 | 2,
                        });
                        gpuDevice.queue.writeTexture(
                            {texture: (painter as any)._dummyGPUTexture},
                            new Uint8Array([128]), {bytesPerRow: 1}, [1, 1]
                        );
                        (painter as any)._dummyGPUSampler = gpuDevice.createSampler({
                            minFilter: 'linear', magFilter: 'linear',
                        });
                    }

                    const texEntries: any[] = [];
                    for (let i = 0; i < Math.max(this.textures.length, 1); i++) {
                        const tex = i < this.textures.length ? this.textures[i] : null;
                        let gpuTex = tex ? (tex as any)._gpuTexture : null;
                        let gpuSampler = tex ? (tex as any)._gpuSampler : null;

                        if (!gpuTex && tex?.texture) {
                            const source = (tex as any).source;
                            if (source?.data) {
                                const format = source.format || 'rgba8unorm';
                                const bpp = source.bytesPerPixel || 4;
                                gpuTex = gpuDevice.createTexture({
                                    size: [source.width, source.height], format,
                                    usage: 4 | 2,
                                });
                                gpuDevice.queue.writeTexture(
                                    {texture: gpuTex}, source.data,
                                    {bytesPerRow: source.width * bpp},
                                    [source.width, source.height]
                                );
                                (tex as any)._gpuTexture = gpuTex;
                            }
                        }
                        if (!gpuSampler && tex) {
                            const filterMode = tex.filter === 9729 ? 'linear' : 'nearest';
                            const wrapMode = tex.wrap === 10497 ? 'repeat' : 'clamp-to-edge';
                            gpuSampler = gpuDevice.createSampler({
                                minFilter: filterMode, magFilter: filterMode,
                                addressModeU: wrapMode, addressModeV: wrapMode,
                            });
                            (tex as any)._gpuSampler = gpuSampler;
                        }

                        // Use dummy texture/sampler as fallback
                        const finalTex = gpuTex || (painter as any)._dummyGPUTexture;
                        const finalSampler = gpuSampler || (painter as any)._dummyGPUSampler;
                        texEntries.push({binding: i * 2, resource: finalSampler});
                        texEntries.push({binding: i * 2 + 1, resource: finalTex.createView()});
                    }

                    const texBindGroup = gpuDevice.createBindGroup({
                        layout: pipeline.getBindGroupLayout(1),
                        entries: texEntries,
                    });
                    rpEncoder.setBindGroup(1, texBindGroup);
                } catch (e) {
                    if (!(this as any)._loggedTexErr) {
                        (this as any)._loggedTexErr = true;
                        console.warn('[_drawWebGPU] texture bind error:', this.shaderName, e);
                    }
                }
            }

            // Set stencil reference for tile clipping (only for layers that use stencil)
            const needsStencil = this.shaderName === 'fill' || this.shaderName === 'fillOutline' || this.shaderName === 'line' ||
                this.shaderName === 'lineSDF' || this.shaderName === 'lineGradient' || this.shaderName === 'linePattern';
            if (needsStencil && this.tileID) {
                const stencilRef = painter.getWebGPUStencilRef(this.tileID);
                if (stencilRef === 0) {
                    // No stencil mask written for this tile — skip drawing to avoid inverted clipping
                    return;
                }
                rpEncoder.setStencilReference(stencilRef);
            }

            if (!this.layoutVertexBuffer.webgpuBuffer) return;
            rpEncoder.setVertexBuffer(0, this.layoutVertexBuffer.webgpuBuffer.handle);

            // Bind paint vertex buffers (data-driven properties) at slots 1+
            const paintBufs = this.programConfiguration ? this.programConfiguration.getPaintVertexBuffers() : [];
            for (let i = 0; i < paintBufs.length; i++) {
                if (paintBufs[i]?.webgpuBuffer) {
                    rpEncoder.setVertexBuffer(i + 1, paintBufs[i].webgpuBuffer.handle);
                }
            }

            rpEncoder.setIndexBuffer(this.indexBuffer.webgpuBuffer.handle, 'uint16');

            const verticesPerPrimitive = this.drawMode === 1 /* gl.LINES */ ? 2 : 3;
            const segs = this.segments.get();
            const ibByteLen = this.indexBuffer.webgpuBuffer?.props?.byteLength ?? this.indexBuffer.webgpuBuffer?.byteLength ?? -1;
            const ibSize = ibByteLen > 0 ? ibByteLen / 2 : -1; // uint16 = 2 bytes per index
            for (const segment of segs) {
                const indexCount = segment.primitiveLength * verticesPerPrimitive;
                const firstIndex = segment.primitiveOffset * verticesPerPrimitive;
                if (firstIndex + indexCount > ibSize && ibSize > 0) {
                    if (!(this as any)._loggedOOB) {
                        (this as any)._loggedOOB = true;
                        console.warn(`[OOB] ${this.shaderName} firstIndex=${firstIndex} indexCount=${indexCount} ibSize=${ibSize} vpp=${verticesPerPrimitive} primLen=${segment.primitiveLength} primOff=${segment.primitiveOffset} vertOff=${segment.vertexOffset}`);
                    }
                    continue; // skip out-of-bounds draws
                }
                rpEncoder.drawIndexed(indexCount, 1, firstIndex, segment.vertexOffset);
            }
        } catch (e) {
            if (!this._loggedDraw) {
                this._loggedDraw = true;
                console.warn('[_drawWebGPU] error:', this.shaderName, e);
            }
        }
    }

    /**
     * Upload a UniformBlock as a storage buffer (not uniform).
     * Storage buffers need STORAGE usage flag instead of UNIFORM.
     */
    private _uploadAsStorage(device: Device, ubo: UniformBlock): any {
        // Storage buffers need different usage flags than uniform buffers
        if (!(ubo as any)._storageBuffer) {
            (ubo as any)._storageBuffer = device.createBuffer({
                byteLength: ubo._byteLength,
                usage: 128 | 8 // GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
        }
        (ubo as any)._storageBuffer.write(new Uint8Array(ubo._data));
        return (ubo as any)._storageBuffer;
    }

    /**
     * Get or create the cached luma.gl Model for this drawable's shader+state combo.
     */
    private _getOrCreateModel(device: Device, painter: Painter): Model | null {
        const cacheKey = `${this.shaderName}|${renderStateHash(this.depthMode, this.stencilMode, this.colorMode, this.cullFaceMode)}`;

        let model = painter.pipelineCache.get(cacheKey);
        if (model) return model;

        const wgslKey = `${this.shaderName}Wgsl`;
        const rawWgsl = (shaders as any)[wgslKey];
        if (!rawWgsl) {
            console.warn(`[Drawable] No WGSL shader found for "${this.shaderName}"`);
            return null;
        }

        // Build defines for preprocessor
        const defines: Record<string, boolean> = {};

        if (this.shaderName === 'circle' && this.programConfiguration) {
            // Circle shader uses #ifndef for data-driven properties
            const binderAttributes = this.programConfiguration.getBinderAttributes();
            const paintProperties = ['color', 'radius', 'blur', 'opacity', 'stroke_color', 'stroke_width', 'stroke_opacity'];
            for (const prop of paintProperties) {
                const isDataDriven = binderAttributes.some(attr =>
                    attr === `a_${prop}` || attr === `a_${prop}_from` || attr === `a_${prop}_to` || attr === `a_${prop}_t`
                );
                defines[`HAS_UNIFORM_u_${prop}`] = !isDataDriven;
            }
        }

        // Preprocess WGSL (handle #ifdef/#ifndef)
        let wgslSource = preprocessWGSL(rawWgsl, defines);

        // Build VertexInput struct from layout vertex buffer attributes
        const bufferLayout: any[] = [];
        const attributes: any[] = [];
        let locationIndex = 0;
        let vertexInputStruct = 'struct VertexInput {\n';

        for (const member of this.layoutVertexBuffer.attributes) {
            const format = getWebGPUVertexFormat(member.type, member.components);
            attributes.push({
                attribute: member.name.replace('a_', ''),
                format,
                byteOffset: member.offset
            });

            let wgslType = 'vec4<f32>';
            if (format.startsWith('float32')) {
                wgslType = format === 'float32' ? 'f32' : `vec${format.charAt(format.length - 1)}<f32>`;
            } else if (format.startsWith('sint16')) {
                wgslType = format === 'sint16' ? 'i32' : `vec${format.charAt(format.length - 1)}<i32>`;
            }

            vertexInputStruct += `    @location(${locationIndex}) ${member.name.replace('a_', '')}: ${wgslType},\n`;
            locationIndex++;
        }

        // Add binder attributes for circle (data-driven paint properties)
        if (this.shaderName === 'circle' && this.programConfiguration) {
            const binderAttributes = this.programConfiguration.getBinderAttributes();
            for (const attrName of binderAttributes) {
                let wgslType = 'vec2<f32>';
                if (attrName.includes('color')) wgslType = 'vec4<f32>';

                vertexInputStruct += `    @location(${locationIndex}) ${attrName.replace('a_', '')}: ${wgslType},\n`;
                locationIndex++;
            }
        }

        vertexInputStruct += '};\n';

        // Replace or prepend VertexInput struct
        if (wgslSource.includes('struct VertexInput {')) {
            const regex = /struct\s+VertexInput\s*\{[^}]*\};/m;
            wgslSource = wgslSource.replace(regex, vertexInputStruct);
        } else {
            wgslSource = `${vertexInputStruct}\n${wgslSource}`;
        }

        bufferLayout.push({
            name: 'layout',
            byteStride: this.layoutVertexBuffer.itemSize,
            stepMode: 'vertex' as const,
            attributes
        });

        // Extract shader layout and add storage buffer workaround
        const shaderLayout = getShaderLayoutFromWGSL(wgslSource);
        shaderLayout.bindings.push({
            name: 'drawableVector',
            type: 'read-only-storage',
            group: 0,
            location: 2
        } as any);

        // Dummy storage buffer for pipeline creation
        const dummyStorageBuffer = device.createBuffer({
            byteLength: Math.max(this.drawableUBO._byteLength, 16),
            usage: 128 | 8 // STORAGE | COPY_DST
        });

        // Create initial bindings for Model creation
        const initialBindings: Record<string, any> = {
            globalIndex: device.createBuffer({byteLength: 32, usage: 64 | 8}),
            drawableVector: dummyStorageBuffer,
            props: device.createBuffer({byteLength: Math.max(this.layerUBO._byteLength, 16), usage: 64 | 8}),
        };

        if (wgslSource.includes('paintParams')) {
            initialBindings.paintParams = device.createBuffer({byteLength: 64, usage: 64 | 8});
        }

        model = new Model(device, {
            id: `${this.shaderName}-model`,
            source: wgslSource,
            topology: 'triangle-list',
            bufferLayout,
            shaderLayout,
            vertexCount: 0,
            bindings: initialBindings,
            parameters: {
                depthFormat: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less-equal',
            },
        });

        painter.pipelineCache.set(cacheKey, model);
        return model;
    }

    destroy(): void {
        if (this.drawableUBO) {
            // Also destroy the storage buffer created by _uploadAsStorage
            if ((this.drawableUBO as any)._storageBuffer) {
                (this.drawableUBO as any)._storageBuffer.destroy();
                (this.drawableUBO as any)._storageBuffer = null;
            }
            this.drawableUBO.destroy();
            this.drawableUBO = null;
        }
        if (this._globalIndexUBO) {
            this._globalIndexUBO.destroy();
            this._globalIndexUBO = null;
        }
    }
}

function getWebGPUVertexFormat(type: string, components: number): VertexFormat {
    let baseType = '';
    switch (type) {
        case 'Int8': baseType = 'sint8'; break;
        case 'Uint8': baseType = 'uint8'; break;
        case 'Int16': baseType = 'sint16'; break;
        case 'Uint16': baseType = 'uint16'; break;
        case 'Int32': baseType = 'sint32'; break;
        case 'Uint32': baseType = 'uint32'; break;
        case 'Float32': baseType = 'float32'; break;
        default: baseType = 'float32'; break;
    }
    if (components === 1) return baseType as VertexFormat;
    return `${baseType}x${components}` as VertexFormat;
}
