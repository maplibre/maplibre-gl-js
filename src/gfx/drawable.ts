import {UBO_BINDINGS} from './ubo_bindings.ts';
import {VertexArrayObject} from '../webgl/vertex_array_object.ts';
import {projectionObjectToUniformMap} from '../webgl/program/projection_program.ts';

import type {UniformBlock} from './uniform_block.ts';
import type {Painter} from '../render/painter.ts';
import type {DepthMode} from '../webgl/depth_mode.ts';
import type {StencilMode} from '../webgl/stencil_mode.ts';
import type {ColorMode} from '../webgl/color_mode.ts';
import type {CullFaceMode} from '../webgl/cull_face_mode.ts';
import type {VertexBuffer} from '../webgl/vertex_buffer.ts';
import type {IndexBuffer} from '../webgl/index_buffer.ts';
import type {SegmentVector} from '../data/segment.ts';
import type {ProgramConfiguration} from '../data/program_configuration.ts';
import type {ProjectionData} from '../geo/projection/projection_data.ts';
import type {TerrainData} from '../render/terrain.ts';

/**
 * A texture binding attached to a Drawable. Bound in `Drawable.draw()` ahead
 * of the draw call. `filter` and `wrap` are applied if provided (matching the
 * existing `painter.imageManager.bind` shape for pattern texture flow).
 */
export type DrawableTexture = {
    textureUnit: number;
    texture: WebGLTexture;
    filter?: number;
    wrap?: number;
};

export type DrawableOptions = {
    shaderName: string;
    layerID: string;
    depthMode: Readonly<DepthMode>;
    stencilMode: Readonly<StencilMode>;
    colorMode: Readonly<ColorMode>;
    cullFaceMode: Readonly<CullFaceMode>;

    layoutVertexBuffer: VertexBuffer | null;
    indexBuffer: IndexBuffer | null;
    segments: SegmentVector;

    programConfiguration: ProgramConfiguration | null;

    layerUBO: UniformBlock | null;
    drawableUBO: UniformBlock | null;

    textures: readonly DrawableTexture[];

    terrainData: TerrainData | null;
    projectionData: ProjectionData | null;
};

/**
 * Self-contained draw call.
 *
 * Built per-frame by the per-layer draw function (e.g. `drawBackground`),
 * carrying everything `draw()` needs to issue GL calls without consulting any
 * mutable shared state. Resolves its GLSL program lazily via
 * `painter.useProgram(this.shaderName)`.
 *
 * Mid-2.x: only Background uses Drawable; other layers still go through
 * `Program.draw()`. Both paths coexist until the migration is complete.
 */
export class Drawable {
    readonly shaderName: string;
    readonly layerID: string;
    readonly depthMode: Readonly<DepthMode>;
    readonly stencilMode: Readonly<StencilMode>;
    readonly colorMode: Readonly<ColorMode>;
    readonly cullFaceMode: Readonly<CullFaceMode>;

    readonly layoutVertexBuffer: VertexBuffer | null;
    readonly indexBuffer: IndexBuffer | null;
    readonly segments: SegmentVector;

    readonly programConfiguration: ProgramConfiguration | null;

    readonly layerUBO: UniformBlock | null;
    readonly drawableUBO: UniformBlock | null;

    readonly textures: readonly DrawableTexture[];

    readonly terrainData: TerrainData | null;
    readonly projectionData: ProjectionData | null;

    constructor(options: DrawableOptions) {
        this.shaderName = options.shaderName;
        this.layerID = options.layerID;
        this.depthMode = options.depthMode;
        this.stencilMode = options.stencilMode;
        this.colorMode = options.colorMode;
        this.cullFaceMode = options.cullFaceMode;
        this.layoutVertexBuffer = options.layoutVertexBuffer;
        this.indexBuffer = options.indexBuffer;
        this.segments = options.segments;
        this.programConfiguration = options.programConfiguration;
        this.layerUBO = options.layerUBO;
        this.drawableUBO = options.drawableUBO;
        this.textures = options.textures;
        this.terrainData = options.terrainData;
        this.projectionData = options.projectionData;
    }

    draw(painter: Painter): void {
        const context = painter.context;
        const gl = context.gl;

        const program = painter.useProgram(this.shaderName, this.programConfiguration);
        if (program.failedToCreate) return;

        context.program.set(program.program);
        context.setDepthMode(this.depthMode);
        context.setStencilMode(this.stencilMode);
        context.setColorMode(this.colorMode);
        context.setCullFace(this.cullFaceMode);

        if (this.terrainData) {
            const terrain = this.terrainData;
            context.activeTexture.set(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, terrain.depthTexture);
            context.activeTexture.set(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, terrain.texture);
            for (const name in program.terrainUniforms) {
                program.terrainUniforms[name].set(terrain[name]);
            }
        }

        if (this.projectionData) {
            const projection = this.projectionData;
            for (const fieldName in projection) {
                const uniformName = projectionObjectToUniformMap[fieldName];
                program.projectionUniforms[uniformName]?.set(projection[fieldName]);
            }
        }

        if (this.layerUBO?.buffer) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO_BINDINGS.LayerUBO, this.layerUBO.buffer);
        }
        if (this.drawableUBO?.buffer) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO_BINDINGS.DrawableUBO, this.drawableUBO.buffer);
        }

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

        const PRIMITIVE_SIZE = 3;       // TRIANGLES
        const INDEX_BYTES = 2;          // UNSIGNED_SHORT

        for (const segment of this.segments.get()) {
            segment.vaos ||= {};
            segment.vaos[this.layerID] ||= new VertexArrayObject();
            segment.vaos[this.layerID].bind(
                context,
                program,
                this.layoutVertexBuffer,
                this.programConfiguration ? this.programConfiguration.getPaintVertexBuffers() : [],
                this.indexBuffer,
                segment.vertexOffset,
            );
            gl.drawElements(
                gl.TRIANGLES,
                segment.primitiveLength * PRIMITIVE_SIZE,
                gl.UNSIGNED_SHORT,
                segment.primitiveOffset * PRIMITIVE_SIZE * INDEX_BYTES,
            );
        }
    }
}
