import {describe, test, expect, vi} from 'vitest';
import {type SourceCache} from '../source/source_cache';
import {type RasterSourceSpecification, type SourceSpecification, type VectorSourceSpecification} from '@maplibre/maplibre-gl-style-spec';
import {Style} from '../style/style';
import {FillStyleLayer} from '../style/style_layer/fill_style_layer';
import {RasterStyleLayer} from '../style/style_layer/raster_style_layer';
import {selectDebugSource} from './draw_debug';

vi.mock('../style/style');

const zoom = 14;

const defaultSources: { [_: string]: SourceSpecification } = {
    'raster_tiles': {
        type: 'raster',
        maxzoom: 19,
    },
    'vector_tiles': {
        type: 'vector',
        maxzoom: 14,
    }
};

const buildMockStyle = (layers, sources = defaultSources) => {
    const style = new Style(null);
    style.sourceCaches = Object.fromEntries(
        Object.entries(sources).map(
            ([id, spec]) => [id, {id, getSource: () => spec} as SourceCache]));
    style._layers = layers;
    return style;
};

describe('selectDebugSource', () => {
    test('Decides on vector source if it exists', () => {
        const layers = {
            '1': new RasterStyleLayer(
                {id: '1', type: 'raster', source: 'raster_tiles'}),
            '2': new FillStyleLayer(
                {id: '2', type: 'fill', source: 'vector_tiles'}),
        };
        const mockStyle = buildMockStyle(layers);
        const source = selectDebugSource(mockStyle, zoom);
        expect(source).toHaveProperty('id', 'vector_tiles');
    });

    test('Decides raster if vector source not shown at this zoom', () => {
        const layers = {
            '1': new RasterStyleLayer(
                {id: '1', type: 'raster', source: 'raster_tiles'}),
            '2': new FillStyleLayer(
                {id: '2', type: 'fill', source: 'vector_tiles', maxzoom: 13}),
        };
        const mockStyle = buildMockStyle(layers);
        const source = selectDebugSource(mockStyle, zoom);
        expect(source).toHaveProperty('id', 'raster_tiles');
    });

    test('Decides raster if vector layer has visibility none', () => {
        const layers = {
            '1': new RasterStyleLayer(
                {id: '1', type: 'raster', source: 'raster_tiles'}),
            '2': new FillStyleLayer(
                {id: '2', type: 'fill', source: 'vector_tiles', layout: {visibility: 'none'}}),
        };
        const style = buildMockStyle(layers);
        const source = selectDebugSource(style, zoom);
        expect(source).toHaveProperty('id', 'raster_tiles');
    });

    test('Decides raster if no vector source exists', () => {
        const layers = {
            '1': new RasterStyleLayer(
                {id: '1', type: 'raster', source: 'raster_tiles'}),
        };
        const mockStyle = buildMockStyle(layers);
        const source = selectDebugSource(mockStyle, zoom);
        expect(source).toHaveProperty('id', 'raster_tiles');
    });

    test('Decides on vector source with highest zoom level', () => {
        const sources: { [_: string]: VectorSourceSpecification } = {
            'vector_11': {
                type: 'vector',
                maxzoom: 11,
            },
            'vector_14': {
                type: 'vector',
                maxzoom: 14,
            }
        };
        const layers = {
            'fill_11': new FillStyleLayer(
                {id: 'fill_11', type: 'fill', source: 'vector_11'}),
            'fill_14': new FillStyleLayer(
                {id: 'fill_14', type: 'fill', source: 'vector_14'}),
        };
        const mockStyle = buildMockStyle(layers, sources);
        const source = selectDebugSource(mockStyle, zoom);
        expect(source).toHaveProperty('id', 'vector_14');
    });

    test('Decides on raster source with highest zoom level', () => {
        const sources: { [_: string]: RasterSourceSpecification } = {
            'raster_11': {
                type: 'raster',
                maxzoom: 11,
            },
            'raster_14': {
                type: 'raster',
                maxzoom: 14,
            }
        };
        const layers = {
            'raster_11': new RasterStyleLayer(
                {id: 'raster_11', type: 'raster', source: 'raster_11'}),
            'raster_14': new RasterStyleLayer(
                {id: 'raster_14', type: 'raster', source: 'raster_14'}),
        };
        const mockStyle = buildMockStyle(layers, sources);
        const source = selectDebugSource(mockStyle, zoom);
        expect(source).toHaveProperty('id', 'raster_14');
    });
});
