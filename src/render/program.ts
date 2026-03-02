import {type PreparedShader, shaders, transpileVertexShaderToWebGL1, transpileFragmentShaderToWebGL1} from '../shaders/shaders';
import {type ProgramConfiguration} from '../data/program_configuration';
import {VertexArrayObject} from './vertex_array_object';
import {type Context} from '../gl/context';
import {isWebGL2} from '../gl/webgl2';

import type {SegmentVector} from '../data/segment';
import type {VertexBuffer} from '../gl/vertex_buffer';
import type {IndexBuffer} from '../gl/index_buffer';
import type {DepthMode} from '../gl/depth_mode';
import type {StencilMode} from '../gl/stencil_mode';
import type {ColorMode} from '../gl/color_mode';
import type {CullFaceMode} from '../gl/cull_face_mode';
import type {UniformBindings, UniformValues, UniformLocations} from './uniform_binding';
import type {BinderUniform} from '../data/program_configuration';
import {terrainPreludeUniforms, type TerrainPreludeUniformsType} from './program/terrain_program';
import type {TerrainData} from '../render/terrain';
import {projectionObjectToUniformMap, type ProjectionPreludeUniformsType, projectionUniforms} from './program/projection_program';
import type {ProjectionData} from '../geo/projection/projection_data';

export type DrawMode = WebGLRenderingContextBase['LINES'] | WebGLRenderingContextBase['TRIANGLES'] | WebGL2RenderingContext['LINE_STRIP'];

function getTokenizedAttributesAndUniforms(array: Array<string>): Array<string> {
    const result = [];

    for (let i = 0; i < array.length; i++) {
        if (array[i] === null) continue;
        const token = array[i].split(' ');
        result.push(token.pop());
    }
    return result;
}

/**
 * @internal
 * A webgl program to execute in the GPU space
 */
export class Program<Us extends UniformBindings> {
    program: WebGLProgram;
    attributes: { [_: string]: number };
    numAttributes: number;
    fixedUniforms: Us;
    terrainUniforms: TerrainPreludeUniformsType;
    projectionUniforms: ProjectionPreludeUniformsType;
    binderUniforms: Array<BinderUniform>;
    failedToCreate: boolean;
    vertexSource: string;
    fragmentSource: string;

    constructor(context: Context,
        source: PreparedShader,
        configuration: ProgramConfiguration,
        fixedUniforms: (b: Context, a: UniformLocations) => Us,
        showOverdrawInspector: boolean,
        hasTerrain: boolean,
        projectionPrelude: PreparedShader,
        projectionDefine: string,
        extraDefines: Array<string> = []) {

        const gl = context.gl;
        this.program = gl.createProgram();

        const staticAttrInfo = getTokenizedAttributesAndUniforms(source.staticAttributes);
        const dynamicAttrInfo = configuration ? configuration.getBinderAttributes() : [];
        const allAttrInfo = staticAttrInfo.concat(dynamicAttrInfo);

        const preludeUniformsInfo = shaders.prelude.staticUniforms ? getTokenizedAttributesAndUniforms(shaders.prelude.staticUniforms) : [];
        const projectionPreludeUniformsInfo = projectionPrelude.staticUniforms ? getTokenizedAttributesAndUniforms(projectionPrelude.staticUniforms) : [];
        const staticUniformsInfo = source.staticUniforms ? getTokenizedAttributesAndUniforms(source.staticUniforms) : [];
        const dynamicUniformsInfo = configuration ? configuration.getBinderUniforms() : [];
        // remove duplicate uniforms
        const uniformList = preludeUniformsInfo.concat(projectionPreludeUniformsInfo).concat(staticUniformsInfo).concat(dynamicUniformsInfo);
        const allUniformsInfo = [];
        for (const uniform of uniformList) {
            if (allUniformsInfo.indexOf(uniform) < 0) allUniformsInfo.push(uniform);
        }

        const defines = configuration ? configuration.defines() : [];
        if (isWebGL2(gl)) {
            defines.unshift('#version 300 es');
        }
        if (showOverdrawInspector) {
            defines.push('#define OVERDRAW_INSPECTOR;');
        }
        if (hasTerrain) {
            defines.push('#define TERRAIN3D;');
        }
        if (projectionDefine) {
            defines.push(projectionDefine);
        }
        if (extraDefines) {
            defines.push(...extraDefines);
        }

        let fragmentSource = defines.concat(shaders.prelude.fragmentSource, projectionPrelude.fragmentSource, source.fragmentSource).join('\n');
        let vertexSource = defines.concat(shaders.prelude.vertexSource, projectionPrelude.vertexSource, source.vertexSource).join('\n');

        if (!isWebGL2(gl)) {
            fragmentSource = transpileFragmentShaderToWebGL1(fragmentSource);
            vertexSource = transpileVertexShaderToWebGL1(vertexSource);
        }

        this.vertexSource = vertexSource;
        this.fragmentSource = fragmentSource;

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw new Error(`Could not compile fragment shader: ${gl.getShaderInfoLog(fragmentShader)}`);
        }

        gl.attachShader(this.program, fragmentShader);

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);

        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw new Error(`Could not compile vertex shader: ${gl.getShaderInfoLog(vertexShader)}`);
        }

        gl.attachShader(this.program, vertexShader);

        this.attributes = {};
        const uniformLocations = {};

        this.numAttributes = allAttrInfo.length;

        for (let i = 0; i < this.numAttributes; i++) {
            if (allAttrInfo[i]) {
                gl.bindAttribLocation(this.program, i, allAttrInfo[i]);
                this.attributes[allAttrInfo[i]] = i;
            }
        }

        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error(`Program failed to link: ${gl.getProgramInfoLog(this.program)}`);
        }

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        for (let it = 0; it < allUniformsInfo.length; it++) {
            const uniform = allUniformsInfo[it];
            if (uniform && !uniformLocations[uniform]) {
                const uniformLocation = gl.getUniformLocation(this.program, uniform);
                if (uniformLocation) {
                    uniformLocations[uniform] = uniformLocation;
                }
            }
        }

        this.fixedUniforms = fixedUniforms(context, uniformLocations);
        this.terrainUniforms = terrainPreludeUniforms(context, uniformLocations);
        this.projectionUniforms = projectionUniforms(context, uniformLocations);
        this.binderUniforms = configuration ? configuration.getUniforms(context, uniformLocations) : [];
    }

}
