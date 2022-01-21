import fs from 'fs';
import glob from 'glob';
import path, {dirname} from 'path';
import validate from '../style-spec/validate_style';
/* eslint-disable import/no-unresolved */
import v8 from '../style-spec/reference/v8';
import migrate from '../style-spec/migrate';
import {fileURLToPath} from 'url';
/* eslint-disable import/namespace */
import * as spec from '../style-spec/style-spec';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPDATE = !!process.env.UPDATE;

describe('does not migrate from version 5', () => {
    expect(() => {
        migrate({version: 5, layers: []});
    }).toThrow(new Error('Cannot migrate from 5'));
});

describe('does not migrate from version 6', () => {
    expect(() => {
        migrate({version: 6, layers: []});
    }).toThrow(new Error('Cannot migrate from 6'));
});

describe('migrates to latest version from version 7', () => {
    expect(migrate({version: 7, layers: []}).version).toEqual(spec.latest.$version);
});

describe('converts token strings to expressions', () => {
    const migrated = migrate({
        version: 8,
        layers: [{
            id: '1',
            type: 'symbol',
            layout: {'text-field': 'a{x}', 'icon-image': '{y}'}
        }]
    }, spec.latest.$version);
    expect(migrated.layers[0].layout['text-field']).toEqual(['concat', 'a', ['get', 'x']]);
    expect(migrated.layers[0].layout['icon-image']).toEqual(['to-string', ['get', 'y']]);
});

describe('converts stop functions to expressions', () => {
    const migrated = migrate({
        version: 8,
        layers: [{
            id: '1',
            type: 'background',
            paint: {
                'background-opacity': {
                    base: 1.0,
                    stops: [[0, 1], [10, 0.72]]
                }
            }
        }, {
            id: '2',
            type: 'background',
            paint: {
                'background-opacity': {
                    base: 1.0,
                    stops: [[0, [1, 2]], [10, [0.72, 0.98]]]
                }
            }
        }]
    }, spec.latest.$version);
    expect(migrated.layers[0].paint['background-opacity']).toEqual([
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        1,
        10,
        0.72
    ]);
    expect(migrated.layers[1].paint['background-opacity']).toEqual([
        'interpolate',
        ['linear'],
        ['zoom'],
        0,
        ['literal', [1, 2]],
        10,
        ['literal', [0.72, 0.98]]
    ]);
});

describe('converts categorical function on resolvedImage type to valid expression', () => {
    const migrated = migrate({
        version: 8,
        sources: {
            streets: {
                url: 'mapbox://mapbox.streets',
                type: 'vector'
            }
        },
        layers: [{
            id: '1',
            source: 'streets',
            'source-layer': 'labels',
            type: 'symbol',
            layout: {
                'icon-image': {
                    base: 1,
                    type: 'categorical',
                    property: 'type',
                    stops: [['park', 'some-icon']]
                }
            }
        }]
    }, spec.latest.$version);
    expect(migrated.layers[0].layout['icon-image']).toEqual([
        'match',
        ['get', 'type' ],
        'park',
        'some-icon',
        ''
    ]);
    expect(validate.parsed(migrated, v8)).toEqual([]);
});

glob.sync(`${__dirname}/fixture/v7-migrate/*.input.json`).forEach((file) => {
    test(path.basename(file), () => {
        const outputfile = file.replace('.input', '.output');
        const style = JSON.parse(fs.readFileSync(file));
        const result = migrate(style);
        expect(validate.parsed(result, v8)).toEqual([]);
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        const expect = JSON.parse(fs.readFileSync(outputfile));
        expect(result).toEqual(expect);
    });
});
