import {test} from 'vitest';
import {Painter} from './painter';
import {MercatorTransform} from '../geo/projection/mercator_transform';
import {Style} from '../style/style';
import {StubMap} from '../util/test/util';

const getStubMap = () => new StubMap() as any;

test('Render must not fail with incompletely loaded style', () => {
    const gl = document.createElement('canvas').getContext('webgl');
    const transform = new MercatorTransform(0, 22, 0, 60, true);
    const painter = new Painter(gl, transform);
    const map = getStubMap();
    const style = new Style(map);
    style._setProjectionInternal('mercator');
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
