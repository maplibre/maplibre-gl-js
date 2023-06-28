import {Interpolate, interpolates} from '@maplibre/maplibre-gl-style-spec';
import {clamp} from '../util/util';
import {EvaluationParameters} from '../style/evaluation_parameters';

import type {PropertyValue, PossiblyEvaluatedPropertyValue} from '../style/properties';
import type {InterpolationType} from '@maplibre/maplibre-gl-style-spec';

const MAX_GLYPH_ICON_SIZE = 255;
const SIZE_PACK_FACTOR = 128;
const MAX_PACKED_SIZE = MAX_GLYPH_ICON_SIZE * SIZE_PACK_FACTOR;

export {getSizeData, evaluateSizeForFeature, evaluateSizeForZoom, SIZE_PACK_FACTOR, MAX_GLYPH_ICON_SIZE, MAX_PACKED_SIZE};

export type SizeData = {
    kind: 'constant';
    layoutSize: number;
} | {
    kind: 'source';
} | {
    kind: 'camera';
    minZoom: number;
    maxZoom: number;
    minSize: number;
    maxSize: number;
    interpolationType: InterpolationType;
} | {
    kind: 'composite';
    minZoom: number;
    maxZoom: number;
    interpolationType: InterpolationType;
};

export type EvaluatedZoomSize = {uSizeT: number; uSize: number};

// For {text,icon}-size, get the bucket-level data that will be needed by
// the painter to set symbol-size-related uniforms
function getSizeData(
    tileZoom: number,
    value: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>
): SizeData {
    const {expression} = value;

    if (expression.kind === 'constant') {
        const layoutSize = expression.evaluate(new EvaluationParameters(tileZoom + 1));
        return {kind: 'constant', layoutSize};

    } else if (expression.kind === 'source') {
        return {kind: 'source'};

    } else {
        const {zoomStops, interpolationType} = expression;

        // calculate covering zoom stops for zoom-dependent values
        let lower = 0;
        while (lower < zoomStops.length && zoomStops[lower] <= tileZoom) lower++;
        lower = Math.max(0, lower - 1);
        let upper = lower;
        while (upper < zoomStops.length && zoomStops[upper] < tileZoom + 1) upper++;
        upper = Math.min(zoomStops.length - 1, upper);

        const minZoom = zoomStops[lower];
        const maxZoom = zoomStops[upper];

        // We'd like to be able to use CameraExpression or CompositeExpression in these
        // return types rather than ExpressionSpecification, but the former are not
        // transferrable across Web Worker boundaries.
        if (expression.kind === 'composite') {
            return {kind: 'composite', minZoom, maxZoom, interpolationType};
        }

        // for camera functions, also save off the function values
        // evaluated at the covering zoom levels
        const minSize = expression.evaluate(new EvaluationParameters(minZoom));
        const maxSize = expression.evaluate(new EvaluationParameters(maxZoom));

        return {kind: 'camera', minZoom, maxZoom, minSize, maxSize, interpolationType};
    }
}

function evaluateSizeForFeature(sizeData: SizeData,
    {
        uSize,
        uSizeT
    }: {
        uSize: number;
        uSizeT: number;
    },
    {
        lowerSize,
        upperSize
    }: {
        lowerSize: number;
        upperSize: number;
    }): number {
    if (sizeData.kind === 'source') {
        return lowerSize / SIZE_PACK_FACTOR;
    } else if (sizeData.kind === 'composite') {
        return interpolates.number(lowerSize / SIZE_PACK_FACTOR, upperSize / SIZE_PACK_FACTOR, uSizeT);
    }
    return uSize;
}

function evaluateSizeForZoom(sizeData: SizeData, zoom: number): EvaluatedZoomSize {
    let uSizeT = 0;
    let uSize = 0;

    if (sizeData.kind === 'constant') {
        uSize = sizeData.layoutSize;

    } else if (sizeData.kind !== 'source') {
        const {interpolationType, minZoom, maxZoom} = sizeData;

        // Even though we could get the exact value of the camera function
        // at z = tr.zoom, we intentionally do not: instead, we interpolate
        // between the camera function values at a pair of zoom stops covering
        // [tileZoom, tileZoom + 1] in order to be consistent with this
        // restriction on composite functions
        const t = !interpolationType ? 0 : clamp(
            Interpolate.interpolationFactor(interpolationType, zoom, minZoom, maxZoom), 0, 1);

        if (sizeData.kind === 'camera') {
            uSize = interpolates.number(sizeData.minSize, sizeData.maxSize, t);
        } else {
            uSizeT = t;
        }
    }

    return {uSizeT, uSize};
}
