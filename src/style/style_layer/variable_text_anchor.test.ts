import {describe, test, expect} from 'vitest';
import {type EvaluationParameters} from '../evaluation_parameters';
import {type ZoomHistory} from '../zoom_history';
import {SymbolStyleLayer} from './symbol_style_layer';
import {INVALID_TEXT_OFFSET, evaluateVariableOffset, getTextVariableAnchorOffset} from './variable_text_anchor';

describe('evaluateVariableOffset', () => {
    test('fromRadialOffset', () => {
        // Radial offset mode is invoked by using INVALID_TEXT_OFFSET as the Y value
        const srcOffset = [10, INVALID_TEXT_OFFSET] as [number, number];

        expect(evaluateVariableOffset('center', srcOffset)).toEqual([0, 0]);

        // Top/bottom offsets are shifted by the default baseline (7)
        expect(evaluateVariableOffset('top', srcOffset)).toEqual([0, 3]);
        expect(evaluateVariableOffset('bottom', srcOffset)).toEqual([0, -3]);
        expect(evaluateVariableOffset('left', srcOffset)).toEqual([10, 0]);
        expect(evaluateVariableOffset('right', srcOffset)).toEqual([-10, 0]);

        const hypotenuse = 10 / Math.SQRT2;
        expect(evaluateVariableOffset('top-left', srcOffset)).toEqual([expect.closeTo(hypotenuse), expect.closeTo(hypotenuse - 7)]);
        expect(evaluateVariableOffset('top-right', srcOffset)).toEqual([expect.closeTo(-hypotenuse), expect.closeTo(hypotenuse - 7)]);
        expect(evaluateVariableOffset('bottom-left', srcOffset)).toEqual([expect.closeTo(hypotenuse), expect.closeTo(-hypotenuse + 7)]);
        expect(evaluateVariableOffset('bottom-right', srcOffset)).toEqual([expect.closeTo(-hypotenuse), expect.closeTo(-hypotenuse + 7)]);
    });

    test('fromTextOffset', () => {
        const srcOffset = [10, -10] as [number, number];

        expect(evaluateVariableOffset('center', srcOffset)).toEqual([0, 0]);

        // Top/bottom offsets are shifted by the default baseline (7)
        expect(evaluateVariableOffset('top', srcOffset)).toEqual([0, 3]);
        expect(evaluateVariableOffset('bottom', srcOffset)).toEqual([0, -3]);
        expect(evaluateVariableOffset('left', srcOffset)).toEqual([10, 0]);
        expect(evaluateVariableOffset('right', srcOffset)).toEqual([-10, 0]);
        expect(evaluateVariableOffset('top-left', srcOffset)).toEqual([10, 3]);
        expect(evaluateVariableOffset('top-right', srcOffset)).toEqual([-10, 3]);
        expect(evaluateVariableOffset('bottom-left', srcOffset)).toEqual([10, -3]);
        expect(evaluateVariableOffset('bottom-right', srcOffset)).toEqual([-10, -3]);
    });
});

function createSymbolLayer(layerProperties) {
    const layer = new SymbolStyleLayer(layerProperties);
    layer.recalculate({zoom: 0, zoomHistory: {} as ZoomHistory} as EvaluationParameters, []);
    return layer;
}

describe('getTextVariableAnchorOffset', () => {
    test('defaults - no props set', () => {
        const props = {};
        const layer = createSymbolLayer(props);

        expect(getTextVariableAnchorOffset(layer, null, null)).toBeNull();
    });

    test('text-variable-anchor-offset set', () => {
        const props = {layout: {'text-variable-anchor-offset': ['top', [1, 1], 'bottom', [2, 2]]}};
        const layer = createSymbolLayer(props);

        const offset = getTextVariableAnchorOffset(layer, null, null);
        expect(offset).toBeDefined();
        // Offset converted to EMs, accounting for baseline shift on Y axis
        expect(offset.toString()).toBe('["top",[24,17],"bottom",[48,55]]');
    });

    test('text-variable-anchor set', () => {
        const props = {layout: {'text-variable-anchor': ['top']}};
        const layer = createSymbolLayer(props);

        const offset = getTextVariableAnchorOffset(layer, null, null);
        expect(offset).toBeDefined();
        // Default offset (0, 0) converted to EMs, accounting for baseline shift on Y axis
        expect(offset.toString()).toBe('["top",[0,-7]]');
    });

    test('text-variable-anchor and text-offset set', () => {
        const props = {layout: {'text-variable-anchor': ['top'], 'text-offset': [1, 1]}};
        const layer = createSymbolLayer(props);

        const offset = getTextVariableAnchorOffset(layer, null, null);
        expect(offset).toBeDefined();
        // Offset converted to EMs, accounting for baseline shift on Y axis
        expect(offset.toString()).toBe('["top",[0,17]]');
    });

    test('text-variable-anchor and text-radial-offset set', () => {
        const props = {layout: {'text-variable-anchor': ['top'], 'text-radial-offset': 2}};
        const layer = createSymbolLayer(props);

        const offset = getTextVariableAnchorOffset(layer, null, null);
        expect(offset).toBeDefined();
        // Offset converted to EMs, accounting for baseline shift on Y axis
        expect(offset.toString()).toBe('["top",[0,41]]');
    });

    test('text-variable-anchor, text-offset, and text-radial-offset set', () => {
        const props = {layout: {'text-variable-anchor': ['top'], 'text-offset': [1, 1], 'text-radial-offset': 2}};
        const layer = createSymbolLayer(props);

        const offset = getTextVariableAnchorOffset(layer, null, null);
        expect(offset).toBeDefined();
        // Offset converted to EMs, accounting for baseline shift on Y axis
        expect(offset.toString()).toBe('["top",[0,41]]');
    });

    test('text-variable-anchor and text-variable-anchor-offset set', () => {
        const props = {layout: {'text-variable-anchor-offset': ['top', [1, 1]], 'text-variable-anchor': ['bottom']}};
        const layer = createSymbolLayer(props);

        const offset = getTextVariableAnchorOffset(layer, null, null);
        expect(offset).toBeDefined();
        // Offset converted to EMs, accounting for baseline shift on Y axis
        expect(offset.toString()).toBe('["top",[24,17]]');
    });
});

