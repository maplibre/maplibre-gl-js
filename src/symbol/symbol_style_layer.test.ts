import {describe, test, expect, vi} from 'vitest';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';
import {FormatSectionOverride} from '../style/format_section_override.ts';
import properties, {type SymbolPaintPropsPossiblyEvaluated} from '../style/style_layer/symbol_style_layer_properties.g.ts';
import {type ZoomHistory} from '../style/zoom_history.ts';
import {type EvaluationParameters} from '../style/evaluation_parameters.ts';

function createSymbolLayer(layerProperties) {
    const layer = new SymbolStyleLayer(layerProperties, {});
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);
    return layer;
}

function isOverridden(paintProperty) {
    if (paintProperty.value.kind === 'source' || paintProperty.value.kind === 'composite') {
        return paintProperty.value._styleExpression.expression instanceof FormatSectionOverride;
    }
    return false;
}

describe('setPaintOverrides', () => {
    test('setPaintOverrides, no overrides', () => {
        const layer = createSymbolLayer({});
        layer._setPaintOverrides();
        for (const overridable of properties.paint.overridableProperties) {
            expect(isOverridden(layer.paint.get(overridable as keyof SymbolPaintPropsPossiblyEvaluated))).toBe(false);
        }

    });

    test('setPaintOverrides, format expression, overridden text-color', () => {
        const props = {layout: {'text-field': ['format', 'text', {'text-color': 'yellow'}]}};
        const layer = createSymbolLayer(props);
        layer._setPaintOverrides();
        expect(isOverridden(layer.paint.get('text-color'))).toBe(true);

    });

    test('setPaintOverrides, format expression, no overrides', () => {
        const props = {layout: {'text-field': ['format', 'text', {}]}};
        const layer = createSymbolLayer(props);
        layer._setPaintOverrides();
        expect(isOverridden(layer.paint.get('text-color'))).toBe(false);

    });

});

describe('hasPaintOverrides', () => {
    test('undefined', () => {
        const layer = createSymbolLayer({});
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toBe(false);

    });

    test('constant, Formatted type, overridden text-color', () => {
        const props = {layout: {'text-field': ['format', 'text', {'text-color': 'red'}]}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toBe(true);

    });

    test('constant, Formatted type, no overrides', () => {
        const props = {layout: {'text-field': ['format', 'text', {'font-scale': 0.8}]}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toBe(false);

    });

    test('format expression, overridden text-color', () => {
        const props = {layout: {'text-field': ['format', ['get', 'name'], {'text-color': 'red'}]}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toBe(true);

    });

    test('format expression, no overrides', () => {
        const props = {layout: {'text-field': ['format', ['get', 'name'], {}]}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toBe(false);

    });

    test('nested expression, overridden text-color', () => {
        const matchExpr = ['match', ['get', 'case'],
            'one', ['format', 'color', {'text-color': 'blue'}],
            'default'];
        const props = {layout: {'text-field': matchExpr}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toBe(true);

    });

    test('nested expression, no overrides', () => {
        const matchExpr = ['match', ['get', 'case'],
            'one', ['format', 'b&w', {}],
            'default'];
        const props = {layout: {'text-field': matchExpr}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toBe(false);

    });

});

describe('icon-rotation-alignment', () => {
    const dataDrivenAlignment = ['get', 'alignment'];
    const feature = (alignment: string) => ({properties: {alignment}} as any);

    test('evaluates a data expression for each feature', () => {
        const layer = createSymbolLayer({layout: {'icon-rotation-alignment': dataDrivenAlignment}});

        expect(layer.hasDataDrivenIconRotationAlignment).toBe(true);
        expect(layer.iconRotatesWithMap(feature('map'), null)).toBe(true);
        expect(layer.iconRotatesWithMap(feature('viewport'), null)).toBe(false);
    });

    test('resolves a data-driven `auto` value from point placement', () => {
        const layer = createSymbolLayer({layout: {
            'symbol-placement': 'point',
            'icon-rotation-alignment': dataDrivenAlignment
        }});

        expect(layer.iconRotatesWithMap(feature('auto'), null)).toBe(false);
    });

    test('falls back to layer-wide alignment for line placement', () => {
        const layer = createSymbolLayer({layout: {
            'symbol-placement': 'line',
            'icon-rotation-alignment': dataDrivenAlignment
        }});

        expect(layer.hasDataDrivenIconRotationAlignment).toBe(false);
        expect(layer.layout.get('icon-rotation-alignment').constantOr(null)).toBe('map');
    });

    test('uses viewport pitch for data-driven rotation alignment', () => {
        const layer = createSymbolLayer({layout: {'icon-rotation-alignment': dataDrivenAlignment}});

        expect(layer.layout.get('icon-pitch-alignment')).toBe('viewport');
    });

    test('warns and uses the point-placement fallback with map-aligned pitch', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const layer = createSymbolLayer({
            id: 'map-pitch',
            type: 'symbol',
            layout: {
                'icon-pitch-alignment': 'map',
                'icon-rotation-alignment': dataDrivenAlignment
            }
        });

        expect(layer.hasDataDrivenIconRotationAlignment).toBe(false);
        expect(layer.layout.get('icon-rotation-alignment').constantOr(null)).toBe('viewport');
        expect(warn).toHaveBeenCalledWith(
            'map-pitch: data-driven "icon-rotation-alignment" is not supported with "icon-pitch-alignment": "map".'
        );
        warn.mockRestore();
    });
});
