import {describe, test, expect, vi} from 'vitest';
import {Tile} from '../tile/tile';
import {OverscaledTileID} from '../tile/tile_id';
import {updatePatternPositionsInProgram} from './update_pattern_positions_in_program';
import {FillStyleLayer} from '../style/style_layer/fill_style_layer';
import type {CrossFaded} from '../style/properties';
import type {FillLayerSpecification, ResolvedImage} from '@maplibre/maplibre-gl-style-spec';
import type {ProgramConfiguration} from '../data/program_configuration';
import type {ImagePosition} from './image_atlas';
import type {Rect} from './glyph_atlas';

interface MockProgramConfiguration extends ProgramConfiguration {
    patternPositions: {
        posFrom: Rect;
        posTo: Rect;
    };
}

function constructMockProgramConfiguration(): MockProgramConfiguration {
    const mockProgramConfiguration: MockProgramConfiguration = {patternPositions: {}} as any;
    mockProgramConfiguration.updatePaintBuffers = vi.fn();
    mockProgramConfiguration.setConstantPatternPositions = (posFrom: ImagePosition, posTo: ImagePosition) => {
        // this does not exist on ProgramConfiguration but we want to test the resulting output
        mockProgramConfiguration.patternPositions = {posFrom: posFrom.paddedRect, posTo: posTo.paddedRect};
    };

    return mockProgramConfiguration;
}

function constructMockFillStyleLayer(): FillStyleLayer {
    const layerSpec = {
        id: 'mock-layer',
        source: 'empty-source',
        type: 'fill',
        layout: {},
        'paint': {
            'fill-pattern': [
                'step',
                ['zoom'],
                'zoo_11',
                4,
                'volcano_11'
            ]
        }
    } as FillLayerSpecification;
    const layer = new FillStyleLayer(layerSpec, {});
    return layer;
}

describe('updatePatternPositionsInProgram', () => {
    test('geojson tile', () => {
        const config = constructMockProgramConfiguration();
        const tile = new Tile(new OverscaledTileID(3, 0, 2, 1, 2), undefined);
        tile.imageAtlas = {} as any;
        tile.imageAtlas.patternPositions = {
            'volcano_11': {paddedRect: {x: 0, y: 0, w: 0, h: 0}, version: 0, tl: [0, 0], pixelRatio: 1, br: [0, 0], tlbr: [0, 0, 0, 0], displaySize: [0, 0], stretchX: [], stretchY: [], content: [0, 0, 0, 0], textFitWidth: undefined, textFitHeight: undefined},
        };
        const crossFadeResolveImage: CrossFaded<ResolvedImage> = {
            from: {name: 'zoo_11', available: false, toString: () => 'zoo_11'},
            to: {name: 'volcano_11', available: false, toString: () => 'volcano_11'}
        };
        updatePatternPositionsInProgram(
            config,
            'fill-pattern',
            crossFadeResolveImage,
            tile,
            constructMockFillStyleLayer()
        );
        // we added this property to just see what the update looks like
        expect(config.patternPositions).toEqual({
            posFrom: {x: 0, y: 0, w: 0, h: 0},
            posTo: {x: 0, y: 0, w: 0, h: 0}
        });
    });
});
