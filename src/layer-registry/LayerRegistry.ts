import {type FeatureLayer} from './FeatureLayer';
import {type MapResource} from './MapResource';
import type {Map} from '../ui/map';

type FeatureLayerSettings = { [layerName: string]: boolean };

/**
 * LayerRegistry manages the lifecycle of feature layers and their associated map resources.
 * It ensures that layers are loaded and unloaded in the correct order, and that sources are available before layers are loaded.
 * This helps manage the lifecycle of multiple complex features and their associated map resources.
 */
export class LayerRegistry<T extends FeatureLayerSettings> {
    private sources: MapResource[] = [];
    private featureLayers: FeatureLayer[] = [];

    constructor(private map: Map) {}

    public addSource(source: MapResource): void {
        this.sources.push(source);
    }

    // z-order: first layer added is bottom, last top
    public async addLayer(layer: FeatureLayer): Promise<void> {
        for (const sourceId of layer.sources) {
            const source = this.sources.find((s) => s.id === sourceId);
            if (!source) {
                throw new Error(`Source ${sourceId} not found. Required by layer ${layer.id}.`);
            }
        }

        this.featureLayers.push(layer);

        if (layer.isEnabled) {
            await this.loadLayer(layer.id);
        }
        document.dispatchEvent(new LayersChangedEvent());
    }

    public findLayer(id: keyof T): FeatureLayer | undefined {
        return this.featureLayers.find((layer) => layer.id === id);
    }

    public async reloadLayers(): Promise<void> {
        for (const layer of this.featureLayers) {
            if (layer.isEnabled) {
                await this.loadLayer(layer.id);
            }
        }
    }

    public unloadLayers() {
        for (const layer of this.featureLayers) {
            if (layer.isLoaded) {
                try {
                    layer.unloadFeatureLayer();
                } catch (e) {
                    console.warn('Error unloading feature layer', layer.id, e);
                }
            }
        }

        for (const source of this.sources) {
            if (source.isLoaded) {
                try {
                    source.unloadMapResource();
                } catch (e) {
                    console.warn('Error unloading map resource', source.id, e);
                }
            }
        }
    }

    public async toggleLayer(layer: FeatureLayer): Promise<void> {
        layer.isEnabled = !layer.isEnabled;

        if (layer.isEnabled) {
            await this.loadLayer(layer.id);
        } else {
            await this.unloadLayer(layer.id);
        }

        document.dispatchEvent(new LayersToggledEvent(layer));
    }

    private unloadUnusedSources(layer: FeatureLayer): void {
        for (const sourceId of layer.sources) {
            const isStillNeeded = this.featureLayers.some((l) => l.isLoaded && l.sources.includes(sourceId));

            if (!isStillNeeded) {
                const source = this.sources.find((s) => s.id === sourceId);
                if (source?.isLoaded) {
                    source.unloadMapResource();
                }
            }
        }
    }

    public async loadLayer(layerId: keyof T): Promise<void> {
        const layer = this.findLayer(layerId);
        if (!layer || layer.isLoaded) return;
        layer.isEnabled = true;

        if (layer.sources.length > 0) {
            for (const sourceId of layer.sources) {
                await this.loadSource(sourceId);
            }
        }

        const layerAbove = this.getAboveLayerId(layer);
        await layer.loadFeatureLayer(layerAbove);
    }

    private async loadSource(sourceId: string): Promise<void> {
        const source = this.sources.find((s) => s.id === sourceId);
        if (!source) {
            throw new Error(`Source ${sourceId} not found`);
        }

        if (!source.isLoaded) {
            await source.loadMapResource();
        }
    }

    public unloadLayer(layerId: keyof T) {
        const layer = this.findLayer(layerId);
        if (!layer?.isLoaded) return;
        layer.isEnabled = false;
        layer.unloadFeatureLayer();
        this.unloadUnusedSources(layer);
    }

    private getAboveLayerId(layer: FeatureLayer): string | undefined {
        if (!layer.topLayer) return undefined;

        const layerOrderDefinition = this.featureLayers.flatMap((x) => [x.topLayer, x.bottomLayer]);
        const aboveLayerIds = this.getLayersAbove(layerOrderDefinition, layer.topLayer);

        const activeLayers = this.map.getLayersOrder();

        return activeLayers.find((layerId) => aboveLayerIds.includes(layerId));
    }

    private getLayersAbove(layers: string[], splitAt: string): string[] {
        const idx = layers.indexOf(splitAt);
        return idx == -1 ? [] : layers.slice(idx + 1);
    }
}

export class LayersChangedEvent extends CustomEvent<void> {
    constructor() {
        super('layers-changed', {bubbles: true});
    }
}
export class LayersToggledEvent extends CustomEvent<FeatureLayer> {
    constructor(value: FeatureLayer) {
        super('layer-toggled', {bubbles: true, detail: value});
    }
}

declare global {
    interface DocumentEventMap {
        'layers-changed': LayersChangedEvent;
        'layer-toggled': LayersToggledEvent;
    }
}
