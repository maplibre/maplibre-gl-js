import Point from '@mapbox/point-geometry';
import {drawCollisionDebug} from './draw_collision_debug';

import {updateVariableAnchors} from '../symbol/variable_anchors';
import {drawSymbolsWebGPU} from '../webgpu/draw/draw_symbol_webgpu';

import {SegmentVector} from '../data/segment';
import {pixelsToTileUnits} from '../source/pixels_to_tile_units';
import {type EvaluatedZoomSize, evaluateSizeForFeature, evaluateSizeForZoom} from '../symbol/symbol_size';
import {mat4} from 'gl-matrix';
import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {addDynamicAttributes} from '../data/bucket/symbol_bucket';

import {WritingMode} from '../symbol/shaping';
import ONE_EM from '../symbol/one_em';

import {
    type SymbolIconUniformsType,
    symbolIconUniformValues,
    symbolSDFUniformValues,
    symbolTextAndIconUniformValues
} from './program/symbol_program';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';

import type {Texture, TextureFilter} from '../render/texture';
import type {OverscaledTileID, UnwrappedTileID} from '../tile/tile_id';
import type {UniformValues} from './uniform_binding';
import type {SymbolSDFUniformsType} from '../render/program/symbol_program';
import type {CrossTileID, VariableOffset} from '../symbol/placement';
import type {SymbolBucket, SymbolBuffers} from '../data/bucket/symbol_bucket';
import type {TerrainData} from '../render/terrain';
import type {SymbolLayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type {ColorMode} from '../gl/color_mode';
import type {Program} from './program';
import type {TextAnchor} from '../style/style_layer/variable_text_anchor';
import {getGlCoordMatrix, getPerspectiveRatio, getPitchedLabelPlaneMatrix, hideGlyphs, projectWithMatrix, projectTileCoordinatesToClipSpace, projectTileCoordinatesToLabelPlane, type SymbolProjectionContext, updateLineLabels} from '../symbol/projection';
import {translatePosition} from '../util/util';
import type {ProjectionData} from '../geo/projection/projection_data';

type SymbolTileRenderState = {
    segments: SegmentVector;
    sortKey: number;
    terrainData: TerrainData;
    state: {
        program: Program<any>;
        buffers: SymbolBuffers;
        uniformValues: UniformValues<SymbolSDFUniformsType | SymbolIconUniformsType>;
        projectionData: ProjectionData;
        atlasTexture: Texture;
        atlasTextureIcon: Texture | null;
        atlasInterpolation: TextureFilter;
        atlasInterpolationIcon: TextureFilter;
        isSDF: boolean;
        hasHalo: boolean;
    };
};

const identityMat4 = mat4.identity(new Float32Array(16));

export function drawSymbols(painter: Painter, tileManager: TileManager, layer: SymbolStyleLayer, coords: Array<OverscaledTileID>, variableOffsets: {
    [_ in CrossTileID]: VariableOffset;
}, renderOptions: RenderOptions) {
    if (painter.renderPass !== 'translucent') return;

    // Use drawable path for WebGPU
    if (painter.useDrawables && painter.useDrawables.has('symbol')) {
        drawSymbolsWebGPU(painter, tileManager, layer, coords, variableOffsets, renderOptions);
        return;
    }

    const {isRenderingToTexture} = renderOptions;
    // Disable the stencil test so that labels aren't clipped to tile boundaries.
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const hasVariablePlacement = layer._unevaluatedLayout.hasValue('text-variable-anchor') || layer._unevaluatedLayout.hasValue('text-variable-anchor-offset');

    // Compute variable-offsets before painting since icons and text data positioning
    // depend on each other in this case.
    if (hasVariablePlacement) {
        updateVariableAnchors(coords, painter, layer, tileManager,
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'),
            variableOffsets
        );
    }

    if (layer.paint.get('icon-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, tileManager, layer, coords, false,
            layer.paint.get('icon-translate'),
            layer.paint.get('icon-translate-anchor'),
            layer.layout.get('icon-rotation-alignment'),
            layer.layout.get('icon-pitch-alignment'),
            layer.layout.get('icon-keep-upright'),
            stencilMode, colorMode, isRenderingToTexture
        );
    }

    if (layer.paint.get('text-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, tileManager, layer, coords, true,
            layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'),
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            layer.layout.get('text-keep-upright'),
            stencilMode, colorMode, isRenderingToTexture
        );
    }

    if (tileManager.map.showCollisionBoxes) {
        drawCollisionDebug(painter, tileManager, layer, coords, true);
        drawCollisionDebug(painter, tileManager, layer, coords, false);
    }
}

// Variable anchor functions moved to src/symbol/variable_anchors.ts

function getSymbolProgramName(isSDF: boolean, isText: boolean, bucket: SymbolBucket) {
    if (bucket.iconsInText && isText) {
        return 'symbolTextAndIcon';
    } else if (isSDF) {
        return 'symbolSDF';
    } else {
        return 'symbolIcon';
    }
}

function drawLayerSymbols(
    painter: Painter,
    tileManager: TileManager,
    layer: SymbolStyleLayer,
    coords: Array<OverscaledTileID>,
    isText: boolean,
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    rotationAlignment: SymbolLayerSpecification['layout']['text-rotation-alignment'],
    pitchAlignment: SymbolLayerSpecification['layout']['text-pitch-alignment'],
    keepUpright: boolean,
    stencilMode: StencilMode,
    colorMode: Readonly<ColorMode>,
    isRenderingToTexture: boolean) {

    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;

    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';
    const alongLine = rotationAlignment !== 'viewport' && layer.layout.get('symbol-placement') !== 'point';
    // Line label rotation happens in `updateLineLabels`
    // Pitched point labels are automatically rotated by the pitchedLabelPlaneMatrix projection
    // Unpitched point labels need to have their rotation applied after projection
    const rotateInShader = rotateWithMap && !pitchWithMap && !alongLine;

    const hasSortKey = !layer.layout.get('symbol-sort-key').isConstant();
    let sortFeaturesByKey = false;

    const depthMode = painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);

    const hasVariablePlacement = layer._unevaluatedLayout.hasValue('text-variable-anchor') || layer._unevaluatedLayout.hasValue('text-variable-anchor-offset');

    const tileRenderState: Array<SymbolTileRenderState> = [];

    const pitchedTextRescaling = transform.getCircleRadiusCorrection();

    for (const coord of coords) {
        const tile = tileManager.getTile(coord);
        const bucket = tile.getBucket(layer) as SymbolBucket;
        if (!bucket) continue;
        const buffers = isText ? bucket.text : bucket.icon;

        if (!buffers || !buffers.segments.get().length || !buffers.hasVisibleVertices) continue;
        const programConfiguration = buffers.programConfigurations.get(layer.id);

        const isSDF = isText || bucket.sdfIcons;

        const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
        const transformed = pitchWithMap || transform.pitch !== 0;

        const program = painter.useProgram(getSymbolProgramName(isSDF, isText, bucket), programConfiguration);
        const size = evaluateSizeForZoom(sizeData, transform.zoom);
        const terrainData = painter.style.map.terrain && painter.style.map.terrain.getTerrainData(coord);

        let texSize: [number, number];
        let texSizeIcon: [number, number] = [0, 0];
        let atlasTexture: Texture;
        let atlasInterpolation: TextureFilter;
        let atlasTextureIcon = null;
        let atlasInterpolationIcon: TextureFilter;
        if (isText) {
            atlasTexture = tile.glyphAtlasTexture;
            atlasInterpolation = gl.LINEAR;
            texSize = tile.glyphAtlasTexture.size;
            if (bucket.iconsInText) {
                texSizeIcon = tile.imageAtlasTexture.size;
                atlasTextureIcon = tile.imageAtlasTexture;
                const zoomDependentSize = sizeData.kind === 'composite' || sizeData.kind === 'camera';
                atlasInterpolationIcon = transformed || painter.options.rotating || painter.options.zooming || zoomDependentSize ? gl.LINEAR : gl.NEAREST;
            }
        } else {
            const iconScaled = layer.layout.get('icon-size').constantOr(0) !== 1 || bucket.iconsNeedLinear;
            atlasTexture = tile.imageAtlasTexture;
            atlasInterpolation = isSDF || painter.options.rotating || painter.options.zooming || iconScaled || transformed ?
                gl.LINEAR :
                gl.NEAREST;
            texSize = tile.imageAtlasTexture.size;
        }

        // See the comment at the beginning of src/symbol/projection.ts for an overview of the symbol projection process
        const s = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const pitchedLabelPlaneMatrix = getPitchedLabelPlaneMatrix(rotateWithMap, painter.transform, s);
        const pitchedLabelPlaneMatrixInverse = mat4.create();
        mat4.invert(pitchedLabelPlaneMatrixInverse, pitchedLabelPlaneMatrix);
        const glCoordMatrixForShader = getGlCoordMatrix(pitchWithMap, rotateWithMap, painter.transform, s);

        const translation = translatePosition(transform, tile, translate, translateAnchor);
        const projectionData = transform.getProjectionData({overscaledTileID: coord, applyGlobeMatrix: !isRenderingToTexture, applyTerrainMatrix: true});

        const hasVariableAnchors = hasVariablePlacement && bucket.hasTextData();
        const updateTextFitIcon = layer.layout.get('icon-text-fit') !== 'none' &&
            hasVariableAnchors &&
            bucket.hasIconData();

        if (alongLine) {
            const getElevation = painter.style.map.terrain ? (x: number, y: number) => painter.style.map.terrain.getElevation(coord, x, y) : null;
            const rotateToLine = layer.layout.get('text-rotation-alignment') === 'map';
            updateLineLabels(bucket, painter, isText, pitchedLabelPlaneMatrix, pitchedLabelPlaneMatrixInverse, pitchWithMap, keepUpright, rotateToLine, coord.toUnwrapped(), transform.width, transform.height, translation, getElevation);
        }

        const shaderVariableAnchor = (isText && hasVariablePlacement) || updateTextFitIcon;

        // If the label plane matrix is used, it transforms either map-pitch-aligned pixels, or to screenspace pixels
        const combinedLabelPlaneMatrix = pitchWithMap ? pitchedLabelPlaneMatrix : painter.transform.clipSpaceToPixelsMatrix;
        // Label plane matrix is unused in the shader if variable anchors are used or the text is placed along a line
        const noLabelPlane = (alongLine || shaderVariableAnchor);
        const uLabelPlaneMatrix = noLabelPlane ? identityMat4 : combinedLabelPlaneMatrix;

        const hasHalo = isSDF && layer.paint.get(isText ? 'text-halo-width' : 'icon-halo-width').constantOr(1) !== 0;

        let uniformValues: UniformValues<SymbolSDFUniformsType | SymbolIconUniformsType>;
        if (isSDF) {
            if (!bucket.iconsInText) {
                uniformValues = symbolSDFUniformValues(sizeData.kind,
                    size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter,
                    uLabelPlaneMatrix, glCoordMatrixForShader, translation, isText, texSize, true, pitchedTextRescaling);
            } else {
                uniformValues = symbolTextAndIconUniformValues(sizeData.kind,
                    size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter,
                    uLabelPlaneMatrix, glCoordMatrixForShader, translation, texSize, texSizeIcon, pitchedTextRescaling);
            }
        } else {
            uniformValues = symbolIconUniformValues(sizeData.kind,
                size, rotateInShader, pitchWithMap, alongLine, shaderVariableAnchor, painter,
                uLabelPlaneMatrix, glCoordMatrixForShader, translation, isText, texSize, pitchedTextRescaling);
        }

        const state = {
            program,
            buffers,
            uniformValues,
            projectionData,
            atlasTexture,
            atlasTextureIcon,
            atlasInterpolation,
            atlasInterpolationIcon,
            isSDF,
            hasHalo
        };

        if (hasSortKey && bucket.canOverlap) {
            sortFeaturesByKey = true;
            const oldSegments = buffers.segments.get();
            for (const segment of oldSegments) {
                tileRenderState.push({
                    segments: new SegmentVector([segment]),
                    sortKey: segment.sortKey,
                    state,
                    terrainData
                });
            }
        } else {
            tileRenderState.push({
                segments: buffers.segments,
                sortKey: 0,
                state,
                terrainData
            });
        }
    }

    if (sortFeaturesByKey) {
        tileRenderState.sort((a, b) => a.sortKey - b.sortKey);
    }

    for (const segmentState of tileRenderState) {
        const state = segmentState.state;

        context.activeTexture.set(gl.TEXTURE0);
        state.atlasTexture.bind(state.atlasInterpolation, gl.CLAMP_TO_EDGE);
        if (state.atlasTextureIcon) {
            context.activeTexture.set(gl.TEXTURE1);
            if (state.atlasTextureIcon) {
                state.atlasTextureIcon.bind(state.atlasInterpolationIcon, gl.CLAMP_TO_EDGE);
            }
        }

        if (state.isSDF) {
            const uniformValues = state.uniformValues;
            if (state.hasHalo) {
                uniformValues['u_is_halo'] = 1;
                drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, uniformValues, state.projectionData, segmentState.terrainData);
            }
            uniformValues['u_is_halo'] = 0;
        }
        drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, state.uniformValues, state.projectionData, segmentState.terrainData);
    }
}

function drawSymbolElements(
    buffers: SymbolBuffers,
    segments: SegmentVector,
    layer: SymbolStyleLayer,
    painter: Painter,
    program: Program<any>,
    depthMode: Readonly<DepthMode>,
    stencilMode: StencilMode,
    colorMode: Readonly<ColorMode>,
    uniformValues: UniformValues<SymbolSDFUniformsType | SymbolIconUniformsType>,
    projectionData: ProjectionData,
    terrainData: TerrainData) {
    const context = painter.context;
    const gl = context.gl;
    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
        uniformValues as any, terrainData as any, projectionData as any, layer.id, buffers.layoutVertexBuffer,
        buffers.indexBuffer, segments, layer.paint,
        painter.transform.zoom, buffers.programConfigurations.get(layer.id),
        buffers.dynamicLayoutVertexBuffer, buffers.opacityVertexBuffer);
}

