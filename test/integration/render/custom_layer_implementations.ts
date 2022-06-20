import MercatorCoordinate from '../../../src/geo/mercator_coordinate';

class NullIsland {
    id: string;
    type: string;
    renderingMode: string;
    program: WebGLProgram;
    constructor() {
        this.id = 'null-island';
        this.type = 'custom';
        this.renderingMode = '2d';
    }

    onAdd(map, gl: WebGLRenderingContext) {
        const vertexSource = `
        uniform mat4 u_matrix;
        void main() {
            gl_Position = u_matrix * vec4(0.5, 0.5, 0.0, 1.0);
            gl_PointSize = 20.0;
        }`;

        const fragmentSource = `
        void main() {
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }`;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
    }

    render(gl, matrix) {
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_matrix'), false, matrix);
        gl.drawArrays(gl.POINTS, 0, 1);
    }
}

class Tent3D {
    id: string;
    type: string;
    renderingMode: string;
    program: WebGLProgram & {
        a_pos?: number;
        aPos?: number;
        uMatrix?:  WebGLUniformLocation;
    };
    vertexBuffer: WebGLBuffer;
    indexBuffer: WebGLBuffer;
    constructor() {
        this.id = 'tent-3d';
        this.type = 'custom';
        this.renderingMode = '3d';
    }

    onAdd(map, gl: WebGLRenderingContext) {

        const vertexSource = `

        attribute vec3 aPos;
        uniform mat4 uMatrix;

        void main() {
            gl_Position = uMatrix * vec4(aPos, 1.0);
        }
        `;

        const fragmentSource = `
        void main() {
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
        `;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        gl.validateProgram(this.program);

        this.program.aPos = gl.getAttribLocation(this.program, 'aPos');
        this.program.uMatrix = gl.getUniformLocation(this.program, 'uMatrix');

        const x = 0.5 - 0.015;
        const y = 0.5 - 0.01;
        const z = 0.01;
        const d = 0.01;

        const vertexArray = new Float32Array([
            x, y, 0,
            x + d, y, 0,
            x, y + d, z,
            x + d, y + d, z,
            x, y + d + d, 0,
            x + d, y + d + d, 0]);
        const indexArray = new Uint16Array([
            0, 1, 2,
            1, 2, 3,
            2, 3, 4,
            3, 4, 5
        ]);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
    }

    render(gl: WebGLRenderingContext, matrix) {
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.enableVertexAttribArray(this.program.a_pos);
        gl.vertexAttribPointer(this.program.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(this.program.uMatrix, false, matrix);
        gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 0);
    }
}

class TriangleImageWithTiles {
    id: string;
    type: string;
    renderingMode: string;
    source?: string;
    minzoom?: number;
    maxzoom?:number;

    program: WebGLProgram;
    vertexBuffer: WebGLBuffer;
    texCoordBuffer: WebGLBuffer;

    aPos?: number;
    aTexCoord?: number;
    uMatrix?:  WebGLUniformLocation;
    uTexture?:  WebGLUniformLocation;

    constructor() {
        this.id = 'tile-source';
        this.type = 'custom';
        this.renderingMode = '3d';
        this.source = 'satellite';
        this.minzoom = 2;
        this.maxzoom = 17;
    }

    onAdd(map, gl) {
        const vertexSource = `

        attribute vec3 aPos;
        attribute vec2 aTexCoord;
        uniform mat4 uMatrix;
        varying vec2 vTexCoord;

        void main() {
            gl_Position = uMatrix * vec4(aPos, 1.0);
            vTexCoord = aTexCoord;
        }
        `;

        const fragmentSource = `
        precision mediump float;
        uniform sampler2D uTexture;
        varying vec2 vTexCoord;
        void main() {
            gl_FragColor = texture2D(uTexture, vTexCoord);
        }
        `;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        this.aPos = gl.getAttribLocation(this.program, 'aPos');
        this.aTexCoord = gl.getAttribLocation(
            this.program,
            'aTexCoord',
        );
        this.uMatrix = gl.getUniformLocation(
            this.program,
            'uMatrix',
        );
        this.uTexture = gl.getUniformLocation(
            this.program,
            'uTexture',
        );

        const {x, y} = MercatorCoordinate.fromLngLat({
            lng: 13.418056,
            lat: 52.499167,
        });
        const vertexArray = new Float32Array([
            x - 0.000005,
            y - 0.000003,
            0,
            x + 0.000005,
            y - 0.000003,
            0,
            x,
            y + 0.000003,
            0,
        ]);
        const texCoordArray = new Float32Array([
            0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
        ]);

        // bind vertex
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.aPos);
        gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);

        // bind texCoord
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            texCoordArray,
            gl.STATIC_DRAW,
        );
        gl.enableVertexAttribArray(this.aTexCoord);
        gl.vertexAttribPointer(
            this.aTexCoord,
            2,
            gl.FLOAT,
            false,
            0,
            0,
        );
    }

    render(gl: WebGLRenderingContext, matrix, tiles) {
        if (tiles.length === 0) return;
        gl.useProgram(this.program);

        // bind texture
        const {texture} = tiles[0];
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
        gl.uniform1i(this.uTexture, 0);

        // render
        gl.uniformMatrix4fv(this.uMatrix, false, matrix);
        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 0);
    }
}

const customLayersImplementations = {
    'tent-3d': Tent3D,
    'null-island': NullIsland,
    'triangle-image-with-tiles': TriangleImageWithTiles
};

export default customLayersImplementations;
