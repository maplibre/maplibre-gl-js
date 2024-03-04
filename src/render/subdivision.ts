export class SubdivisionGranulityExpression {
    /**
     * A tile of zoom level 0 will be subdivided to granularity of 2 raised to this number.
     * Each subsequent zoom level will have its granularity halved.
     */
    private readonly _baseZoomgranularityPower: number;

    /**
     * No tile will have granularity smaller than 2 raised to this number.
     */
    private readonly _mingranularityPower: number;

    constructor(baseZoomgranularityPower: number, mingranularityPower: number) {
        this._baseZoomgranularityPower = baseZoomgranularityPower;
        this._mingranularityPower = mingranularityPower;
    }

    public getgranularityForZoomLevel(zoomLevel: number): number {
        return 1 << Math.max(this._baseZoomgranularityPower - zoomLevel, this._mingranularityPower, 0);
    }
}

export class SubdivisiongranularitySetting {
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

    constructor(fill: SubdivisionGranulityExpression, line: SubdivisionGranulityExpression, stencil: SubdivisionGranulityExpression) {
        this.granularityFill = fill;
        this.granularityLine = line;
        this.granularityStencil = stencil;
    }
}

export const granularitySettings: SubdivisiongranularitySetting = new SubdivisiongranularitySetting(
    new SubdivisionGranulityExpression(7, 1), // Fill
    new SubdivisionGranulityExpression(9, 1), // Line
    new SubdivisionGranulityExpression(7, 3) // Stencil
);

// Lots more code to come once fill, line and fill-extrusion layers get ported.
