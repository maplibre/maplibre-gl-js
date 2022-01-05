import Protobuf from 'pbf';
import vtpbf from 'vt-pbf';
import geojsonVt from 'geojson-vt';
import MultiSourceLayerGeoJSONWrapper from './multi_source_geojson_wrapper';
import VectorTileWorkerSource, {LoadVectorDataCallback} from './vector_tile_worker_source';
import {getArrayBuffer} from '../util/ajax';
import {aggregateTile} from '@globalfishingwatch/fourwings-aggregate';
import tilebelt from '@mapbox/tilebelt';
import {WorkerTileParameters} from './worker_source';

const objectEntries =
    Object.entries ||
    function (obj) {
        const ownProps = Object.keys(obj);
        let i = ownProps.length;
        const resArray = new Array(i); // preallocate the Array
        while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];
        return resArray;
    };

const objectFromEntries =
    Object.fromEntries ||
    function (entries) {
        if (!entries || !entries[Symbol.iterator]) {
            throw new Error('Object.fromEntries() requires a single iterable argument');
        }
        const obj = {};
        for (const [key, value] of entries) {
            obj[key] = value;
        }
        return obj;
    };

class SearchParams {
    query: string;
    constructor(query) {
        this.query = query;
    }
    getSearchObject() {
        const {query} = this;
        return query
            ? (/^[?#]/.test(query) ? query.slice(1) : query).split('&').reduce((params, param) => {
                  let [key, value] = param.split('=');
                  params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
                  return params;
              }, {})
            : {};
    }
    get(param) {
        const searchParams = this.getSearchObject();
        return searchParams[param];
    }
}

const getAggregationParams = (params) => {
    const url = new URL(params.request.url);
    const searchParams = url.searchParams;
    let finalParams;
    if (searchParams) {
        finalParams = Object.fromEntries(searchParams);
    } else {
        finalParams = new SearchParams(params.request.url).getSearchObject();
    }
    const {x, y, z} = params.tileID.canonical;
    const {interval, aggregationOperation, sublayerCombinationMode} = finalParams;

    const aggregationParams = {
        x,
        y,
        z,
        interval,
        aggregationOperation,
        sublayerCombinationMode,
        singleFrame: finalParams.singleFrame === 'true',
        interactive: finalParams.interactive === 'true',
        quantizeOffset: parseInt(finalParams.quantizeOffset || '0'),
        geomType: finalParams.geomType || 'point',
        delta: parseInt(finalParams.delta) || '10',
        sublayerCount: parseInt(finalParams.sublayerCount) || 1,
        sublayerBreaks: finalParams.sublayerBreaks ? JSON.parse(finalParams.sublayerBreaks) : null,
        sublayerVisibility: finalParams.sublayerVisibility
            ? JSON.parse(finalParams.sublayerVisibility)
            : new Array(finalParams.sublayerCount).fill(true)
    };
    return objectFromEntries(
        objectEntries(aggregationParams).filter(([key, value]) => {
            return value !== undefined && value !== null;
        })
    );
};

type FinalUrlParams = {
    singleFrame: boolean;
    interval: string;
};
const getFinalurl = (originalUrlString, {singleFrame, interval}: FinalUrlParams) => {
    const originalUrl = new URL(originalUrlString);
    let searchParams = originalUrl.searchParams;
    if (!searchParams) {
        searchParams = new SearchParams(originalUrlString) as any;
    }

    const finalUrlParams = {
        // We want proxy active as default when api tiles auth is required
        proxy: searchParams.get('proxy') !== 'false',
        format: 'intArray',
        'temporal-aggregation': singleFrame === true,
        interval,
        'date-range': decodeURI(searchParams.get('date-range')),
        'comparison-range': decodeURI(searchParams.get('comparison-range'))
    };
    const finalUrlParamsArr = objectEntries(finalUrlParams)
        .filter(([key, value]) => {
            return value !== undefined && value !== null && value !== 'undefined' && value !== 'null';
        })
        .map(([key, value]) => {
            return `${key}=${value}`;
        });
    finalUrlParamsArr.push(searchParams.get('datasets'));
    finalUrlParamsArr.push(searchParams.get('filters'));
    const finalUrlStr = `${originalUrl.origin}${originalUrl.pathname}?${finalUrlParamsArr.join('&')}`;
    return decodeURI(finalUrlStr);
};

const geoJSONtoVectorTile = (geoJSON, options) => {
    const {x, y, z} = options;
    const tileindex = geojsonVt(geoJSON);
    const newTile = tileindex.getTile(z, x, y);
    return newTile;
};

const decodeProto = (data) => {
    const readField = function (tag, obj, pbf) {
        if (tag === 1) pbf.readPackedVarint(obj.data);
    };
    const read = function (pbf, end?) {
        return pbf.readFields(readField, {data: []}, end);
    };
    const pbfData = new Protobuf(data);
    const intArray = read(pbfData);
    return intArray && intArray.data;
};

type SourceLayers = {
    temporalgrid: any;
    temporalgrid_interactive?: any;
};
const getTile = (data, options) => {
    const {x, y, z} = options;
    const tileBBox = tilebelt.tileToBBOX([x, y, z]);
    const int16ArrayBuffer = decodeProto(data);
    // TODO update lib version to support rows, columns, and multiplier
    const aggregated = aggregateTile(int16ArrayBuffer, {
        ...options,
        tileBBox
    });

    const mainTile = geoJSONtoVectorTile(aggregated.main, options);
    const sourceLayers: SourceLayers = {
        temporalgrid: mainTile
    };
    if (options.interactive === true) {
        const interactiveTile = geoJSONtoVectorTile(aggregated.interactive, options);
        sourceLayers.temporalgrid_interactive = interactiveTile;
    }
    const geojsonWrapper = new MultiSourceLayerGeoJSONWrapper(sourceLayers, {
        extent: 4096
    });

    let pbf = vtpbf.fromGeojsonVt(sourceLayers);

    if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
        // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
        pbf = new Uint8Array(pbf);
    }

    return {
        vectorTile: geojsonWrapper,
        rawData: pbf.buffer
    };
};

const loadVectorData = (params: WorkerTileParameters, callback: LoadVectorDataCallback) => {
    const aggregationParams = getAggregationParams(params);
    const url = getFinalurl(params.request.url, aggregationParams as FinalUrlParams);
    // console.log(url)
    const requestParams = Object.assign({}, params.request, {url});
    const request = getArrayBuffer(
        requestParams,
        (err?: Error | null, data?: ArrayBuffer | null, cacheControl?: string | null, expires?: string | null) => {
            if (err) {
                callback(err);
            } else if (data) {
                const tile = getTile(data, aggregationParams);
                callback(null, {
                    ...tile,
                    cacheControl,
                    expires
                });
            }
        }
    );
    return () => {
        request.cancel();
        callback();
    };
};

class TemporalGridTileWorkerSource extends VectorTileWorkerSource {
    constructor(actor, layerIndex, availableImages) {
        super(actor, layerIndex, availableImages, loadVectorData);
    }
}

export default TemporalGridTileWorkerSource;
