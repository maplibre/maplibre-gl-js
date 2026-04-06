import type {Style} from '../style/style';
import type {StyleLayer} from '../style/style_layer';
import type {Tile} from '../tile/tile';
import type {RenderOptions} from './painter';

/**
 * Interface for render-to-texture implementations.
 * The painter uses this interface — concrete implementations live in backend folders (webgl/, webgpu/).
 */
export interface IRenderToTexture {
    prepareForRender(style: Style, zoom: number): void;
    renderLayer(layer: StyleLayer, renderOptions: RenderOptions): boolean;
    getTexture(tile: Tile): any;
    destruct(): void;
}
