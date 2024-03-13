export class SubdivisionGranularityExpression {
    /**
     * A tile of zoom level 0 will be subdivided to granularity of 2 raised to this number.
     * Each subsequent zoom level will have its granularity halved.
     */
    private readonly _baseZoomGranularityPower: number;

    /**
     * No tile will have granularity smaller than 2 raised to this number.
     */
    private readonly _minGranularityPower: number;

    constructor(baseZoomGranularityPower: number, minGranularityPower: number) {
        this._baseZoomGranularityPower = baseZoomGranularityPower;
        this._minGranularityPower = minGranularityPower;
    }

    public getGranularityForZoomLevel(zoomLevel: number): number {
        return 1 << Math.max(this._baseZoomGranularityPower - zoomLevel, this._minGranularityPower, 0);
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
    fill: new SubdivisionGranularityExpression(7, 1),
    line: new SubdivisionGranularityExpression(9, 1),
});

// Lots more code to come once fill, line and fill-extrusion layers get ported.
