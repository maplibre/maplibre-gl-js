import {FeatureLayer} from '../FeatureLayer';

/**
 * A basic feature layer that can be used as a template for creating new feature layers.
 * It is self-sufficient and does not require any additional dependencies.
 * The sources property is not set, instead it adds and removes its own source.
 */
export class BasicFeatureLayer extends FeatureLayer {
    label: 'BasicFeatureLayer';
    id: 'basic-feature-layer';
    icons: [ { name: 'example-icon'; img: ''; w: 10; h: 10 }]; // tod0 test & fix this I only used svg manager before

    defineLayers(): void {
        this.defineLayer({
            id: 'border-line',
            type: 'line',
            source: 'basic-feature-layer-source',
            paint: {
                'line-color': '#fff',
            },
        });
    }

    async load() {
        this.map.addSource('basic-feature-layer-source', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []},
        });
        this.map.on('click', 'border-line', this.onClick);
    }

    unload() {
        this.map.removeSource('basic-feature-layer-source');
        this.map.off('click', 'border-line', this.onClick);
    }

    private onClick = () => {};
}
