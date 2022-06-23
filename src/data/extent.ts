/**
 * The maximum value of a coordinate in the internal tile coordinate system. Coordinates of
 * all source features normalized to this extent upon load.
 *
 * The value is a consequence of the following:
 *
 * * Vertex buffer store positions as signed 16 bit integers.
 * * One bit is lost for signedness to support features extending past the extent on the left edge of the tile as buffer.
 * * One bit is lost to support features extending past the extent on the right edge of the tile as buffer.
 * * This leaves us with 2^14 = 16384
 *
 * @private
 * @readonly
 */
export default 16384;
