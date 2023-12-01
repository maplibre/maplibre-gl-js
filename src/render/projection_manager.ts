import {mat4, vec3} from 'gl-matrix';
import {Context} from '../gl/context';
import {Map} from '../ui/map';
import {Uniform4f, UniformLocations, UniformMatrix4f} from './uniform_binding';
import {CanonicalTileID, OverscaledTileID} from '../source/tile_id';
import {Pos3dArray, PosArray, TriangleIndexArray} from '../data/array_types.g';
import {Mesh} from './mesh';
import {EXTENT, EXTENT_STENCIL_BORDER} from '../data/extent';
import {SegmentVector} from '../data/segment';
import posAttributes from '../data/pos_attributes';
import {Transform} from '../geo/transform';
import {Painter} from './painter';
import {Tile} from '../source/tile';

export type ProjectionPreludeUniformsType = {
    'u_projection_matrix': UniformMatrix4f;
    'u_projection_tile_mercator_coords': Uniform4f;
    'u_projection_clipping_plane': Uniform4f;
};

export const projectionUniforms = (context: Context, locations: UniformLocations): ProjectionPreludeUniformsType => ({
    'u_projection_matrix': new UniformMatrix4f(context, locations.u_projection_matrix),
    'u_projection_tile_mercator_coords': new Uniform4f(context, locations.u_projection_tile_mercator_coords),
    'u_projection_clipping_plane': new Uniform4f(context, locations.u_projection_clipping_plane)
});

export type ProjectionData = {
    'u_projection_matrix': mat4;
    'u_projection_tile_mercator_coords': [number, number, number, number];
    'u_projection_clipping_plane': [number, number, number, number];
}

export class ProjectionManager {
    map: Map;

    /**
     * Mercator tiles will be subdivided to this degree of granuality in order to allow for a curved projection.
     * Should be a power of 2.
     */
    private static readonly targetGranuality = 1;

    /**
     * The granuality specified by `targetGranuality` will be used for zoom levels from this value onwards.
     * Lower zoom levels will use a larger grantuality, doubled for each zoom level step from this value.
     * This ensures that then looking at the entire earth, it will be subdivided enough give the illusion of an actual sphere
     * (and not a poorly tesselated triangular mesh). This also ensures that higher zoom levels are not needlessly subdivided.
     */
    private static readonly targetGranualityMinZoom = 6;

    // At targetGranuality=8 and minzoom=4 (base tile granuality of 128) the sphere appears almost perfectly smooth
    // triangulation is invisible, apart from slight pixel shimmering at the equator

    private static readonly targetGranualityStencil = 8;
    private static readonly targetGranualityMinZoomStencil = 3;

    private _tileMeshCache: {[_: string]: Mesh} = {};
    private _cachedClippingPlane: [number, number, number, number] = [1, 0, 0, 0];

    constructor(map: Map) {
        this.map = map;
    }

    public updateProjection(transform: Transform): void {

        // We want to compute a plane equation that, when applied to the unit sphere generated
        // in the vertex shader, places all visible parts of the sphere into the positive half-space
        // and all the non-visible parts in the negative half-space.
        // We can then use that to accurately clip all non-visible geometry.

        // cam....------------A
        //        ....        |
        //            ....    |
        //                ....B
        //                ggggggggg
        //          gggggg    |   .gggggg
        //       ggg          |       ...ggg    ^
        //     gg             |                 |
        //    g               |                 y
        //    g               |                 |
        //   g                C                 #---x--->
        //
        // Notes:
        // - note the coordinate axes
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
        const pitch = transform.pitch * Math.PI / 180.0;
        // scale things so that the globe radius is 1
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
        const tangentPlaneDistanceToC = camCTcosine * radius;

        let vectorCtoCamX = -distanceCameraToA;
        let vectorCtoCamY = distanceAtoC;
        // Normalize the vector
        const vectorCtoCamLength = Math.sqrt(vectorCtoCamX * vectorCtoCamX + vectorCtoCamY * vectorCtoCamY);
        vectorCtoCamX /= vectorCtoCamLength;
        vectorCtoCamY /= vectorCtoCamLength;

        // Note the swizzled components
        const planeVector: vec3 = [0, vectorCtoCamX, vectorCtoCamY];
        // Apply transforms - lat, lng and angle (NOT pitch - already accounted for, as it affects the tangent plane)
        vec3.rotateZ(planeVector, planeVector, [0, 0, 0], transform.angle);
        vec3.rotateX(planeVector, planeVector, [0, 0, 0], -1 * transform.center.lat * Math.PI / 180.0);
        vec3.rotateY(planeVector, planeVector, [0, 0, 0], transform.center.lng * Math.PI / 180.0);
        // Scale the plane vector down
        const scale = 0.25;
        vec3.scale(planeVector, planeVector, scale);
        this._cachedClippingPlane = [...planeVector, -tangentPlaneDistanceToC * scale];
    }

    public getProjectionData(tileID: OverscaledTileID, fallBackMatrix?: mat4): ProjectionData {
        const identity = mat4.identity(Float32Array as any);
        const data: ProjectionData = {
            'u_projection_matrix': identity,
            'u_projection_tile_mercator_coords': [0, 0, 1, 1],
            'u_projection_clipping_plane': [...this._cachedClippingPlane],
        };

        if (tileID) {
            data['u_projection_matrix'] = fallBackMatrix ? fallBackMatrix : tileID.posMatrix;
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

    public getPixelScale(): number {
        if (this.map.globe) {
            // JP: TODO: this is a magic value based on guesswork, find out how to calculate it!
            return 2.5;
        }
        return 1.0;
    }

    private setGlobeProjection(data: ProjectionData): void {
        data['u_projection_matrix'] = this.map.transform.globeProjMatrix;
    }

    private getMeshKey(granuality: number, north: boolean, south: boolean): string {
        return `${granuality.toString(36)}_${north ? 'n' : ''}${south ? 's' : ''}`;
    }

    public getMesh(context: Context, canonical: CanonicalTileID): Mesh {
        const granuality = ProjectionManager.getGranualityForZoomLevel(canonical.z, ProjectionManager.targetGranualityStencil, ProjectionManager.targetGranualityMinZoomStencil);
        const north = canonical.y === 0;
        const south = canonical.y === (1 << canonical.z) - 1;
        const key = this.getMeshKey(granuality, north, south);

        if (key in this._tileMeshCache) {
            return this._tileMeshCache[key];
        }

        const mesh = this._createQuadMesh(context, granuality, north, south);
        this._tileMeshCache[key] = mesh;
        return mesh;
    }

    public translatePosition(painter: Painter, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport'): [number, number] {
        // In the future, some better translation for globe and other weird projections should be implemented here,
        // especially for the translateAnchor==='viewport' case.
        return painter.translatePosition(tile, translate, translateAnchor);
    }

    public static getGranualityForZoomLevelForTiles(zoomLevel: number): number {
        return ProjectionManager.getGranualityForZoomLevel(zoomLevel, ProjectionManager.targetGranuality, ProjectionManager.targetGranualityMinZoom);
    }

    private static getGranualityForZoomLevel(zoomLevel: number, target: number, minZoom: number): number {
        return Math.max(target << Math.max(minZoom - zoomLevel, 0), 1);
    }

    /**
     * Creates a quad mesh covering positions in range 0..EXTENT, for tile clipping.
     * @param context MapLibre's rendering context object.
     * @param granuality Mesh triangulation granuality: 1 for just a single quad, 3 for 3x3 quads.
     * @returns
     */
    private _createQuadMesh(context: Context, granuality: number, north: boolean, south: boolean): Mesh {
        const vertexArray = new PosArray();
        const indexArray = new TriangleIndexArray();

        const quadsPerAxis = granuality + 2; // two extra quads for border
        const verticesPerAxis = granuality + 3; // one more vertex than quads

        for (let y = 0; y < verticesPerAxis; y++) {
            for (let x = 0; x < verticesPerAxis; x++) {
                let vx = (x - 1) / granuality * EXTENT;
                if (x === 0) {
                    vx = -EXTENT_STENCIL_BORDER;
                }
                if (x === verticesPerAxis - 1) {
                    vx = EXTENT + EXTENT_STENCIL_BORDER;
                }
                let vy = (y - 1) / granuality * EXTENT;
                if (y === 0) {
                    vy = -EXTENT_STENCIL_BORDER;
                }
                if (y === verticesPerAxis - 1) {
                    vy = EXTENT + EXTENT_STENCIL_BORDER;
                }
                vertexArray.emplaceBack(vx, vy);
            }
        }

        for (let y = 0; y < quadsPerAxis; y++) {
            for (let x = 0; x < quadsPerAxis; x++) {
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

        // Generate poles
        const northXY = -32768;
        const southXY = 32767;

        if (north) {
            const vNorthPole = vertexArray.length;
            vertexArray.emplaceBack(northXY, northXY);

            for (let x = 0; x < quadsPerAxis; x++) {
                const v0u = x;
                const v1u = x + 1;
                indexArray.emplaceBack(v0u, v1u, vNorthPole);
            }
        }

        if (south) {
            const vSouthPole = vertexArray.length;
            vertexArray.emplaceBack(southXY, southXY);

            for (let x = 0; x < quadsPerAxis; x++) {
                const v0u = quadsPerAxis * verticesPerAxis + x;
                const v1u = quadsPerAxis * verticesPerAxis + x + 1;
                indexArray.emplaceBack(v1u, v0u, vSouthPole);
            }
        }

        const mesh = new Mesh(
            context.createVertexBuffer(vertexArray, posAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );

        return mesh;
    }
}
