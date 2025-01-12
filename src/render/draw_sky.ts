import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {PosArray, TriangleIndexArray} from '../data/array_types.g';
import posAttributes from '../data/pos_attributes';
import {SegmentVector} from '../data/segment';
import {skyUniformValues} from './program/sky_program';
import {atmosphereUniformValues} from './program/atmosphere_program';
import {type Sky} from '../style/sky';
import {type Light} from '../style/light';
import {Mesh} from './mesh';
import {mat4, vec3, vec4} from 'gl-matrix';
import {type IReadonlyTransform} from '../geo/transform_interface';
import {ColorMode} from '../gl/color_mode';
import type {Painter} from './painter';
import {type Context} from '../gl/context';
import {getGlobeRadiusPixels} from '../geo/projection/globe_utils';

function getMesh(context: Context, sky: Sky): Mesh {
    // Create the Sky mesh the first time we need it
    if (!sky.mesh) {
        const vertexArray = new PosArray();
        vertexArray.emplaceBack(-1, -1);
        vertexArray.emplaceBack(1, -1);
        vertexArray.emplaceBack(1, 1);
        vertexArray.emplaceBack(-1, 1);

        const indexArray = new TriangleIndexArray();
        indexArray.emplaceBack(0, 1, 2);
        indexArray.emplaceBack(0, 2, 3);

        sky.mesh = new Mesh(
            context.createVertexBuffer(vertexArray, posAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );
    }

    return sky.mesh;
}

export function drawSky(painter: Painter, sky: Sky) {
    const context = painter.context;
    const gl = context.gl;

    const skyUniforms = skyUniformValues(sky, painter.style.map.transform, painter.pixelRatio);

    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const program = painter.useProgram('sky');

    const mesh = getMesh(context, sky);

    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode,
        CullFaceMode.disabled, skyUniforms, null, undefined, 'sky', mesh.vertexBuffer,
        mesh.indexBuffer, mesh.segments);
}

function getSunPos(light: Light, transform: IReadonlyTransform): vec3 {
    const _lp = light.properties.get('position');
    const lightPos = [-_lp.x, -_lp.y, -_lp.z] as vec3;

    const lightMat = mat4.identity(new Float64Array(16) as any);

    if (light.properties.get('anchor') === 'map') {
        mat4.rotateZ(lightMat, lightMat, transform.rollInRadians);
        mat4.rotateX(lightMat, lightMat, -transform.pitchInRadians);
        mat4.rotateZ(lightMat, lightMat, transform.bearingInRadians);
        mat4.rotateX(lightMat, lightMat, transform.center.lat * Math.PI / 180.0);
        mat4.rotateY(lightMat, lightMat, -transform.center.lng * Math.PI / 180.0);
    }

    vec3.transformMat4(lightPos, lightPos, lightMat);

    return lightPos;
}

export function drawAtmosphere(painter: Painter, sky: Sky, light: Light) {
    const context = painter.context;
    const gl = context.gl;
    const program = painter.useProgram('atmosphere');
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);
    const transform = painter.transform;

    const sunPos = getSunPos(light, painter.transform);

    const projectionData = transform.getProjectionData({overscaledTileID: null, applyGlobeMatrix: true, applyTerrainMatrix: true});
    const atmosphereBlend = sky.properties.get('atmosphere-blend') * projectionData.projectionTransition;

    if (atmosphereBlend === 0) {
        // Don't draw anything if atmosphere is fully transparent
        return;
    }

    const globeRadius = getGlobeRadiusPixels(transform.worldSize, transform.center.lat);
    const invProjMatrix = transform.inverseProjectionMatrix;
    const vec = new Float64Array(4) as any as vec4;
    vec[3] = 1;
    vec4.transformMat4(vec, vec, transform.modelViewProjectionMatrix);
    vec[0] /= vec[3];
    vec[1] /= vec[3];
    vec[2] /= vec[3];
    vec[3] = 1;
    vec4.transformMat4(vec, vec, invProjMatrix);
    vec[0] /= vec[3];
    vec[1] /= vec[3];
    vec[2] /= vec[3];
    vec[3] = 1;
    const globePosition = [vec[0], vec[1], vec[2]] as vec3;

    const uniformValues = atmosphereUniformValues(sunPos, atmosphereBlend, globePosition, globeRadius, invProjMatrix);

    const mesh = getMesh(context, sky);

    program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.alphaBlended, CullFaceMode.disabled, uniformValues, null, null, 'atmosphere', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
}
