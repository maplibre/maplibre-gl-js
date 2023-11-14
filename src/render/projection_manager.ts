import {mat4} from 'gl-matrix';
import {Context} from '../gl/context';
import {Map} from '../ui/map';
import {Uniform4f, UniformLocations, UniformMatrix4f} from './uniform_binding';
import {OverscaledTileID} from '../source/tile_id';
import {PosArray, TriangleIndexArray} from '../data/array_types.g';
import {Mesh} from './mesh';
import {EXTENT} from '../data/extent';
import {SegmentVector} from '../data/segment';
import posAttributes from '../data/pos_attributes';
import {subdivideFill} from './subdivision';
import {Transform} from '../geo/transform';

export type ProjectionPreludeUniformsType = {
    'u_projection_matrix': UniformMatrix4f;
    'u_projection_tile_mercator_coords': Uniform4f;
};

export const projectionUniforms = (context: Context, locations: UniformLocations): ProjectionPreludeUniformsType => ({
    'u_projection_matrix': new UniformMatrix4f(context, locations.u_projection_matrix),
    'u_projection_tile_mercator_coords': new Uniform4f(context, locations.u_projection_tile_mercator_coords)
});

export type ProjectionData = {
    'u_projection_matrix': mat4;
    'u_projection_tile_mercator_coords': [number, number, number, number];
}

export class ProjectionManager {
    map: Map;

    /**
     * Mercator tiles will be subdivided to this degree of granuality in order to allow for a curved projection.
     * Should be a power of 2.
     */
    private static readonly targetGranuality = 8;

    /**
     * The granuality specified by `targetGranuality` will be used for zoom levels from this value onwards.
     * Lower zoom levels will use a larger grantuality, doubled for each zoom level step from this value.
     * This ensures that then looking at the entire earth, it will be subdivided enough give the illusion of an actual sphere
     * (and not a poorly tesselated triangular mesh). This also ensures that higher zoom levels are not needlessly subdivided.
     */
    private static readonly targetGranualityMinZoom = 3;

    private static readonly targetGranualityStencil = 8;
    private static readonly targetGranualityMinZoomStencil = 3;

    private tileMeshCache: Array<Mesh> = null;

    constructor(map: Map) {
        this.map = map;
    }

    public updateProjection(transform: Transform): void {
        // cam....------------A
        //        ....        |
        //            ....    |
        //                ....B
        //                ggggggggg
        //          gggggg    |   .gggggg
        //       ggg          |       ...ggg
        //     gg             |
        //    g               |
        //    g               |
        //   g                C
        //
        // Notes:
        // - "g" marks the globe edge
        // - the dotted line is the camera center "ray" - we are looking in this direction
        // - "cam" is camera origin
        // - "C" is globe center
        // - "B" is the point on "top" of the globe - camera is looking at B - "B" is the intersection between the camera center ray and the globe
        // - this._pitch is the angle at B between points cam,B,A
        // - this.cameraToCenterDistance is the distance from camera to "B"
        // - globe radius is (0.5 * this.worldSize)
        // - "T" is any point where a tangent line from "cam" touches the globe surface
        // - elevation is assumed to be zero - globe rendering must be separate from terrain rendering anyway

        const globeRadiusInTransformUnits = transform.worldSize * 0.5;
        const pitch = transform.pitch;
        // scale so that the globe radius is 1
        const distanceCameraToB = transform.cameraToCenterDistance / globeRadiusInTransformUnits;
        const radius = 1;

        // Distance from camera to "A" - the point at the same elevation as camera, right above center point on globe
        const distanceCameraToA = Math.sin(pitch) * distanceCameraToB;
        // Distance from "A" to "C"
        const distanceAtoC = (Math.cos(pitch) * distanceCameraToB + radius);
        // Distance from camera to "C" - the globe center
        const distanceCameraToC = Math.sqrt(distanceCameraToA * distanceCameraToA + distanceAtoC * distanceAtoC);
        // Distance from camera to T points (any of them)
        const distanceCameraT = Math.sqrt(distanceCameraToC * distanceCameraToC - radius * radius);
        // cam - C - T angle cosine (at C)
        const camCTcosine = radius / distanceCameraToC;
        // Distance from globe center to the plane defined by all possible "T" points
        const tangentPlaneDistanceToC = distanceCameraToC * radius;

        // JP: TODO: use this to clip stuff
    }

    public getProjectionData(tileID: OverscaledTileID): ProjectionData {
        const identity = mat4.identity(Float32Array as any);
        const data: ProjectionData = {
            'u_projection_matrix': identity,
            'u_projection_tile_mercator_coords': [0, 0, 1, 1],
        };

        if (tileID) {
            data['u_projection_matrix'] = tileID.posMatrix;
            data['u_projection_tile_mercator_coords'] = [
                tileID.canonical.x / (1 << tileID.canonical.z),
                tileID.canonical.y / (1 << tileID.canonical.z),
                (tileID.canonical.x + 1) / (1 << tileID.canonical.z),
                (tileID.canonical.y + 1) / (1 << tileID.canonical.z)
            ];
        }

        if (this.map.globe) {
            this.setGlobeProjection(data);
        }

        return data;
    }

    private setGlobeProjection(data: ProjectionData): void {
        data['u_projection_matrix'] = this.map.transform.globeProjMatrix;
    }

    public getMesh(context: Context, zoomLevel: number): Mesh {
        if (!this.tileMeshCache) {
            this.tileMeshCache = [];
            for (let zoom = 0; zoom <= ProjectionManager.targetGranualityMinZoom; zoom++) {
                this.tileMeshCache.push(this._createQuadMesh(context, ProjectionManager.getGranualityForZoomLevel(zoom, ProjectionManager.targetGranualityStencil, ProjectionManager.targetGranualityMinZoomStencil)));
                //this.tileMeshCache.push(this._createQuadMeshUsingSubdivision(context, zoom));
            }
        }

        return this.tileMeshCache[Math.min(zoomLevel, ProjectionManager.targetGranualityMinZoom)];
    }

    public static getGranualityForZoomLevelForTiles(zoomLevel: number): number {
        return ProjectionManager.getGranualityForZoomLevel(zoomLevel, ProjectionManager.targetGranuality, ProjectionManager.targetGranualityMinZoom);
    }

    private static getGranualityForZoomLevel(zoomLevel: number, target: number, minToom: number): number {
        return target << Math.max(minToom - zoomLevel, 0);
    }

    /**
     * Creates a quad mesh covering positions in range 0..EXTENT, eg. for tile clipping.
     * @param context MapLibre's rendering context object.
     * @param granuality Mesh triangulation granuality: 1 for just a single quad, 3 for 3x3 quads.
     * @returns
     */
    private _createQuadMesh(context: Context, granuality: number): Mesh {
        const verticesPerAxis = granuality + 1;

        const vertexArray = new PosArray();
        const indexArray = new TriangleIndexArray();

        for (let y = 0; y < verticesPerAxis; y++) {
            for (let x = 0; x < verticesPerAxis; x++) {
                vertexArray.emplaceBack(x / granuality * EXTENT, y / granuality * EXTENT);
            }
        }

        for (let y = 0; y < granuality; y++) {
            for (let x = 0; x < granuality; x++) {
                const v0 = x + y * verticesPerAxis;
                const v1 = (x + 1) + y * verticesPerAxis;
                const v2 = x + (y + 1) * verticesPerAxis;
                const v3 = (x + 1) + (y + 1) * verticesPerAxis;
                // v0----v1
                //  |  / |
                //  | /  |
                // v2----v3
                indexArray.emplaceBack(v0, v2, v1);
                indexArray.emplaceBack(v1, v2, v3);
            }
        }

        const mesh = new Mesh(
            context.createVertexBuffer(vertexArray, posAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );

        return mesh;
    }

    private _createQuadMeshUsingSubdivision(context: Context, zoomLevel: number): Mesh {
        const flattenedVertices = [
            0, 0,
            EXTENT, 0,
            0, EXTENT,
            EXTENT, EXTENT,
        ];
        const indices = [
            0, 2, 1,
            2, 3, 1
        ];

        const subdivided = subdivideFill(flattenedVertices, indices, null, ProjectionManager.getGranualityForZoomLevelForTiles(zoomLevel));

        const vertexArray = new PosArray();
        const indexArray = new TriangleIndexArray();

        for (let i = 0; i < subdivided.verticesFlattened.length; i += 2) {
            vertexArray.emplaceBack(subdivided.verticesFlattened[i], subdivided.verticesFlattened[i + 1]);
        }
        for (let i = 0; i < subdivided.indicesTriangles.length; i += 3) {
            indexArray.emplaceBack(subdivided.indicesTriangles[i], subdivided.indicesTriangles[i + 1], subdivided.indicesTriangles[i + 2]);
        }

        const mesh = new Mesh(
            context.createVertexBuffer(vertexArray, posAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );

        return mesh;
    }
}
