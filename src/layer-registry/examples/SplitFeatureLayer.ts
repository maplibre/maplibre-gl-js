import {FeatureLayer} from '../FeatureLayer';

/**
 * A feature layer that has its source in a separate file.
 * The sources property is not set, and no sources are added or removed in here.
 */
export class BasicFeatureLayer extends FeatureLayer {
    label: 'BasicFeatureLayer';
    id: 'basic-feature-layer';
    sources: ['split-feature-source']; // multiple sources are possible

    defineLayers(): void { // could be put in a separate file if needed "export function defineMissionLayers(defineLayer: FeatureLayer['defineLayer']) {…}"
        this.defineLayer({
            id: 'border-line',
            type: 'line',
            source: 'split-feature-source',
            paint: {
                'line-color': '#fff',
            },
        });
    }

    async load() {
        this.map.on('click', 'split-feature-source', this.onClick);
    }

    unload() {
        this.map.off('click', 'split-feature-source', this.onClick);
    }

    private onClick = () => {};
}
