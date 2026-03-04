import type {Device} from '@luma.gl/core';
import type {Program} from './program';
import type {VertexBuffer} from '../gl/vertex_buffer';
import type {IndexBuffer} from '../gl/index_buffer';
import type {SegmentVector} from '../data/segment';
import type {Context} from '../gl/context';
import {VertexArrayObject} from './vertex_array_object';
import type {DepthMode} from '../gl/depth_mode';
import type {StencilMode} from '../gl/stencil_mode';
import type {ColorMode} from '../gl/color_mode';
import type {CullFaceMode} from '../gl/cull_face_mode';
import type {UniformValues} from './uniform_binding';
import type {TerrainData} from '../render/terrain';
import type {ProjectionData} from '../geo/projection/projection_data';
import type {ProgramConfiguration} from '../data/program_configuration';
import {Model} from '@luma.gl/engine';
import {getShaderLayoutFromWGSL} from '@luma.gl/shadertools';
import {shaders} from '../shaders/shaders';
import {preprocessWGSL} from './wgsl_preprocessor';
import type {VertexFormat} from '@luma.gl/core';

// Helper to map MapLibre's StructArrayMember type to WebGPU VertexFormat
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
        default: console.warn('Unknown MapLibre type', type); baseType = 'float32'; break;
    }
    if (components === 1) return baseType as VertexFormat;
    return `${baseType}x${components}` as VertexFormat;
}

export class LumaModel {
    device: Device;
    program: Program<any>;

    webgpuModel?: Model;

    constructor(
        device: Device,
        program: Program<any>,
        layoutVertexBuffer: VertexBuffer,
        indexBuffer: IndexBuffer,
        segments: SegmentVector,
        configuration?: ProgramConfiguration | null
    ) {
        this.device = device;
        this.program = program;

        if (device && device.type === 'webgpu' && program.name === 'circle') {
            try {
                // Determine defines from program if needed, for now just basic defines
                const defines: Record<string, boolean> = {
                    'HAS_UNIFORM_u_color': false,
                    'HAS_UNIFORM_u_radius': false,
                    'HAS_UNIFORM_u_blur': false,
                    'HAS_UNIFORM_u_opacity': false,
                    'HAS_UNIFORM_u_stroke_color': false,
                    'HAS_UNIFORM_u_stroke_width': false,
                    'HAS_UNIFORM_u_stroke_opacity': false
                };

                if (configuration) {
                    const activeDefines = configuration.defines();
                    for (const activeDefine of activeDefines) {
                        const defineName = activeDefine.replace('#define ', '').trim();
                        defines[defineName] = true;
                    }
                }

                // We know it's circle for this test, but we could check program.name

                // Map layoutVertexBuffer attributes to BufferLayout
                const bufferLayout = [];
                const attributes = [];
                let locationIndex = 0;
                let vertexInputStruct = 'struct VertexInput {\n';

                // If we had a way to access dynamicLayoutBuffer, dynamicLayoutBuffer2, dynamicLayoutBuffer3
                // from the constructor, we could map them here. Since we only have layoutVertexBuffer,
                // we'll check configuration for binder attributes and mock them or ideally, we should
                // pass the dynamic buffers into the LumaModel constructor too!
                // For now, let's at least declare the VertexInput fields for any extra attributes
                // required by the WGSL preprocessor that WebGPU will bind later.

                for (const member of layoutVertexBuffer.attributes) {
                    const format = getWebGPUVertexFormat(member.type, member.components);
                    attributes.push({
                        attribute: member.name.replace('a_', ''),
                        format,
                        byteOffset: member.offset
                    });

                    // Generate WGSL type mapped from VertexFormat
                    let wgslType = 'vec4<f32>';
                    if (format.startsWith('float32')) {
                        wgslType = format === 'float32' ? 'f32' : `vec${format.charAt(format.length - 1)}<f32>`;
                    } else if (format.startsWith('sint16')) {
                        wgslType = format === 'sint16' ? 'i32' : `vec${format.charAt(format.length - 1)}<i32>`;
                    }

                    vertexInputStruct += `    @location(${locationIndex}) ${member.name.replace('a_', '')}: ${wgslType},\n`;
                    locationIndex++;
                }

                const binderAttributes = configuration ? configuration.getBinderAttributes() : [];

                if (configuration) {
                    for (const attrName of binderAttributes) {
                        // Very rough mapping based on standard MapLibre data types
                        let wgslType = 'vec2<f32>'; // Fallback
                        if (attrName.includes('color')) wgslType = 'vec4<f32>';
                        else if (attrName.includes('radius') || attrName.includes('blur') || attrName.includes('opacity') || attrName.includes('width')) wgslType = 'vec2<f32>';

                        vertexInputStruct += `    @location(${locationIndex}) ${attrName.replace('a_', '')}: ${wgslType},\n`;
                        locationIndex++;
                    }

                    const activeDefines = configuration.defines();
                    for (const activeDefine of activeDefines) {
                        const defineName = activeDefine.replace('#define ', '').trim();
                        defines[defineName] = true;
                    }
                }

                // For WebGPU, properties not found in binderAttributes fallback to uniform evaluated UBO properties
                const paintProperties = ['color', 'radius', 'blur', 'opacity', 'stroke_color', 'stroke_width', 'stroke_opacity'];
                for (const prop of paintProperties) {
                    const isDataDriven = binderAttributes.some(attr =>
                        attr === `a_${prop}` ||
                        attr === `a_${prop}_from` ||
                        attr === `a_${prop}_to` ||
                        attr === `a_${prop}_t`
                    );
                    if (!isDataDriven) {
                        defines[`HAS_UNIFORM_u_${prop}`] = true;
                    } else {
                        // Ensure it's explicitly false in case it was incorrectly initialized elsewhere
                        defines[`HAS_UNIFORM_u_${prop}`] = false;
                    }
                }

                vertexInputStruct += '};\n';

                bufferLayout.push({name: 'layout', byteStride: layoutVertexBuffer.itemSize, stepMode: 'vertex', attributes});

                const preprocessedWgsl = preprocessWGSL((shaders as any).circleWgsl || '', defines);
                let wgslSource = preprocessedWgsl;
                if (preprocessedWgsl.includes('struct VertexInput {')) {
                    const regex = /struct\s+VertexInput\s*\{[^}]*\};/m;
                    wgslSource = preprocessedWgsl.replace(regex, vertexInputStruct);
                } else {
                    wgslSource = `${vertexInputStruct}\n${preprocessedWgsl}`;
                }


                // WORKAROUND: luma.gl v9.2.6 getShaderLayoutFromWGSL ignores storage buffers.
                // We extract the layout manually and inject drawableVector so WebGPU pipeline validation passes.
                const shaderLayout = getShaderLayoutFromWGSL(wgslSource);
                shaderLayout.bindings.push({
                    name: 'drawableVector',
                    type: 'read-only-storage',
                    group: 0,
                    location: 2
                } as any);

                // Dummy buffer for pipeline creation validation. Will be replaced on draw.
                const dummyBuffer = device.createBuffer({
                    byteLength: 16,
                    usage: 128 | 8 // GPUBufferUsage.STORAGE (128) | GPUBufferUsage.COPY_DST (8)
                });

                this.webgpuModel = new Model(device, {
                    id: 'circle-model',
                    source: wgslSource,
                    topology: 'triangle-list',
                    bufferLayout,
                    shaderLayout,
                    vertexCount: 0,
                    bindings: {
                        paintParams: device.createBuffer({byteLength: 64, usage: 64 | 8}), // UNIFORM | COPY_DST
                        globalIndex: device.createBuffer({byteLength: 16, usage: 64 | 8}),
                        drawableVector: dummyBuffer, // STORAGE | COPY_DST
                        props: device.createBuffer({byteLength: 64, usage: 64 | 8})
                    }
                });
            } catch (e) {
                console.error('[LumaModel] Failed to create WebGPU Model:', e);
            }
        }
    }

    draw(
        context: Context,
        drawMode: any,
        depthMode: Readonly<DepthMode>,
        stencilMode: Readonly<StencilMode>,
        colorMode: Readonly<ColorMode>,
        cullFaceMode: Readonly<CullFaceMode>,
        uniformValues: UniformValues<any>,
        terrain: TerrainData,
        projectionData: ProjectionData,
        layerID: string,
        layoutVertexBuffer: VertexBuffer,
        indexBuffer: IndexBuffer,
        segments: SegmentVector,
        currentProperties?: any,
        zoom?: number | null,
        configuration?: ProgramConfiguration | null,
        dynamicLayoutBuffer?: VertexBuffer | null,
        dynamicLayoutBuffer2?: VertexBuffer | null,
        dynamicLayoutBuffer3?: VertexBuffer | null,
        renderOptions?: any
    ) {
        const gl = context.gl;
        const program = this.program;
        const isWebGPU = this.device && this.device.type === 'webgpu';

        if (program.failedToCreate && !isWebGPU) {
            console.log(`[LumaModel.draw] program failedToCreate! layerID=${layerID}`);
            return;
        }

        // WebGPU path: skip all WebGL state and uniform setup
        if (isWebGPU) {
            if (!this.webgpuModel || !renderOptions?.renderPass) {
                return;
            }

            // TODO: pass uniformValues/projectionData/terrain to WebGPU model
            // via uniform buffers or bindings

            let primitiveSize = 3; // default triangle-list
            // drawMode constants come from WebGL, map them for primitive count
            if (gl) {
                if (drawMode === gl.LINES) primitiveSize = 2;
                else if (drawMode === gl.LINE_STRIP) primitiveSize = 1;
            }

            for (const segment of segments.get()) {
                try {
                    this.webgpuModel.setVertexCount(segment.primitiveLength * primitiveSize);
                    this.webgpuModel.draw(renderOptions.renderPass);
                } catch (e) {
                    console.error('[LumaModel.draw] WebGPU draw failed', e);
                }
            }
            return;
        }

        // WebGL path
        context.program.set(program.program);
        context.setDepthMode(depthMode);
        context.setStencilMode(stencilMode);
        context.setColorMode(colorMode);
        context.setCullFace(cullFaceMode);

        if (terrain) {
            context.activeTexture.set(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, terrain.depthTexture);
            context.activeTexture.set(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, terrain.texture);
            for (const name in program.terrainUniforms) {
                program.terrainUniforms[name].set((terrain as any)[name]);
            }
        }

        if (projectionData) {
            const projectionObjectToUniformMap: any = {
                mainMatrix: 'u_matrix',
                tileMercatorCoords: 'u_tile_mercator_coords',
                clippingPlane: 'u_clipping_plane',
                projectionTransition: 'u_projection_transition',
                fallbackMatrix: 'u_inv_rot_matrix'
            };
            for (const fieldName in projectionData) {
                const uniformName = projectionObjectToUniformMap[fieldName];
                if (program.projectionUniforms && program.projectionUniforms[uniformName]) {
                    program.projectionUniforms[uniformName].set((projectionData as any)[fieldName]);
                }
            }
        }

        if (uniformValues) {
            for (const name in program.fixedUniforms) {
                program.fixedUniforms[name].set(uniformValues[name]);
            }
        }

        if (configuration) {
            configuration.setUniforms(context, program.binderUniforms, currentProperties, {zoom: (zoom as any)});
        }

        let primitiveSize = 0;
        switch (drawMode) {
            case gl.LINES:
                primitiveSize = 2;
                break;
            case gl.TRIANGLES:
                primitiveSize = 3;
                break;
            case gl.LINE_STRIP:
                primitiveSize = 1;
                break;
        }

        for (const segment of segments.get()) {
            const vaos = segment.vaos || (segment.vaos = {});
            const vao: VertexArrayObject = vaos[layerID] || (vaos[layerID] = new VertexArrayObject());

            vao.bind(
                context,
                program,
                layoutVertexBuffer,
                configuration ? configuration.getPaintVertexBuffers() : [],
                indexBuffer,
                segment.vertexOffset,
                dynamicLayoutBuffer,
                dynamicLayoutBuffer2,
                dynamicLayoutBuffer3
            );

            gl.drawElements(
                drawMode,
                segment.primitiveLength * primitiveSize,
                gl.UNSIGNED_SHORT,
                segment.primitiveOffset * primitiveSize * 2);
        }
    }
}
