import {mat4} from 'gl-matrix';
import {Context} from '../gl/context';
import {Map} from '../ui/map';
import {Uniform4f, UniformLocations, UniformMatrix4f} from './uniform_binding';
import {OverscaledTileID} from '../source/tile_id';

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

    constructor(map: Map) {
        this.map = map;
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
        data['u_projection_matrix'] = this.map.globe.cachedTransform;
    }
}
