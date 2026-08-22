import {describe, test, expect} from 'vitest';
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
    const feature = (align: string) => ({properties: {align}} as any);
    const dataDriven = ['get', 'align'];

    test('resolves `auto` to `viewport` for point placement', () => {
        const layer = createSymbolLayer({layout: {'symbol-placement': 'point'}});
        expect(layer.layout.get('icon-rotation-alignment').constantOr(null)).toBe('viewport');
        expect(layer.hasDataDrivenIconRotationAlignment).toBe(false);
    });

    test('resolves `auto` to `map` for line placement', () => {
        const layer = createSymbolLayer({layout: {'symbol-placement': 'line'}});
        expect(layer.layout.get('icon-rotation-alignment').constantOr(null)).toBe('map');
        expect(layer.hasDataDrivenIconRotationAlignment).toBe(false);
    });

    test('evaluates a data expression per feature', () => {
        const layer = createSymbolLayer({layout: {'icon-rotation-alignment': dataDriven}});
        expect(layer.hasDataDrivenIconRotationAlignment).toBe(true);
        expect(layer.getIconRotateWithMap(feature('map'), null)).toBe(true);
        expect(layer.getIconRotateWithMap(feature('viewport'), null)).toBe(false);
    });

    test('resolves a per-feature `auto` against `symbol-placement`', () => {
        const point = createSymbolLayer({layout: {'icon-rotation-alignment': dataDriven}});
        expect(point.getIconRotateWithMap(feature('auto'), null)).toBe(false);

        // line placement falls back to the constant for rendering, but `auto` still means `map`
        const line = createSymbolLayer({
            layout: {'symbol-placement': 'line', 'icon-rotation-alignment': dataDriven}
        });
        expect(line.getIconRotateWithMap(feature('auto'), null)).toBe(true);
    });

    test('falls back to the constant value for line placement', () => {
        const layer = createSymbolLayer({
            layout: {'symbol-placement': 'line', 'icon-rotation-alignment': dataDriven}
        });
        expect(layer.hasDataDrivenIconRotationAlignment).toBe(false);
    });

    test('falls back to the constant value for `icon-pitch-alignment: map`', () => {
        const layer = createSymbolLayer({
            layout: {'icon-pitch-alignment': 'map', 'icon-rotation-alignment': dataDriven}
        });
        expect(layer.hasDataDrivenIconRotationAlignment).toBe(false);
    });

    test('`icon-pitch-alignment: auto` inherits a constant rotation alignment', () => {
        const layer = createSymbolLayer({layout: {'icon-rotation-alignment': 'map'}});
        expect(layer.layout.get('icon-pitch-alignment')).toBe('map');
    });

    test('`icon-pitch-alignment: auto` becomes `viewport` when rotation alignment is data-driven', () => {
        const layer = createSymbolLayer({layout: {'icon-rotation-alignment': dataDriven}});
        expect(layer.layout.get('icon-pitch-alignment')).toBe('viewport');
        // and the data-driven value is still honoured
        expect(layer.hasDataDrivenIconRotationAlignment).toBe(true);
    });
});
