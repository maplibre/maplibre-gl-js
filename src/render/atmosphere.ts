import {TriangleIndexArray, AtmosphereBoundsArray} from '../data/array_types.g';
import {atmosphereAttributes} from '../data/atmosphere_attributes';
import {SegmentVector} from '../data/segment';
import {Painter} from './painter';
import {Mesh} from './mesh';
import {mat3, mat4, vec3} from 'gl-matrix';
import {Projection} from '../geo/projection/projection';
import {LngLat} from '../geo/lng_lat';

export class Atmosphere {
    /**
     * The style this terrain corresponds to
     */
    painter: Painter;

    _mesh: Mesh;

    constructor(painter: Painter) {
        this.painter = painter;
    }

    getAtmosphereMesh(): Mesh {
        if (this._mesh) return this._mesh;

        const context = this.painter.context;

        const vertexArray = new AtmosphereBoundsArray();
        vertexArray.emplaceBack(-1, -1, 0.0, 1.0);
        vertexArray.emplaceBack(+1, -1, 0.0, 1.0);
        vertexArray.emplaceBack(+1, +1, 0.0, 1.0);
        vertexArray.emplaceBack(-1, +1, 0.0, 1.0);

        const indexArray = new TriangleIndexArray();
        indexArray.emplaceBack(0, 1, 2);
        indexArray.emplaceBack(0, 2, 3);

        this._mesh = new Mesh(
            context.createVertexBuffer(vertexArray, atmosphereAttributes.members),
            context.createIndexBuffer(indexArray),
            SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length)
        );

        return this._mesh;
    }

    // Based on: https://en.wikipedia.org/wiki/Julian_day

    int(value: number): number {
        if (value > 0) {
            return Math.floor(value);
        } else {
            return Math.ceil(value);
        }
    }

    computeJulianDate(date: Date): number {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        const hour = date.getUTCHours();
        const minute = date.getUTCMinutes();
        const second = date.getUTCSeconds();

        const A = this.int((month - 14) / 12);
        const JDN = this.int((1461 * (year + 4800 + A)) / 4) + this.int((367 * (month - 2 - 12 * A)) / 12) - this.int((3 * this.int(((year + 4900 + A) / 100))) / 4) + day - 32075;
        return JDN + (hour - 12) / 24 + minute / 1440 + second / 86400;
    }

    // Based on: https://en.wikipedia.org/wiki/Position_of_the_Sun

    solarMeanLongitude(d: number): number {
        return (280.460 + 0.9856474 * d) * (2.0 * Math.PI) / 360.0;
    }

    solarMeanAnomaly(d: number): number {
        return (357.528 + 0.9856003 * d) * (2.0 * Math.PI) / 360.0;
    }

    eclipticLongitude(L: number, g: number): number {
        return L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * (2.0 * Math.PI) / 360.0;
    }

    obliquityOfTheEcliptic(n: number): number {
        return (23.439 - 0.0000004 * n) * (2.0 * Math.PI) / 360.0;
    }

    rightAscension(e: number, lambda: number): number {
        return Math.atan2(Math.cos(e) * Math.sin(lambda), Math.cos(lambda));
    }

    declination(e: number, lambda: number): number {
        return Math.asin(Math.sin(e) * Math.sin(lambda));
    }

    siderealTime(n: number): number {
        // From a simplified version of https://squarewidget.com/astronomical-calculations-sidereal-time/
        return (280.46061837 + 360.98564736629 * n) * (2.0 * Math.PI) / 360.0;
    }

    computeSunPos(date: Date, projection: Projection): vec3 {
        // Compute ecliptic coordinates
        const jd = this.computeJulianDate(date);
        const n = jd - 2451545.0;
        const L = this.solarMeanLongitude(n);
        const g = this.solarMeanAnomaly(n);
        const lambda = this.eclipticLongitude(L, g);
        const e = this.obliquityOfTheEcliptic(n);

        // Compute equatorial coordinates
        let ra = this.rightAscension(e, lambda);
        if (ra < 0) ra = ra + Math.PI;
        const dec = this.declination(e, lambda);

        // Convert to lon, lat coordinates
        const gmst = Math.abs(this.siderealTime(jd) % (2.0 * Math.PI));

        const lat = dec;
        const lon = (ra - gmst);
        const distance = 100000; // A distance far away of the Earth (only the final direction is used)

        return projection.transformPosition(new LngLat(lon, lat), distance);
    }

    getSunPos(): vec3 {
        // Try to use Light position, if not available, compute the light direction based on current time
        if (this.painter.style.light) {
            const light = this.painter.style.light;

            const _lp = light.properties.get('position');
            const lightPos = [-_lp.x, -_lp.y, -_lp.z] as vec3;

            const lightMat = mat4.identity(new Float64Array(16) as any);

            if (light.properties.get('anchor') === 'map') {
                mat4.rotateX(lightMat, lightMat, -this.painter.transform.pitch * Math.PI / 180);
                mat4.rotateZ(lightMat, lightMat, -this.painter.transform.angle);
                mat4.rotateX(lightMat, lightMat, this.painter.transform.center.lat * Math.PI / 180.0);
                mat4.rotateY(lightMat, lightMat, -this.painter.transform.center.lng * Math.PI / 180.0);
            }

            vec3.transformMat4(lightPos, lightPos, lightMat);

            return lightPos;
        } else {
            // Use current time
            const sunDateAndTime = new Date();

            return this.computeSunPos(sunDateAndTime, this.painter.style.map.projection);
        }
    }

    getAtmosphereBlend(): number {
        // Compute atmosphere coefficient to fade out it as we are closer to the Earth
        const atmosphereBlend = this.painter.style.sky ? this.painter.style.sky.properties.get('atmosphere-blend') : 0.0;

        return atmosphereBlend;
    }
}
