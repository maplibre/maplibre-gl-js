import {describe, test, expect, vi} from 'vitest';
import {DEMData} from './dem_data';
import {RGBAImage} from '../util/image';
import {serialize, deserialize} from '../util/web_worker_transfer';

function createMockImage(height, width) {
    // RGBAImage passed to constructor has uniform 1px padding on all sides.
    height += 2;
    width += 2;
    const pixels = new Uint8Array(height * width * 4);
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] = (i + 1) % 4 === 0 ? 1 : Math.floor(Math.random() * 256);
    }
    return new RGBAImage({height, width}, pixels);
}

function createMockClampImage(height, width) {
    const pixels = new Uint8ClampedArray(height * width * 4);
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] = (i + 1) % 4 === 0 ? 1 : Math.floor(Math.random() * 256);
    }
    return new RGBAImage({height, width}, pixels);
}

describe('DEMData', () => {
    describe('constructor', () => {
        test('Uint8Array', () => {
            const imageData0 = createMockImage(4, 4);
            const dem = new DEMData('0', imageData0, 'mapbox');
            expect(dem.uid).toBe('0');
            expect(dem.dim).toBe(4);
            expect(dem.stride).toBe(6);
        });

        test('Uint8ClampedArray', () => {
            const imageData0 = createMockClampImage(4, 4);
            const dem = new DEMData('0', imageData0, 'mapbox');
            expect(dem).not.toBeNull();
            expect(dem['uid']).toBe('0');
            expect(dem['dim']).toBe(2);
            expect(dem['stride']).toBe(4);
        });

        test('otherEncoding', () => {
            const spyOnWarnConsole = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const imageData0 = createMockImage(4, 4);
            new DEMData('0', imageData0, 'otherEncoding' as any);

            expect(spyOnWarnConsole).toHaveBeenCalledTimes(1);
            expect(spyOnWarnConsole.mock.calls).toEqual([['\"otherEncoding\" is not a valid encoding type. Valid types include \"mapbox\", \"terrarium\" and \"custom\".']]);
        });
    });
});

function testDEMBorderRegion(dem: DEMData) {
    return () => {
        let nonempty = true;
        for (let x = -1; x < 5; x++) {
            for (let y = -1; y < 5; y++) {
                if (dem.get(x, y) === -65536) {
                    nonempty = false;
                    break;
                }
            }
        }
        expect(nonempty).toBeTruthy();

        let verticalBorderMatch = true;
        for (const x of [-1, 4]) {
            for (let y = 0; y < 4; y++) {
                if (dem.get(x, y) !== dem.get(x < 0 ? x + 1 : x - 1, y)) {
                    verticalBorderMatch = false;
                    break;
                }
            }
        }
        expect(verticalBorderMatch).toBeTruthy();

        // horizontal borders empty
        let horizontalBorderMatch = true;
        for (const y of [-1, 4]) {
            for (let x = 0; x < 4; x++) {
                if (dem.get(x, y) !== dem.get(x, y < 0 ? y + 1 : y - 1)) {
                    horizontalBorderMatch = false;
                    break;
                }
            }
        }
        expect(horizontalBorderMatch).toBeTruthy();

        expect(dem.get(-1, 4) === dem.get(0, 3)).toBeTruthy();
        expect(dem.get(4, 4) === dem.get(3, 3)).toBeTruthy();
        expect(dem.get(-1, -1) === dem.get(0, 0)).toBeTruthy();
        expect(dem.get(4, -1) === dem.get(3, 0)).toBeTruthy();
    };
}

function testDEMBackfill(dem0: DEMData, dem1: DEMData) {
    return  () => {
        dem0.backfillBorder(dem1, -1, 0);
        for (let y = 0; y < 4; y++) {
            // dx = -1, dy = 0, so the left edge of dem1 should equal the right edge of dem0
            expect(dem0.get(-1, y) === dem1.get(3, y)).toBeTruthy();
        }

        dem0.backfillBorder(dem1, 0, -1);
        for (let x = 0; x < 4; x++) {
            expect(dem0.get(x, -1) === dem1.get(x, 3)).toBeTruthy();
        }

        dem0.backfillBorder(dem1, 1, 0);
        for (let y = 0; y < 4; y++) {
            expect(dem0.get(4, y) === dem1.get(0, y)).toBeTruthy();
        }

        dem0.backfillBorder(dem1, 0, 1);
        for (let x = 0; x < 4; x++) {
            expect(dem0.get(x, 4) === dem1.get(x, 0)).toBeTruthy();
        }

        dem0.backfillBorder(dem1, -1, 1);
        expect(dem0.get(-1, 4) === dem1.get(3, 0)).toBeTruthy();

        dem0.backfillBorder(dem1, 1, 1);
        expect(dem0.get(4, 4) === dem1.get(0, 0)).toBeTruthy();

        dem0.backfillBorder(dem1, -1, -1);
        expect(dem0.get(-1, -1) === dem1.get(3, 3)).toBeTruthy();

        dem0.backfillBorder(dem1, 1, -1);
        expect(dem0.get(4, -1) === dem1.get(0, 3)).toBeTruthy();
    };
}

describe('DEMData.backfillBorder with encoding', () => {
    describe('mapbox encoding', () => {
        const dem0 = new DEMData('0', createMockImage(4, 4), 'mapbox');
        const dem1 = new DEMData('1', createMockImage(4, 4), 'mapbox');

        test('border region is initially populated with neighboring data', testDEMBorderRegion(dem0));
        test('backfillBorder correctly populates borders with neighboring data', testDEMBackfill(dem0, dem1));
    });

    describe('terrarium encoding', () => {
        const dem0 = new DEMData('0', createMockImage(4, 4), 'terrarium');
        const dem1 = new DEMData('1', createMockImage(4, 4), 'terrarium');

        test('border region is initially populated with neighboring data', testDEMBorderRegion(dem0));
        test('backfillBorder correctly populates borders with neighboring data', testDEMBackfill(dem0, dem1));
    });
});

function testSerialization(dem0: DEMData, redFactor: number, greenFactor: number, blueFactor: number, baseShift: number) {
    return () => {
        const serialized = serialize(dem0);

        // calculate min/max values
        let min = Number.MAX_SAFE_INTEGER;
        let max = Number.MIN_SAFE_INTEGER;
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                const ele = dem0.get(x, y);
                if (ele > max) max = ele;
                if (ele < min) min = ele;
            }
        }

        expect(serialized).toEqual({
            $name: 'DEMData',
            uid: '0',
            dim: 4,
            stride: 6,
            data: dem0.data,
            redFactor,
            greenFactor,
            blueFactor,
            baseShift,
            max,
            min,
        });

        const transferrables = [];
        serialize(dem0, transferrables);
        expect(new Uint32Array(transferrables[0])).toEqual(dem0.data);
    };
}

function testDeserialization(dem0: DEMData) {
    return () => {
        const serialized = serialize(dem0);

        const deserialized = deserialize(serialized);
        expect(deserialized).toEqual(dem0);
    };
}

describe('DEMData is correctly serialized and deserialized', () => {
    const mapboxDEM = new DEMData('0', createMockImage(4, 4), 'mapbox');
    const terrariumDEM = new DEMData('0', createMockImage(4, 4), 'terrarium');
    const customDEM = new DEMData('0', createMockImage(4, 4), 'custom', 1.0, 2.0, 3.0, 4.0);
    test('serialized - mapbox', testSerialization(mapboxDEM, 6553.6, 25.6, 0.1, 10000));
    test('serialized - terrarium', testSerialization(terrariumDEM, 256.0, 1.0, 1.0 / 256.0, 32768.0));
    test('serialized - custom', testSerialization(customDEM, 1.0, 2.0, 3.0, 4.0));

    test('deserialized - mapbox', testDeserialization(mapboxDEM));
    test('deserialized - terrarium', testDeserialization(terrariumDEM));
    test('deserialized - custom', testDeserialization(customDEM));
});

describe('UnpackVector is correctly returned', () => {
    test('terrarium, mapbox and custom', () => {
        const mapboxDEM = new DEMData('0', createMockImage(4, 4), 'mapbox');
        const terrariumDEM = new DEMData('0', createMockImage(4, 4), 'terrarium');
        const customDEM = new DEMData('0', createMockImage(4, 4), 'custom', 1.0, 2.0, 3.0, 4.0);

        expect(terrariumDEM.getUnpackVector()).toEqual([256.0, 1.0, 1.0 / 256.0, 32768.0]);
        expect(mapboxDEM.getUnpackVector()).toEqual([6553.6, 25.6, 0.1, 10000.0]);
        expect(customDEM.getUnpackVector()).toEqual([1.0, 2.0, 3.0, 4.0]);
    });
});

function testGetPixels(dem: DEMData, imageData: RGBAImage) {
    return () => {
        expect(dem.getPixels()).toEqual(imageData);
    };
}

describe('DEMData.getImage', () => {
    const imageData = createMockImage(4, 4);
    const mapboxDEM = new DEMData('0', imageData, 'terrarium');
    const terrariumDEM = new DEMData('0', imageData, 'terrarium');
    const customDEM = new DEMData('0', imageData, 'terrarium');

    test('Image is correctly returned - mapbox', testGetPixels(mapboxDEM, imageData));
    test('Image is correctly returned - terrarium', testGetPixels(terrariumDEM, imageData));
    test('Image is correctly returned - custom', testGetPixels(customDEM, imageData));
});

describe('DEMData pack and unpack', () => {
    const imageData = createMockImage(4, 4);
    test('mapbox', () => {
        const dem = new DEMData('0', imageData, 'mapbox');
        expect(dem.unpack(123, 177, 215)).toEqual(800645.5);
        expect(dem.pack(800645.5)).toEqual({r: 123, g: 177, b: 215});

        expect(dem.unpack(0, 0, 0)).toEqual(-10000);
        expect(dem.pack(-10000)).toEqual({r: 0, g: 0, b: 0});

        expect(dem.unpack(1, 1, 1)).toBeCloseTo(-3420.7);
        expect(dem.pack(-3420.7)).toEqual({r: 1, g: 1, b: 1});

        expect(dem.unpack(255, 255, 255)).toEqual(1667721.5);
        expect(dem.pack(1667721.5)).toEqual({r: 255, g: 255, b: 255});

        expect(dem.unpack(255, 0, 255)).toEqual(1661193.5);
        expect(dem.pack(1661193.5)).toEqual({r: 255, g: 0, b: 255});
    });
    
    test('terrarium', () => {
        const dem = new DEMData('0', imageData, 'terrarium');
        expect(dem.unpack(123, 177, 215)).toEqual(-1102.16015625);
        expect(dem.pack(-1102.16015625)).toEqual({r: 123, g: 177, b: 215});

        expect(dem.unpack(0, 0, 0)).toEqual(-32768);
        expect(dem.pack(-32768)).toEqual({r: 0, g: 0, b: 0});

        expect(dem.unpack(1, 1, 1)).toEqual(-32510.99609375);
        expect(dem.pack(-32510.99609375)).toEqual({r: 1, g: 1, b: 1});

        expect(dem.unpack(255, 255, 255)).toEqual(32767.99609375);
        expect(dem.pack(32767.99609375)).toEqual({r: 255, g: 255, b: 255});

        expect(dem.unpack(255, 0, 255)).toEqual(32512.99609375);
        expect(dem.pack(32512.99609375)).toEqual({r: 255, g: 0, b: 255});
    });
    
    test('custom', () => {
        const dem = new DEMData('0', imageData, 'custom', 0.25, 64, 16384, 7000.0);
        expect(dem.unpack(123, 177, 215)).toEqual(3526918.75);
        expect(dem.pack(3526918.75)).toEqual({r: 123, g: 177, b: 215});

        expect(dem.unpack(0, 0, 0)).toEqual(-7000);
        expect(dem.pack(-7000)).toEqual({r: 0, g: 0, b: 0});

        expect(dem.unpack(1, 1, 1)).toEqual(9448.25);
        expect(dem.pack(9448.25)).toEqual({r: 1, g: 1, b: 1});

        expect(dem.unpack(255, 255, 255)).toEqual(4187303.75);
        expect(dem.pack(4187303.75)).toEqual({r: 255, g: 255, b: 255});

        expect(dem.unpack(255, 0, 255)).toEqual(4170983.75);
        expect(dem.pack(4170983.75)).toEqual({r: 255, g: 0, b: 255});
    });
});