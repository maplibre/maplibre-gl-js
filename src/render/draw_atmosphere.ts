import {StencilMode} from '../gl/stencil_mode';
import {DepthMode} from '../gl/depth_mode';
import {CullFaceMode} from '../gl/cull_face_mode';
import {atmosphereUniformValues} from './program/atmosphere_program';

import type {Painter} from './painter';
import {ColorMode} from '../gl/color_mode';
import {vec3} from 'gl-matrix';
import {Projection} from '../geo/projection/projection';
import {LngLat} from '../geo/lng_lat';

// Based on: https://en.wikipedia.org/wiki/Julian_day

function int(value: number): number {
    if (value > 0) {
        return Math.floor(value);
    } else {
        return Math.ceil(value);
    }
}

function computeJulianDate(date: Date): number {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds();

    const A = int((month - 14) / 12);
    const JDN = int((1461 * (year + 4800 + A)) / 4) + int((367 * (month - 2 - 12 * A)) / 12) - int((3 * int(((year + 4900 + A) / 100))) / 4) + day - 32075;
    return JDN + (hour - 12) / 24 + minute / 1440 + second / 86400;
}

// Based on: https://en.wikipedia.org/wiki/Position_of_the_Sun

function solarMeanLongitude(d: number): number {
    return (280.460 + 0.9856474 * d) * (2.0 * Math.PI) / 360.0;
}

function solarMeanAnomaly(d: number): number {
    return (357.528 + 0.9856003 * d) * (2.0 * Math.PI) / 360.0;
}

function eclipticLongitude(L: number, g: number): number {
    return L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * (2.0 * Math.PI) / 360.0;
}

function obliquityOfTheEcliptic(n: number): number {
    return (23.439 - 0.0000004 * n) * (2.0 * Math.PI) / 360.0;
}

function rightAscension(e: number, lambda: number): number {
    return Math.atan2(Math.cos(e) * Math.sin(lambda), Math.cos(lambda));
}

function declination(e: number, lambda: number): number {
    return Math.asin(Math.sin(e) * Math.sin(lambda));
}

function siderealTime(n: number): number {
    // From a simplified version of https://squarewidget.com/astronomical-calculations-sidereal-time/
    return (280.46061837 + 360.98564736629 * n) * (2.0 * Math.PI) / 360.0;
}

function computeSunPos(date: Date, projection: Projection): vec3 {
    // Compute ecliptic coordinates
    const jd = computeJulianDate(date);
    const n = jd - 2451545.0;
    const L = solarMeanLongitude(n);
    const g = solarMeanAnomaly(n);
    const lambda = eclipticLongitude(L, g);
    const e = obliquityOfTheEcliptic(n);

    // Compute equatorial coordinates
    let ra = rightAscension(e, lambda);
    if (ra < 0) ra = ra + Math.PI;
    const dec = declination(e, lambda);

    // Convert to lon, lat coordinates
    const gmst = Math.abs(siderealTime(jd) % (2.0 * Math.PI));

    const lat = dec;
    const lon = (ra - gmst);
    const distance = 100000; // A distance far away of the Earth (only the final direction is used)

    return projection.transformPosition(new LngLat(lon, lat), distance);
}

export function drawAtmosphere(painter: Painter) {
    const context = painter.context;
    const gl = context.gl;
    const program = painter.useProgram('atmosphere');
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, [0, 1]);

    const projection = painter.style.map.projection;
    const projectionData = projection.getProjectionData(null, null);

    const options = painter.style.map.atmosphereOptions;

    // Use current time if none is provided as option
    let sunDateAndTime = new Date();
    if (options.sunDateAndTime) {
        sunDateAndTime = new Date(options.sunDateAndTime);
    }

    const sunPos = computeSunPos(sunDateAndTime, projection);

    // Compute atmosphere coefficient to fade out it as we are closer to the Earth
    const fullAtmoZoom = options.fullAtmoZoom; // Atmosphere is fully visible bellow this zoom level
    const noAtmoZoom = options.noAtmoZoom; // Atmosphere is fully hidden above this zoom level
    const coefficient = painter.transform.zoom < fullAtmoZoom ? 0 : (painter.transform.zoom > noAtmoZoom ? 1 : (painter.transform.zoom - fullAtmoZoom) / (noAtmoZoom - fullAtmoZoom));
    const globePosition = projection.globePosition;
    const globeRadius = projection.globeRadius;
    const invProjMatrix = projection.invProjMatrix;

    const uniformValues = atmosphereUniformValues(sunPos, coefficient, globePosition, globeRadius, invProjMatrix);
    const mesh = painter.atmosphereMesh;

    program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.alphaBlended, CullFaceMode.disabled, uniformValues, null, projectionData, 'atmosphere', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
}
