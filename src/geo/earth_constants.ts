
/*
* Approximate radius of the earth in meters.
* Uses the WGS-84 approximation. The radius at the equator is ~6378137 and at the poles is ~6356752. https://en.wikipedia.org/wiki/World_Geodetic_System#WGS84
* 6371008.8 is one published "average radius" see https://en.wikipedia.org/wiki/Earth_radius#Mean_radius, or ftp://athena.fsv.cvut.cz/ZFG/grs80-Moritz.pdf p.4
*/
export const earthRadius = 6371008.8;

/*
 * The average circumference of the world in meters.
 */
export const earthCircumfrence = 2 * Math.PI * earthRadius;
