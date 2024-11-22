import {getOverlapMode} from './overlap_mode';
import {SymbolStyleLayer} from './symbol_style_layer';
import {ZoomHistory} from '../zoom_history';
import {EvaluationParameters} from '../evaluation_parameters';

function createSymbolLayer(layerProperties) {
    const layer = new SymbolStyleLayer(layerProperties);
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);
    return layer;
}

describe('getOverlapMode', () => {
    test('defaults - no props set', () => {
        const props = {};
        const layer = createSymbolLayer(props);

        expect(getOverlapMode(layer.layout, 'icon-overlap', 'icon-allow-overlap')).toBe('never');
        expect(getOverlapMode(layer.layout, 'text-overlap', 'text-allow-overlap')).toBe('never');
    });

    test('-allow-overlap set', () => {
        const props = {layout: {'icon-allow-overlap': false, 'text-allow-overlap': true}};
        const layer = createSymbolLayer(props);

        expect(getOverlapMode(layer.layout, 'icon-overlap', 'icon-allow-overlap')).toBe('never');
        expect(getOverlapMode(layer.layout, 'text-overlap', 'text-allow-overlap')).toBe('always');
    });

    test('-overlap set', () => {
        let props = {layout: {'icon-overlap': 'never', 'text-overlap': 'always'}};
        let layer = createSymbolLayer(props);

        expect(getOverlapMode(layer.layout, 'icon-overlap', 'icon-allow-overlap')).toBe('never');
        expect(getOverlapMode(layer.layout, 'text-overlap', 'text-allow-overlap')).toBe('always');

        props = {layout: {'icon-overlap': 'always', 'text-overlap': 'cooperative'}};
        layer = createSymbolLayer(props);

        expect(getOverlapMode(layer.layout, 'icon-overlap', 'icon-allow-overlap')).toBe('always');
        expect(getOverlapMode(layer.layout, 'text-overlap', 'text-allow-overlap')).toBe('cooperative');
    });

    test('-overlap beats -allow-overlap', () => {
        const props = {
            layout: {
                'icon-overlap': 'never',
                'icon-allow-overlap': true,
                'text-overlap': 'cooperative',
                'text-allow-overlap': false
            }
        };
        const layer = createSymbolLayer(props);

        expect(getOverlapMode(layer.layout, 'icon-overlap', 'icon-allow-overlap')).toBe('never');
        expect(getOverlapMode(layer.layout, 'text-overlap', 'text-allow-overlap')).toBe('cooperative');
    });
});
