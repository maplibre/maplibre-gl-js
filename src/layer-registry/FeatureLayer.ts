import type {Map} from '../ui/map';
import {MapResource} from './MapResource';
import {type AddLayerObject} from '../style/style';

type LayerIcon = { name: string; img: string; w: number; h: number };

export abstract class FeatureLayer extends MapResource {
    abstract label: string;
    sources: string[] = [];
    icons: LayerIcon[] = [];
    layers: AddLayerObject[] = [];
    isEnabled: boolean;
    topLayer: string = '';
    bottomLayer: string = '';

    protected constructor(
        public id: string,
        public map: Map,
        public toggleable: boolean = false,
    ) {
        super(id, map);
        this.isEnabled = !toggleable;
        this.defineLayers();
    }

    async loadFeatureLayer(layerAbove: string | undefined): Promise<void> {
        await this.loadMapResource();
        await this.registerIcons();
        addLayersInOrder(this.map, this.layers, layerAbove);
        this.afterLoad();
    }

    afterLoad() {}

    unloadFeatureLayer() {
        for (const layer of this.layers) {
            this.map.removeLayer(layer.id);
        }
        this.unloadMapResource();
    }

    abstract defineLayers(): void;

    protected defineLayer(layer: AddLayerObject): void {
        if (!this.bottomLayer) this.bottomLayer = layer.id;
        this.topLayer = layer.id;
        this.layers.push(layer);
    }

    private async registerIcons() {
        /*const manager = this.mainMap.svgManager;

        for (const icon of this.icons) {
            if (!manager.hasImage(icon.name)) {
                await manager.add(icon.name, icon.img, icon.w, icon.h);
            }
        }*/
        for (const icon of this.icons) {
            if (!this.map.hasImage(icon.name)) {
                const image = await this.map.loadImage(icon.img);
                this.map.addImage(icon.name, image.data);
            }
        }
    }
}

/**
 * Adds feature-layers to the provided map in order below the provided aboveLayer.
 * Layers are added from low to high, meaning the first layer will be the lowest
 * and the last layer will be the highest, directly below the provided aboveLayer.
 */
export function addLayersInOrder(map: Map, layers: AddLayerObject[], aboveLayer: string | undefined) {
    for (const layer of layers.toReversed()) {
        map.addLayer(layer, aboveLayer);
        aboveLayer = layer.id;
    }
}
