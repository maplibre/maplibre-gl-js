import {describe, test, expect, vi} from 'vitest';
import {Tile} from '../tile/tile.ts';
import {OverscaledTileID} from '../tile/tile_id.ts';
import {updatePatternPositionsInProgram} from './update_pattern_positions_in_program.ts';
import {FillStyleLayer} from '../style/style_layer/fill_style_layer.ts';
import {LineStyleLayer} from '../style/style_layer/line_style_layer.ts';
import type {CrossFaded} from '../style/properties.ts';
import type {FillLayerSpecification, LineLayerSpecification, ResolvedImage} from '@maplibre/maplibre-gl-style-spec';
import type {ProgramConfiguration} from '../data/program_configuration.ts';
import type {ImagePosition} from './image_atlas.ts';
import type {Rect} from './glyph_atlas.ts';

interface MockProgramConfiguration extends ProgramConfiguration {
    patternPositions: {
        posFrom: Rect;
        posTo: Rect;
    };
}

function constructMockProgramConfiguration(): MockProgramConfiguration {
    const mockProgramConfiguration: MockProgramConfiguration = {patternPositions: {}} as any;
    mockProgramConfiguration.updatePaintBuffers = vi.fn();
    mockProgramConfiguration.setConstantPatternPositions = (posTo: ImagePosition, posFrom: ImagePosition) => {
        // this does not exist on ProgramConfiguration but we want to test the resulting output
        mockProgramConfiguration.patternPositions = {posTo: posTo.paddedRect, posFrom: posFrom.paddedRect};
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
    return new FillStyleLayer(layerSpec, {});
}

function constructMockLineStyleLayer(): LineStyleLayer {
    const layerSpec = {
        id: 'mock-line-layer',
        source: 'empty-source',
        type: 'line',
        layout: {},
        'paint': {
            'line-width': 10,
            'line-pattern': ['step', ['zoom'], 'patternA', 13, 'patternB']
        }
    } as LineLayerSpecification;
    return new LineStyleLayer(layerSpec, {});
}

function imagePosition(x: number, y: number, w: number, h: number): ImagePosition {
    return {paddedRect: {x, y, w, h}, version: 0, needsFirstWebGLRender: false, tl: [0, 0], pixelRatio: 1, br: [0, 0], tlbr: [0, 0, 0, 0], displaySize: [0, 0], stretchX: [], stretchY: [], content: [0, 0, 0, 0], textFitWidth: undefined, textFitHeight: undefined} as any;
}

const linePatternCrossFade: CrossFaded<ResolvedImage> = {
    from: {name: 'patternA', available: false, toString: () => 'patternA'},
    to: {name: 'patternB', available: false, toString: () => 'patternB'}
};

function constructMockTile(patternPositions: Record<string, ImagePosition>): Tile {
    const tile = new Tile(new OverscaledTileID(13, 0, 13, 0, 0), undefined);
    tile.imageAtlas = {} as any;
    tile.imageAtlas.patternPositions = patternPositions;
    return tile;
}

describe('updatePatternPositionsInProgram', () => {
    test('geojson tile', () => {
        const config = constructMockProgramConfiguration();
        const tile = new Tile(new OverscaledTileID(3, 0, 2, 1, 2), undefined);
        tile.imageAtlas = {} as any;
        tile.imageAtlas.patternPositions = {
            'volcano_11': {paddedRect: {x: 0, y: 0, w: 0, h: 0}, version: 0, needsFirstWebGLRender: false, tl: [0, 0], pixelRatio: 1, br: [0, 0], tlbr: [0, 0, 0, 0], displaySize: [0, 0], stretchX: [], stretchY: [], content: [0, 0, 0, 0], textFitWidth: undefined, textFitHeight: undefined},
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

    describe('line-pattern', () => {
        test('uses the to position for both when the atlas holds only the to sprite', () => {
            const config = constructMockProgramConfiguration();
            const toPosition = imagePosition(1, 2, 3, 4);
            const tile = constructMockTile({patternB: toPosition});

            updatePatternPositionsInProgram(config, 'line-pattern', linePatternCrossFade, tile, constructMockLineStyleLayer());

            expect(config.patternPositions).toEqual({posTo: {x: 1, y: 2, w: 3, h: 4}, posFrom: {x: 1, y: 2, w: 3, h: 4}});
        });

        test('uses the from position for both when the atlas holds only the from sprite', () => {
            const config = constructMockProgramConfiguration();
            const fromPosition = imagePosition(5, 6, 7, 8);
            const tile = constructMockTile({patternA: fromPosition});

            updatePatternPositionsInProgram(config, 'line-pattern', linePatternCrossFade, tile, constructMockLineStyleLayer());

            expect(config.patternPositions).toEqual({posTo: {x: 5, y: 6, w: 7, h: 8}, posFrom: {x: 5, y: 6, w: 7, h: 8}});
        });

        test('uses both distinct positions when the atlas holds both sprites', () => {
            const config = constructMockProgramConfiguration();
            const fromPosition = imagePosition(1, 1, 1, 1);
            const toPosition = imagePosition(2, 2, 2, 2);
            const tile = constructMockTile({patternA: fromPosition, patternB: toPosition});

            updatePatternPositionsInProgram(config, 'line-pattern', linePatternCrossFade, tile, constructMockLineStyleLayer());

            expect(config.patternPositions).toEqual({posTo: {x: 2, y: 2, w: 2, h: 2}, posFrom: {x: 1, y: 1, w: 1, h: 1}});
        });

        test('does not set pattern positions when neither sprite is in the atlas', () => {
            const config = constructMockProgramConfiguration();
            const setSpy = vi.spyOn(config, 'setConstantPatternPositions');
            const tile = constructMockTile({});

            updatePatternPositionsInProgram(config, 'line-pattern', linePatternCrossFade, tile, constructMockLineStyleLayer());

            expect(setSpy).not.toHaveBeenCalled();
        });
    });
});
