import {CoverageReport} from 'monocart-coverage-reports';

new CoverageReport({

    name: 'MapLibre Unit Tests Coverage Report',

    reports: [
        ['codecov']
    ],

    sourceFilter: (sourcePath) => {
        return !sourcePath.includes('node_modules/') && sourcePath.search(/src\//) !== -1;
    },

    inputDir: [
        './coverage/unit/raw'
    ],

    outputDir: './coverage/merged'
}).generate();