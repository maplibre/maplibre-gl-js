import {Drawable} from './drawable';
import type {DrawableTexture} from './drawable';
import type {DepthMode} from '../../gl/depth_mode';
import type {StencilMode} from '../../gl/stencil_mode';
import type {ColorMode} from '../../gl/color_mode';
import type {CullFaceMode} from '../../gl/cull_face_mode';
import type {LayerTweaker} from './layer_tweaker';
import type {OverscaledTileID} from '../../tile/tile_id';
import type {VertexBuffer} from '../../gl/vertex_buffer';
import type {IndexBuffer} from '../../gl/index_buffer';
import type {SegmentVector} from '../../data/segment';
import type {ProgramConfiguration} from '../../data/program_configuration';
import type {Program} from '../program';
import type {StyleLayer} from '../../style/style_layer';
import type {ProjectionData} from '../../geo/projection/projection_data';
import type {TerrainData} from '../terrain';

/**
 * Factory for creating Drawable objects from bucket data.
 * Uses a builder pattern for clean configuration.
 */
export class DrawableBuilder {
    private _shaderName: string = '';
    private _renderPass: 'opaque' | 'translucent' | 'offscreen' = 'translucent';
    private _depthMode: Readonly<DepthMode> | null = null;
    private _stencilMode: Readonly<StencilMode> | null = null;
    private _colorMode: Readonly<ColorMode> | null = null;
    private _cullFaceMode: Readonly<CullFaceMode> | null = null;
    private _drawPriority: number = 0;
    private _subLayerIndex: number = 0;
    private _layerTweaker: LayerTweaker | null = null;
    private _textures: DrawableTexture[] = [];
    private _drawMode: number = 4; // gl.TRIANGLES

    setShader(name: string): this {
        this._shaderName = name;
        return this;
    }

    setRenderPass(pass: 'opaque' | 'translucent' | 'offscreen'): this {
        this._renderPass = pass;
        return this;
    }

    setDepthMode(mode: Readonly<DepthMode>): this {
        this._depthMode = mode;
        return this;
    }

    setStencilMode(mode: Readonly<StencilMode> | null): this {
        this._stencilMode = mode;
        return this;
    }

    setColorMode(mode: Readonly<ColorMode>): this {
        this._colorMode = mode;
        return this;
    }

    setCullFaceMode(mode: Readonly<CullFaceMode>): this {
        this._cullFaceMode = mode;
        return this;
    }

    setDrawPriority(priority: number): this {
        this._drawPriority = priority;
        return this;
    }

    setSubLayerIndex(index: number): this {
        this._subLayerIndex = index;
        return this;
    }

    setLayerTweaker(tweaker: LayerTweaker): this {
        this._layerTweaker = tweaker;
        return this;
    }

    addTexture(tex: DrawableTexture): this {
        this._textures.push(tex);
        return this;
    }

    setDrawMode(mode: number): this {
        this._drawMode = mode;
        return this;
    }

    /**
     * Build a Drawable from bucket data. This is the common case.
     */
    flush(params: {
        tileID: OverscaledTileID;
        layer: StyleLayer;
        program?: Program<any> | null;
        programConfiguration: ProgramConfiguration;
        layoutVertexBuffer: VertexBuffer;
        indexBuffer: IndexBuffer;
        segments: SegmentVector;
        dynamicLayoutBuffer?: VertexBuffer | null;
        dynamicLayoutBuffer2?: VertexBuffer | null;
        projectionData?: ProjectionData | null;
        terrainData?: TerrainData | null;
        paintProperties?: any;
        zoom?: number | null;
    }): Drawable {
        const drawable = new Drawable();

        drawable.name = `${this._shaderName}:${params.tileID.key}`;
        drawable.tileID = params.tileID;
        drawable.shaderName = this._shaderName;
        drawable.programConfiguration = params.programConfiguration;

        // Vertex data
        drawable.layoutVertexBuffer = params.layoutVertexBuffer;
        drawable.indexBuffer = params.indexBuffer;
        drawable.segments = params.segments;
        drawable.dynamicLayoutBuffer = params.dynamicLayoutBuffer || null;
        drawable.dynamicLayoutBuffer2 = params.dynamicLayoutBuffer2 || null;

        // Pipeline state
        drawable.depthMode = this._depthMode!;
        drawable.stencilMode = this._stencilMode!;
        drawable.colorMode = this._colorMode!;
        drawable.cullFaceMode = this._cullFaceMode!;

        // Render pass & ordering
        drawable.renderPass = this._renderPass;
        drawable.drawPriority = this._drawPriority;
        drawable.subLayerIndex = this._subLayerIndex;

        // Tweaker
        drawable.layerTweaker = this._layerTweaker;

        // Textures
        drawable.textures = [...this._textures];

        // GL program for WebGL path
        drawable._glProgram = params.program || null;

        // Projection & terrain
        drawable.projectionData = params.projectionData || null;
        drawable.terrainData = params.terrainData || null;

        // Paint properties for binder uniforms
        drawable._paintProperties = params.paintProperties || null;
        drawable._zoom = params.zoom ?? null;
        drawable._layerID = params.layer.id;

        return drawable;
    }
}
