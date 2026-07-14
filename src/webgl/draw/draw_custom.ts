import {DepthMode} from '../depth_mode.ts';
import {StencilMode} from '../stencil_mode.ts';

import type {Painter, RenderOptions} from '../../render/painter.ts';
import type {TileManager} from '../../tile/tile_manager.ts';
import type {CustomLayerProjectionDataParams, CustomRenderMethodInput, CustomStyleLayer} from '../../style/style_layer/custom_style_layer.ts';
import {OverscaledTileID} from '../../tile/tile_id.ts';
import {GEOJSON_TILE_LAYER_NAME} from '../../data/feature_index.ts';

export function getCustomLayerTiles(tileManager: TileManager | undefined, sourceLayer: string): CustomRenderMethodInput['tiles'] {
    if (!tileManager) return [];
    const sourceType = tileManager.getSource().type;
    if (sourceType !== 'vector' && sourceType !== 'geojson') {
        throw new Error(`Custom layers do not support source type "${sourceType}"`);
    }
    if (sourceType === 'vector' && !sourceLayer) {
        throw new Error('Custom layers using a vector source must specify "source-layer"');
    }

    return tileManager.getVisibleCoordinates().flatMap((tileID) => {
        const tile = tileManager.getTile(tileID);
        if (!tile) return [];

        const featureIndex = tile.latestFeatureIndex;
        if (!featureIndex?.rawTileData) return [];
        const layers = featureIndex.loadVTLayers();
        const features = layers[sourceType === 'geojson' ? GEOJSON_TILE_LAYER_NAME : sourceLayer];
        if (!features) return [];

        return [{
            tileID: {
                wrap: tileID.wrap,
                canonical: {
                    z: tileID.canonical.z,
                    x: tileID.canonical.x,
                    y: tileID.canonical.y,
                }
            },
            data: {type: 'vector', features}
        }];
    });
}

export function drawCustom(painter: Painter, tileManager: TileManager | undefined, layer: CustomStyleLayer, renderOptions: RenderOptions): void {

    const {isRenderingGlobe} = renderOptions;
    const context = painter.context;
    const implementation = layer.implementation;
    const projection = painter.style.projection;
    const transform = painter.transform;

    const projectionData = transform.getProjectionDataForCustomLayer(isRenderingGlobe);

    const customLayerArgs: CustomRenderMethodInput = {
        tiles: getCustomLayerTiles(tileManager, layer.sourceLayer || ''),
        farZ: transform.farZ,
        nearZ: transform.nearZ,
        fov: transform.fov * Math.PI / 180, // fov converted to radians
        modelViewProjectionMatrix: transform.modelViewProjectionMatrix,
        projectionMatrix: transform.projectionMatrix,
        shaderData: {
            variantName: projection.shaderVariantName,
            vertexShaderPrelude: `const float PI = 3.141592653589793;\nuniform mat4 u_projection_matrix;\n${projection.shaderPreludeCode.vertexSource}`,
            define: projection.shaderDefine,
        },
        defaultProjectionData: projectionData,
        getProjectionData: (params: CustomLayerProjectionDataParams) => {
            return transform.getProjectionData({
                overscaledTileID: new OverscaledTileID(
                    params.tileID.canonical.z,
                    params.tileID.wrap ?? 0,
                    params.tileID.canonical.z,
                    params.tileID.canonical.x,
                    params.tileID.canonical.y,
                ),
                aligned: params.aligned,
                applyGlobeMatrix: params.applyGlobeMatrix,
                applyTerrainMatrix: params.applyTerrainMatrix,
            });
        }
    };

    const renderingMode = implementation.renderingMode ? implementation.renderingMode : '2d';

    if (painter.renderPass === 'offscreen') {
        const prerender = implementation.prerender;
        if (prerender) {
            painter.setCustomLayerDefaults();
            context.setColorMode(painter.colorModeForRenderPass());

            prerender.call(implementation, context.gl, customLayerArgs);

            context.setDirty();
            painter.setBaseState();
        }
    } else if (painter.renderPass === 'translucent') {

        painter.setCustomLayerDefaults();

        context.setColorMode(painter.colorModeForRenderPass());
        context.setStencilMode(StencilMode.disabled);

        const depthMode = renderingMode === '3d' ?
            painter.getDepthModeFor3D() :
            painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);

        context.setDepthMode(depthMode);

        implementation.render(context.gl, customLayerArgs);

        context.setDirty();
        painter.setBaseState();
        context.bindFramebuffer.set(null);
    }
}
