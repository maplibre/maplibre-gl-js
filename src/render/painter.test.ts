import {TerrainSpecification} from '@maplibre/maplibre-gl-style-spec';

import {Painter} from './painter';
import {Transform} from '../geo/transform';
import {Style} from '../style/style';
import {Evented} from '../util/evented';
import {RequestManager} from '../util/request_manager';

class StubMap extends Evented {
    style: Style;
    transform: Transform;
    private _requestManager: RequestManager;
    _terrain: TerrainSpecification;

    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = new RequestManager();
    }

    _getMapId() {
        return 1;
    }

    getPixelRatio() {
        return 1;
    }

    setTerrain(terrain) { this._terrain = terrain; }
    getTerrain() { return this._terrain; }
}

const getStubMap = () => new StubMap() as any;

test('Render must not fail with incompletely loaded style', () => {
    const gl = document.createElement('canvas').getContext('webgl');
    const transform = new Transform(0, 22, 0, 60, true);
    const painter = new Painter(gl, transform);
    const map = getStubMap();
    const style = new Style(map);
    style._updatePlacement(transform, false, 0, false);
    painter.render(style, {
        fadeDuration: 0,
        moving: false,
        rotating: false,
        showOverdrawInspector: false,
        showPadding: false,
        showTileBoundaries: false,
        zooming: false,
    });
});
