import type {CullFaceModeType, FrontFaceType} from './types';

const BACK = 0x0405;
const CW = 0x0900;
const CCW = 0x0901;

export class CullFaceMode {
    enable: boolean;
    mode: CullFaceModeType;
    frontFace: FrontFaceType;

    constructor(enable: boolean, mode: CullFaceModeType, frontFace: FrontFaceType) {
        this.enable = enable;
        this.mode = mode;
        this.frontFace = frontFace;
    }

    static disabled: Readonly<CullFaceMode>;

    /**
     * The standard GL cull mode. Culls backfacing triangles when counterclockwise vertex order is used.
     * Use for 3D geometry such as terrain.
     */
    static backCCW: Readonly<CullFaceMode>;

    /**
     * Cull mode for rendering fill layer polygons, which use nonstandard clockwise vertex order.
     */
    static backCW: Readonly<CullFaceMode>;
}

CullFaceMode.disabled = new CullFaceMode(false, BACK, CCW);
CullFaceMode.backCCW = new CullFaceMode(true, BACK, CCW);
CullFaceMode.backCW = new CullFaceMode(true, BACK, CW);
