import type {Style} from '../style/style.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import type {Tile} from '../tile/tile.ts';
import type {RenderOptions} from './render_options.ts';

/**
 * Interface for render-to-texture implementations.
 * The painter uses this interface — concrete implementations live in backend folders (webgl/, webgpu/).
 */
export interface IRenderToTexture {
    /**
     * Whether the render loop needs a follow-up frame to refresh cached textures retained while zooming.
     */
    needsFollowUpFrame: boolean;
    prepareForRender(style: Style, zoom: number): void;
    renderLayer(layer: StyleLayer, renderOptions: RenderOptions): boolean;
    getTexture(tile: Tile): any;
}
