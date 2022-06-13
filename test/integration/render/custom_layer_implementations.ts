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

class TileSource {
    id: string;
    type: string;
    renderingMode: string;
    source?: string;
    minzoom?: number;
    maxzoom?:number;
    
    constructor() {
        this.id = 'custom-rastertile';
        this.type = 'custom';
        this.renderingMode = '3d';
        this.source = 'gsi';
        this.minzoom = 2;
        this.maxzoom = 5;
    }

    onAdd(map, gl) {
        this.map = map;

        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
        // use the MapLibre GL JS map canvas for three.js
        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true,
        });

        this.renderer.autoClear = false;

        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            -1000000.0, -1000000.0, 1000000.0, 1000000.0,
            -1000000.0, 1000000.0, 1000000.0, 1000000.0, 1000000.0,
        ]);
        const uvs = new Float32Array([
            0.0, 0.0, 0.0, 1.0, 1.0, 1.0,
        ]);
        geometry.addAttribute(
            'position',
            new THREE.BufferAttribute(vertices, 3),
        );
        geometry.addAttribute(
            'uv',
            new THREE.BufferAttribute(uvs, 2),
        );
        const material = new THREE.MeshBasicMaterial();
        this.triangle = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.triangle);

        const boxGeom = new THREE.BoxGeometry(
            1000000,
            1000000,
            1000000,
        );
        const boxMaterial = new THREE.MeshBasicMaterial();
        this.box = new THREE.Mesh(boxGeom, boxMaterial);
        this.scene.add(this.box);
    }

    render(gl, matrix, tiles) {
        // WebGLTexture -> THREE.texture
        const threetexture = new THREE.Texture();
        const texProps = this.renderer.properties.get(threetexture);
        texProps.__webglTexture = tiles[0].texture.texture;
        const material = new THREE.MeshBasicMaterial({
            map: threetexture,
            side: THREE.DoubleSide,
        });
        this.triangle.material = material;

        // WebGLTexture -> THREE.texture
        const boxTexs = [
            new THREE.Texture(),
            new THREE.Texture(),
            new THREE.Texture(),
            new THREE.Texture(),
            new THREE.Texture(),
            new THREE.Texture(),
        ];
        boxTexs.forEach((tex, idx) => {
            const boxTexProps = this.renderer.properties.get(tex);
            boxTexProps.__webglTexture = tiles[idx].texture.texture;
        });
        const boxMaterial = boxTexs.map((tex) => {
            return new THREE.MeshBasicMaterial({
                map: tex,
                side: THREE.DoubleSide,
            });
        });
        this.box.material = boxMaterial;

        const rotationX = new THREE.Matrix4().makeRotationAxis(
            new THREE.Vector3(1, 0, 0),
            modelTransform.rotateX,
        );
        const rotationY = new THREE.Matrix4().makeRotationAxis(
            new THREE.Vector3(0, 1, 0),
            modelTransform.rotateY,
        );
        const rotationZ = new THREE.Matrix4().makeRotationAxis(
            new THREE.Vector3(0, 0, 1),
            modelTransform.rotateZ,
        );

        const m = new THREE.Matrix4().fromArray(matrix);
        const l = new THREE.Matrix4()
            .makeTranslation(
                modelTransform.translateX,
                modelTransform.translateY,
                modelTransform.translateZ,
            )
            .scale(
                new THREE.Vector3(
                    modelTransform.scale,
                    -modelTransform.scale,
                    modelTransform.scale,
                ),
            )
            .multiply(rotationX)
            .multiply(rotationY)
            .multiply(rotationZ);

        this.camera.projectionMatrix = m.multiply(l);
        this.renderer.state.reset();
        this.renderer.render(this.scene, this.camera);
        this.map.triggerRepaint();
    }
}

const customLayersImplementations = {
    'tent-3d': Tent3D,
    'null-island': NullIsland
};

export default customLayersImplementations;
