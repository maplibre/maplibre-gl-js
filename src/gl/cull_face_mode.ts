import type {CullFaceModeType, FrontFaceType} from './types';

const FRONT = 0x0404;
const BACK = 0x0405;
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
     * Opposite of {@link backCCW}. Culls front-facing triangles when counterclockwise vertex order is used.
     */
    static frontCCW: Readonly<CullFaceMode>;
}

CullFaceMode.disabled = new CullFaceMode(false, BACK, CCW);
CullFaceMode.backCCW = new CullFaceMode(true, BACK, CCW);
CullFaceMode.frontCCW = new CullFaceMode(true, FRONT, CCW);
