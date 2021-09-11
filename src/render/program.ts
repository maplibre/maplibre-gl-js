import shaders from '../shaders/shaders';
import assert from 'assert';
import ProgramConfiguration from '../data/program_configuration';
import VertexArrayObject from './vertex_array_object';
import Context from '../gl/context';

import type SegmentVector from '../data/segment';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type DepthMode from '../gl/depth_mode';
import type StencilMode from '../gl/stencil_mode';
import type ColorMode from '../gl/color_mode';
import type CullFaceMode from '../gl/cull_face_mode';
import type {UniformBindings, UniformValues, UniformLocations} from './uniform_binding';
import type {BinderUniform} from '../data/program_configuration';

export type DrawMode = WebGLRenderingContext['LINES'] | WebGLRenderingContext['TRIANGLES'] | WebGLRenderingContext['LINE_STRIP'];

function getTokenizedAttributesAndUniforms(array: Array<string>): Array<string> {
    const result = [];

    for (let i = 0; i < array.length; i++) {
        if (array[i] === null) continue;
        const token = array[i].split(' ');
        result.push(token.pop());
    }
    return result;
}
class Program<Us extends UniformBindings> {
    program: WebGLProgram;
    attributes: {[_: string]: number};
    numAttributes: number;
    fixedUniforms: Us;
    binderUniforms: Array<BinderUniform>;
    failedToCreate: boolean;

    constructor(context: Context,
            name: string,
            source: {
              fragmentSource: string;
              vertexSource: string;
              staticAttributes: Array<string>;
              staticUniforms: Array<string>;
            },
            configuration: ProgramConfiguration,
            fixedUniforms: (b: Context, a: UniformLocations) => Us,
            showOverdrawInspector: boolean) {
        const gl = context.gl;
        this.program = gl.createProgram();

        const staticAttrInfo = getTokenizedAttributesAndUniforms(source.staticAttributes);
        const dynamicAttrInfo = configuration ? configuration.getBinderAttributes() : [];
        const allAttrInfo = staticAttrInfo.concat(dynamicAttrInfo);

        const staticUniformsInfo = source.staticUniforms ? getTokenizedAttributesAndUniforms(source.staticUniforms) : [];
        const dynamicUniformsInfo = configuration ? configuration.getBinderUniforms() : [];
        // remove duplicate uniforms
        const uniformList = staticUniformsInfo.concat(dynamicUniformsInfo);
        const allUniformsInfo = [];
        for (const uniform of uniformList) {
            if (allUniformsInfo.indexOf(uniform) < 0) allUniformsInfo.push(uniform);
        }

        const defines = configuration ? configuration.defines() : [];
        if (showOverdrawInspector) {
            defines.push('#define OVERDRAW_INSPECTOR;');
        }

        const fragmentSource = defines.concat(shaders.prelude.fragmentSource, source.fragmentSource).join('\n');
        const vertexSource = defines.concat(shaders.prelude.vertexSource, source.vertexSource).join('\n');
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), (gl.getShaderInfoLog(fragmentShader) as any));
        gl.attachShader(this.program, fragmentShader);

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), (gl.getShaderInfoLog(vertexShader) as any));
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
        assert(gl.getProgramParameter(this.program, gl.LINK_STATUS), (gl.getProgramInfoLog(this.program) as any));

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
        this.binderUniforms = configuration ? configuration.getUniforms(context, uniformLocations) : [];
    }

    draw(context: Context,
         drawMode: DrawMode,
         depthMode: Readonly<DepthMode>,
         stencilMode: Readonly<StencilMode>,
         colorMode: Readonly<ColorMode>,
         cullFaceMode: Readonly<CullFaceMode>,
         uniformValues: UniformValues<Us>,
         layerID: string,
         layoutVertexBuffer: VertexBuffer,
         indexBuffer: IndexBuffer,
         segments: SegmentVector,
         currentProperties?: any,
         zoom?: number | null,
         configuration?: ProgramConfiguration | null,
         dynamicLayoutBuffer?: VertexBuffer | null,
         dynamicLayoutBuffer2?: VertexBuffer | null) {

        const gl = context.gl;

        if (this.failedToCreate) return;

        context.program.set(this.program);
        context.setDepthMode(depthMode);
        context.setStencilMode(stencilMode);
        context.setColorMode(colorMode);
        context.setCullFace(cullFaceMode);

        for (const name in this.fixedUniforms) {
            this.fixedUniforms[name].set(uniformValues[name]);
        }

        if (configuration) {
            configuration.setUniforms(context, this.binderUniforms, currentProperties, {zoom: (zoom as any)});
        }

        const primitiveSize = {
            [gl.LINES]: 2,
            [gl.TRIANGLES]: 3,
            [gl.LINE_STRIP]: 1
        }[drawMode];

        for (const segment of segments.get()) {
            const vaos = segment.vaos || (segment.vaos = {});
            const vao: VertexArrayObject = vaos[layerID] || (vaos[layerID] = new VertexArrayObject());

            vao.bind(
                context,
                this,
                layoutVertexBuffer,
                configuration ? configuration.getPaintVertexBuffers() : [],
                indexBuffer,
                segment.vertexOffset,
                dynamicLayoutBuffer,
                dynamicLayoutBuffer2
            );

            gl.drawElements(
                drawMode,
                segment.primitiveLength * primitiveSize,
                gl.UNSIGNED_SHORT,
                segment.primitiveOffset * primitiveSize * 2);
        }
    }
}

export default Program;
