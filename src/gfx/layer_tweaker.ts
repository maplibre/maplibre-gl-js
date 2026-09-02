import type {Drawable} from './drawable.ts';
import type {Painter} from '../render/painter.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import type {OverscaledTileID} from '../tile/tile_id.ts';
import type {UniformBlock} from './uniform_block.ts';

/**
 * Base class for per-frame uniform updaters.
 * Each layer type implements a tweaker that updates UBOs
 * for its drawables each frame (matrices, interpolation factors, etc.).
 */
export abstract class LayerTweaker {
    layerId: string;
    evaluatedPropsUBO: UniformBlock | null;
    propertiesUpdated: boolean;

    constructor(layerId: string) {
        this.layerId = layerId;
        this.evaluatedPropsUBO = null;
        this.propertiesUpdated = true;
    }

    /**
     * Called once per frame. Updates layer-level UBO (if properties changed)
     * and per-drawable UBOs (matrix, interpolation factors).
     */
    abstract execute(
        drawables: Drawable[],
        painter: Painter,
        layer: StyleLayer,
        coords: OverscaledTileID[]
    ): void;

    destroy(): void {
        if (this.evaluatedPropsUBO) {
            this.evaluatedPropsUBO.destroy();
            this.evaluatedPropsUBO = null;
        }
    }
}
