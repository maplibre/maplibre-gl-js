import {StencilMode} from './stencil_mode.ts';
import {CullFaceMode} from './cull_face_mode.ts';
import {getProjectionDataForTile, getTerrainDataForTile, type RenderContext, type RenderPass} from '../render/render_context.ts';

import type {Program, DrawMode} from './program.ts';
import type {UniformBindings, UniformValues} from './uniform_binding.ts';
import type {Mesh} from '../render/mesh.ts';
import type {Context} from './context.ts';
import type {Painter} from '../render/painter.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {DepthMaskType} from './types.ts';

type DrawableTextureBinding = {
    unit: number;
    texture: {bind(context: Context): void};
};

/** One draw call of a layer over one tile, kept between frames. */
class Drawable<Us extends UniformBindings> {
    program: Program<Us>;
    mesh: Mesh;
    layerID: string;
    drawMode: DrawMode;
    required: boolean = false;
    uniformValues: UniformValues<Us>;
    renderPass: RenderPass;
    depthMask: DepthMaskType;
    cullFaceMode: Readonly<CullFaceMode> = CullFaceMode.disabled;
    textures: DrawableTextureBinding[] = [];

    constructor(program: Program<Us>, mesh: Mesh, layerID: string, drawMode: DrawMode) {
        this.program = program;
        this.mesh = mesh;
        this.layerID = layerID;
        this.drawMode = drawMode;
    }

    draw(painter: Painter, renderContext: RenderContext, tileID: OverscaledTileID): void {
        if (this.renderPass !== renderContext.currentPass) return;

        const context = painter.context;
        const projectionData = getProjectionDataForTile(renderContext, tileID);
        const terrain = getTerrainDataForTile(renderContext, tileID);
        for (const {unit, texture} of this.textures) {
            context.activeTexture.set(context.gl.TEXTURE0 + unit);
            texture.bind(context);
        }
        const depthMode = painter.getDepthModeForSublayer(0, this.depthMask);
        const colorMode = painter.colorModeForRenderPass();
        this.program.draw(context, this.drawMode, depthMode, StencilMode.disabled, colorMode, this.cullFaceMode,
            this.uniformValues, terrain, projectionData, this.layerID,
            this.mesh.vertexBuffer, this.mesh.indexBuffer, this.mesh.segments);
    }
}

/**
 * @internal
 * A layer's drawables by tile key, kept while they are requested each frame, whether or not they draw.
 */
export class DrawableCollection<Us extends UniformBindings> {
    entries: Map<string, Drawable<Us>> = new Map();

    request(key: string, program: Program<Us>, mesh: Mesh, layerID: string, drawMode: DrawMode): Drawable<Us> {
        let drawable = this.entries.get(key);
        if (!drawable) {
            drawable = new Drawable(program, mesh, layerID, drawMode);
            this.entries.set(key, drawable);
        }
        drawable.program = program;
        drawable.mesh = mesh;
        drawable.required = true;
        return drawable;
    }

    removeUnrequested(): void {
        for (const [key, drawable] of this.entries) {
            if (!drawable.required) this.entries.delete(key);
            drawable.required = false;
        }
    }
}
