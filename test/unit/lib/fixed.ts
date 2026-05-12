export function fixedNum(n:number, precision = 10): number {

    const fixedNum = parseFloat(n.toFixed(precision));

    // Support signed zero
    if (fixedNum === 0) {
        return 0;
    } else {
        return fixedNum;
    }
}

export function fixedLngLat(l: any, precision = 9): {
    lng: number;
    lat: number;
} {

    return {
        lng: fixedNum(l.lng, precision),
        lat: fixedNum(l.lat, precision)
    };
}

export function fixedCoord(coord: any, precision = 10): {
    x: number;
    y: number;
    z: number;
} {

    return {
        x: fixedNum(coord.x, precision),
        y: fixedNum(coord.y, precision),
        z: fixedNum(coord.z, precision)
    };
}
