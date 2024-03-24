/**
 * Controls how much subdivision happens for a given type of geometry at different zoom levels.
 */
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

/**
 * An object describing how much subdivision should be applied to different types of geometry at different zoom levels.
 */
export class SubdivisionGranularitySetting {
    /**
     * Granularity settings used for fill and fill-extrusion layers (for fill, both polygons and their anti-aliasing outlines).
     */
    public readonly fill;

    /**
     * Granularity used for the line layer.
     */
    public readonly line;

    /**
     * Granularity used for geometry covering the entire tile: stencil masks, raster tiles, etc.
     */
    public readonly tile;

    constructor(options: {
        /**
         * Granularity settings used for fill and fill-extrusion layers (for fill, both polygons and their anti-aliasing outlines).
         */
        fill: SubdivisionGranularityExpression;
        /**
         * Granularity used for the line layer.
         */
        line: SubdivisionGranularityExpression;
        /**
         * Granularity used for geometry covering the entire tile: stencil masks, raster tiles, etc.
         */
        tile: SubdivisionGranularityExpression;
    }) {
        this.fill = options.fill;
        this.line = options.line;
        this.tile = options.tile;
    }

    /**
     * Granularity settings that disable subdivision altogether.
     */
    public static readonly noSubdivision = new SubdivisionGranularitySetting({
        fill: new SubdivisionGranularityExpression(0, 0),
        line: new SubdivisionGranularityExpression(0, 0),
        tile: new SubdivisionGranularityExpression(0, 0),
    });
}
