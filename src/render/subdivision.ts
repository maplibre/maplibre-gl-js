export class SubdivisionGranularityExpression {
    /**
     * A tile of zoom level 0 will be subdivided to this granularity level.
     * Each subsequent zoom level will have its granularity halved.
     */
    private readonly _baseZoomGranularity: number;

    /**
     * No tile will have granularity level smaller than this.
     */
    private readonly _minGranularity: number;

    constructor(baseZoomGranularity: number, minGranularity: number) {
        this._baseZoomGranularity = baseZoomGranularity;
        this._minGranularity = minGranularity;
    }

    public getGranularityForZoomLevel(zoomLevel: number): number {
        const divisor = 1 << zoomLevel;
        return Math.max(Math.floor(this._baseZoomGranularity / divisor), this._minGranularity, 0);
    }
}

export class SubdivisionGranularitySetting {
    /**
     * granularity settings used for fill layer (both polygons and their anti-aliasing outlines).
     */
    public readonly fill;

    /**
     * granularity used for the line layer.
     */
    public readonly line;

    constructor(options: {fill: SubdivisionGranularityExpression; line: SubdivisionGranularityExpression}) {
        this.fill = options.fill;
        this.line = options.line;
    }
}

export const granularitySettings: SubdivisionGranularitySetting = new SubdivisionGranularitySetting({
    fill: new SubdivisionGranularityExpression(128, 1),
    line: new SubdivisionGranularityExpression(512, 1)
});

// Lots more code to come once fill, line and fill-extrusion layers get ported.
