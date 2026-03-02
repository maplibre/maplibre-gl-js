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

export class LumaModel {
    device: Device;
    program: Program<any>;

    constructor(
        device: Device,
        program: Program<any>,
        layoutVertexBuffer: VertexBuffer,
        indexBuffer: IndexBuffer,
        segments: SegmentVector
    ) {
        this.device = device;
        this.program = program;
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
        dynamicLayoutBuffer3?: VertexBuffer | null
    ) {
        const gl = context.gl;
        const program = this.program;

        if (program.failedToCreate) return;

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
                if (program.projectionUniforms[uniformName]) {
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
