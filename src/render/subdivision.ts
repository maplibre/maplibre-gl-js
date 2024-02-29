export class SubdivisionGranulityExpression {
    /**
     * A tile of zoom level 0 will be subdivided to granuality of 2 raised to this number.
     * Each subsequent zoom level will have its granuality halved.
     */
    private readonly _baseZoomGranualityPower: number;

    /**
     * No tile will have granuality smaller than 2 raised to this number.
     */
    private readonly _minGranualityPower: number;

    constructor(baseZoomGranualityPower: number, minGranualityPower: number) {
        this._baseZoomGranualityPower = baseZoomGranualityPower;
        this._minGranualityPower = minGranualityPower;
    }

    public getGranualityForZoomLevel(zoomLevel: number): number {
        return 1 << Math.max(this._baseZoomGranualityPower - zoomLevel, this._minGranualityPower, 0);
    }
}

export class SubdivisionGranualitySetting {
    /**
     * Granuality settings used for fill layer (both polygons and their anti-aliasing outlines).
     */
    public readonly GranualityFill;

    /**
     * Granuality used for stencil mask tiles.
     */
    public readonly GranualityStencil;

    /**
     * Granuality used for the line layer.
     */
    public readonly GranualityLine;

    constructor(fill: SubdivisionGranulityExpression, line: SubdivisionGranulityExpression, stencil: SubdivisionGranulityExpression) {
        this.GranualityFill = fill;
        this.GranualityLine = line;
        this.GranualityStencil = stencil;
    }
}

export const granualitySettings: SubdivisionGranualitySetting = new SubdivisionGranualitySetting(
    new SubdivisionGranulityExpression(7, 1), // Fill
    new SubdivisionGranulityExpression(9, 1), // Line
    new SubdivisionGranulityExpression(7, 3) // Stencil
);

// Lots more code to come once fill, line and fill-extrusion layers get ported.
