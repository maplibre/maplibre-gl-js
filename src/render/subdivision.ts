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
    public readonly granularityFill;

    /**
     * granularity used for stencil mask tiles.
     */
    public readonly granularityStencil;

    /**
     * granularity used for the line layer.
     */
    public readonly granularityLine;

    constructor(fill: SubdivisionGranularityExpression, line: SubdivisionGranularityExpression, stencil: SubdivisionGranularityExpression) {
        this.granularityFill = fill;
        this.granularityLine = line;
        this.granularityStencil = stencil;
    }
}

export const granularitySettings: SubdivisionGranularitySetting = new SubdivisionGranularitySetting(
    new SubdivisionGranularityExpression(7, 1), // Fill
    new SubdivisionGranularityExpression(9, 1), // Line
    new SubdivisionGranularityExpression(7, 3) // Stencil
);

// Lots more code to come once fill, line and fill-extrusion layers get ported.
