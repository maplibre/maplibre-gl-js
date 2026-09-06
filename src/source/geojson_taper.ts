import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate.ts';
import {EXTENT} from '../data/extent.ts';
import type {CanonicalTileID} from '../tile/tile_id.ts';
import type {GeoJSON} from 'geojson';
import type {GeoJSONVTInternalTileFeature} from '@maplibre/geojson-vt';
import type Point from '@mapbox/point-geometry';

/**
 * Cross-tile-stable anchoring for the per-vertex line taper properties
 * (`line-widths`, `line-width-factors`).
 *
 * # The problem
 *
 * Line geometry is clipped per tile (by geojson-vt) before it reaches the
 * {@link LineBucket}, so a long tapered line arrives as independent pieces. The
 * piece vertices no longer correspond 1:1 to the vertices of the original feature
 * (geojson-vt inserts new vertices where a segment is cut at the tile buffer
 * boundary), and each piece covers only a fraction of the original line. Deriving
 * the width profile stops from the piece alone (the bucket's fallback) re-normalizes
 * the profile per tile: at a shared tile boundary one side ends at `widths[last]`
 * while the neighbor restarts at `widths[0]`, producing the characteristic
 * sawtooth artifact on tapered lines.
 *
 * # The fix
 *
 * While the original feature geometry is still available (in the GeoJSON worker,
 * before tiling), we record each tapered line's profile anchored to the ORIGINAL
 * line: the normalized arc position (0..1 along the original ring) of every
 * profile value. When a tile is built, every clipped piece vertex is projected
 * back onto the original line to recover its own normalized arc position. Both
 * tiles sharing a boundary therefore evaluate the very same profile at the very
 * same position, so the rendered width is continuous across tile boundaries.
 *
 * The annotation is attached to the tile feature as `_taper` and consumed by the
 * line bucket. Features without an annotation (vector tiles, constant paint
 * arrays, cluster paths) keep the previous piece-local behavior.
 */

export interface TaperProfile {
    /** The original property array (one width/factor per original vertex, or any length). */
    values: number[];
    /**
     * For every original ring of the feature: the normalized arc position (0..1
     * along that ring) of each entry of `values`. Always has the same length as
     * `values` (mismatched arrays are spread evenly over the ring).
     */
    knotsPerRing: number[][];
}

export interface GeoJSONTaperAnnotation {
    /**
     * For every ring of the clipped piece: the normalized arc position (0..1
     * along the ORIGINAL ring) of every piece vertex. Index-aligned with the
     * piece geometry the bucket receives via `loadGeometry()`.
     */
    pieceKnots: number[][];
    profiles: {[propertyName: string]: TaperProfile};
}

/** A feature carrying a worker-computed taper annotation. */
export type GeoJSONTaperFeature = {_taper?: GeoJSONTaperAnnotation};

interface TaperRingInfo {
    /** Mercator x of every original ring vertex. */
    xs: number[];
    /** Mercator y of every original ring vertex. */
    ys: number[];
    /** Cumulative arc length (mercator units) at every vertex; `cum[0] === 0`. */
    cum: number[];
    /** Total arc length of the ring. */
    length: number;
}

export interface TaperFeatureInfo {
    rings: TaperRingInfo[];
    profiles: {[propertyName: string]: TaperProfile};
}

/**
 * Maps a feature's properties object (which geojson-vt shares by reference with
 * every clipped tile piece of that feature) to its taper info.
 */
export type TaperRegistry = WeakMap<object, TaperFeatureInfo>;

/**
 * Scans the source GeoJSON for line features with numeric-array properties and
 * records their original-geometry taper anchoring. Called when the worker loads
 * the source data, before any tiling happens.
 */
export function buildTaperRegistry(data: GeoJSON.GeoJSON): TaperRegistry {
    const registry: TaperRegistry = new WeakMap();
    if (data.type === 'FeatureCollection') {
        for (const feature of data.features) {
            collectTaperFeatureInfo(feature, registry);
        }
    } else if (data.type === 'Feature') {
        collectTaperFeatureInfo(data, registry);
    }
    return registry;
}

function collectTaperFeatureInfo(feature: GeoJSON.Feature, registry: TaperRegistry): void {
    const geometry = feature.geometry;
    if (!geometry) return;
    let lines: GeoJSON.Position[][];
    if (geometry.type === 'LineString') {
        lines = [geometry.coordinates];
    } else if (geometry.type === 'MultiLineString') {
        lines = geometry.coordinates;
    } else {
        return; // taper properties are line-only
    }

    const properties = feature.properties ?? {};
    const arrayProperties: {[name: string]: number[]} = {};
    for (const name of Object.keys(properties)) {
        const value = (properties as {[key: string]: unknown})[name];
        if (Array.isArray(value) && value.length > 0 && value.every((v) => Number.isFinite(Number(v)))) {
            arrayProperties[name] = value.map(Number);
        }
    }
    if (Object.keys(arrayProperties).length === 0) return;

    const rings: TaperRingInfo[] = [];
    for (const line of lines) {
        if (!line || line.length < 2) return; // invalid/degenerate — skip the whole feature
        const xs: number[] = [];
        const ys: number[] = [];
        const cum: number[] = [0];
        let length = 0;
        for (let i = 0; i < line.length; i++) {
            const x = mercatorXfromLng(line[i][0]);
            const y = mercatorYfromLat(line[i][1]);
            if (i > 0) {
                const dx = x - xs[i - 1];
                const dy = y - ys[i - 1];
                length += Math.sqrt(dx * dx + dy * dy);
                cum.push(length);
            }
            xs.push(x);
            ys.push(y);
        }
        rings.push({xs, ys, cum, length});
    }

    const profiles: {[propertyName: string]: TaperProfile} = {};
    for (const name of Object.keys(arrayProperties)) {
        const values = arrayProperties[name];
        profiles[name] = {values, knotsPerRing: rings.map((ring) => ringKnotsForValues(ring, values))};
    }
    registry.set(properties, {rings, profiles});
}

function ringKnotsForValues(ring: TaperRingInfo, values: number[]): number[] {
    const n = values.length;
    if (n === ring.xs.length) {
        // One value per original vertex: anchor each value exactly at its vertex.
        return ring.cum.map((d) => ring.length > 0 ? d / ring.length : 0);
    }
    // Mismatched length (user error or coordinate simplification): spread the
    // values evenly over the ORIGINAL ring — identical for every tile, unlike the
    // bucket's per-piece fallback.
    const knots: number[] = [];
    for (let i = 0; i < n; i++) {
        knots.push(n > 1 ? i / (n - 1) : 0);
    }
    return knots;
}

/**
 * Computes and attaches the `_taper` annotation to a clipped tile feature. A
 * no-op for features without numeric-array properties (nothing recorded in the
 * registry) and for geometry the taper properties do not support.
 */
export function annotateGeoJSONTileFeature(
    feature: GeoJSONVTInternalTileFeature,
    canonical: CanonicalTileID,
    registry: TaperRegistry
): void {
    const info = registry.get(feature.tags);
    if (!info) return;
    const pieceLines = extractPieceLines(feature);
    // Kein Bail mehr bei pieceLines.length > rings.length: geojson-vt schneidet
    // eine Linie bei JEDEM Verlassen/Wiedereintritt des (gebufferten) Tiles neu —
    // eine gezeichnete Linie, die ein Tile mehrfach kreuzt (Kritzeleien!), liefert
    // MEHRERE Piece-Lines pro Feature. Jede davon wird unten unabhängig auf ihren
    // Ring projiziert (Residual-Match) — das alte Bail hätte die Annotation
    // komplett verworfen und den Bucket in den piece-lokalen Evenly-Spaced-
    // Fallback fallen lassen (Breitenprofil gequetscht in jedes Stück = wandernde
    // dicke Zonen). findMatchingRing ordnet jede Piece-Line ihrem Ring zu.
    if (!pieceLines || pieceLines.length === 0) return;

    const pieceKnots: number[][] = [];
    for (const line of pieceLines) {
        const ring = findMatchingRing(line, info.rings, canonical);
        if (!ring) return;
        pieceKnots.push(projectPieceLineOntoRing(line, ring, canonical));
    }
    (feature as GeoJSONTaperFeature)._taper = {pieceKnots, profiles: info.profiles};
}

/**
 * Finds the profile matching an evaluated data-driven array. Reference equality
 * is tried first: evaluating a `["get", name]` expression returns the feature's
 * property array itself, which is exactly what the annotation captured.
 */
export function matchTaperProfile(annotation: GeoJSONTaperAnnotation, values: ArrayLike<number>): TaperProfile | null {
    for (const name of Object.keys(annotation.profiles)) {
        if (annotation.profiles[name].values === values) return annotation.profiles[name];
    }
    for (const name of Object.keys(annotation.profiles)) {
        const profile = annotation.profiles[name];
        if (profile.values.length === values.length) {
            let equal = true;
            for (let i = 0; i < values.length; i++) {
                if (profile.values[i] !== Number(values[i])) {
                    equal = false;
                    break;
                }
            }
            if (equal) return profile;
        }
    }
    return null;
}

function extractPieceLines(feature: GeoJSONVTInternalTileFeature): number[][][] | null {
    // Tile features use the MVT numeric types: 1 = point, 2 = line, 3 = polygon.
    // Line geometry is an array of lines, each an array of [x, y] pairs.
    if (feature.type !== 2) return null;
    const parts = feature.geometry as unknown as number[][][];
    const lines: number[][][] = [];
    for (const part of parts) {
        if (!Array.isArray(part) || part.length < 2) return null;
        const line: number[][] = [];
        for (const point of part) {
            if (!Array.isArray(point) || point.length < 2 ||
                !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
            line.push([point[0], point[1]]);
        }
        lines.push(line);
    }
    return lines;
}

function flatToPairs(flat: ArrayLike<number>): number[][] | null {
    if (!flat || flat.length < 4 || flat.length % 2 !== 0) return null;
    const line: number[][] = [];
    for (let i = 0; i < flat.length; i += 2) {
        line.push([flat[i], flat[i + 1]]);
    }
    return line;
}

function pieceVertexToWorld(v: number[], canonical: CanonicalTileID): [number, number] {
    const scale = 1 / (EXTENT * (1 << canonical.z));
    return [(canonical.x * EXTENT + v[0]) * scale, (canonical.y * EXTENT + v[1]) * scale];
}

/**
 * Picks the original ring a piece belongs to. Only relevant for multi-ring
 * features where clipping may drop leading rings entirely; pieces lie exactly on
 * their ring, so the projection residual identifies the match.
 */
function findMatchingRing(line: number[][], rings: TaperRingInfo[], canonical: CanonicalTileID): TaperRingInfo | null {
    if (rings.length === 1) return rings[0];
    let best: TaperRingInfo | null = null;
    let bestResidual = Infinity;
    for (const ring of rings) {
        const [wx, wy] = pieceVertexToWorld(line[0], canonical);
        const residual = projectOntoRing(wx, wy, ring, 0).residual;
        if (residual < bestResidual) {
            bestResidual = residual;
            best = ring;
        }
    }
    return best;
}

/**
 * Projects every piece vertex onto the original ring, yielding its normalized
 * arc position along that ring. Piece vertices lie exactly on the ring (they are
 * original vertices or clip points on original segments), so the projection is
 * exact; walking the segments monotonically keeps this linear in the piece size.
 */
function projectPieceLineOntoRing(line: number[][], ring: TaperRingInfo, canonical: CanonicalTileID): number[] {
    const knots = new Array<number>(line.length);
    // Quantisierung des Tile-Grids: geojson-vt rundet auf ganze Extent-Einheiten —
    // eigene Piece-Vertices haben dadurch einen Restresidual ~scale², während
    // ÜBERLAPPENDE Passings (selbstüberkreuzende/gezeichnete Linien, die über
    // dieselbe Stelle führen) EXAKT 0 haben können. Ein globaler Min-Residual-
    // Scan würde daher den falschen Strand wählen und die Breitenprofile
    // wandern mit jedem Frame. Fix in zwei Teilen:
    //
    // 1) Das Piece folgt MONOTON dem Ring — der erwartete Arc von Vertex i ist
    //    prevArc + Chord(prev, i) (exakt für unvereinfachte Pieces) — der Scan
    //    läuft nur in einem kleinen Quantisierungsfenster um diese Erwartung.
    // 2) Der ANKER (Vertex 0) kann bei Selbstüberschneidungen nicht per Residual
    //    entschieden werden (mehrere Stränge mit Residual ~0) — daher Joint-Fit:
    //    jeder Near-Tie-Kandidat wandert mit den Folgvertices, der beste Score
    //    gewinnt; Tie → der LATERE Arc (der neue Pass — beim Zeichnen fährt die
    //    Linie über alte Striche).
    const quant = 1 / (EXTENT * (1 << canonical.z));
    const world = line.map((v) => pieceVertexToWorld(v, canonical));

    const walkFrom = (seg: number, arc0: number, from: number): {arcs: number[]; score: number} | null => {
        let searchFrom = seg;
        let prevArc = arc0;
        let prevX = world[from - 1][0];
        let prevY = world[from - 1][1];
        const arcs: number[] = [];
        let score = 0;
        for (let i = from; i < line.length; i++) {
            const [wx, wy] = world[i];
            const chord = Math.hypot(wx - prevX, wy - prevY);
            const hit = projectOntoRingWindowed(wx, wy, ring, searchFrom, prevArc + chord, quant * 8);
            if (!hit) return null; // Fenster verfehlt → Kandidat invalide
            score += hit.residual;
            arcs.push(hit.arc);
            searchFrom = hit.segment;
            prevArc = hit.arc;
            prevX = wx;
            prevY = wy;
        }
        return {arcs, score};
    };

    const candidates = projectOntoRingCandidates(world[0][0], world[0][1], ring, 0, quant * quant * 4);
    let chosen = candidates[0];
    if (candidates.length > 1 && line.length > 1) {
        let bestScore = Infinity;
        for (const c of candidates) {
            const w = walkFrom(c.segment, c.arc, 1);
            const score = w ? w.score + c.residual : Infinity;
            if (score < bestScore || (score === bestScore && c.arc > chosen.arc)) {
                bestScore = score;
                chosen = c;
            }
        }
    }

    let searchFrom = chosen.segment;
    let prevArc = chosen.arc;
    let prevX = world[0][0];
    let prevY = world[0][1];
    knots[0] = ring.length > 0 ? Math.min(Math.max(chosen.arc / ring.length, 0), 1) : 0;
    for (let i = 1; i < line.length; i++) {
        const [wx, wy] = world[i];
        const chord = Math.hypot(wx - prevX, wy - prevY);
        const expected = prevArc + chord;
        let hit = projectOntoRingWindowed(wx, wy, ring, searchFrom, expected, quant * 8);
        if (!hit) {
            // Vereinfachte/ungewöhnliche Pieces (Arc-Überschuss > Fenster):
            // altes Verhalten als sicherer Fallback.
            hit = projectOntoRing(wx, wy, ring, searchFrom);
        }
        searchFrom = hit.segment;
        prevArc = hit.arc;
        prevX = wx;
        prevY = wy;
        knots[i] = ring.length > 0 ? Math.min(Math.max(hit.arc / ring.length, 0), 1) : 0;
        if (knots[i] < knots[i - 1]) {
            // Guard against float noise: the profile interpolator requires sorted knots.
            knots[i] = knots[i - 1];
        }
    }
    return knots;
}

/**
 * Globale Projektion (alter Scan), liefert ALLE Near-Tie-Kandidaten
 * (residual ≤ best + thresh) aufsteigend nach Arc — für die Anker-Disambiguierung
 * bei selbstüberlappenden Linien, wo der Residual allein die Stränge nicht
 * unterscheiden kann.
 */
function projectOntoRingCandidates(x: number, y: number, ring: TaperRingInfo, searchFrom: number, thresh: number): {arc: number; residual: number; segment: number}[] {
    const xs = ring.xs;
    const ys = ring.ys;
    const cum = ring.cum;
    let best = Infinity;
    const cands: {arc: number; residual: number; segment: number}[] = [];
    for (let j = Math.max(0, searchFrom); j < xs.length - 1; j++) {
        const ax = xs[j];
        const ay = ys[j];
        const dx = xs[j + 1] - ax;
        const dy = ys[j + 1] - ay;
        const l2 = dx * dx + dy * dy;
        // Snap across the antimeridian: for wrapped geometry the piece vertex and
        // the ring may be a whole world apart in x.
        const xHere = x + (l2 > 0 ? Math.round(ax - x) : 0);
        let t = l2 > 0 ? ((xHere - ax) * dx + (y - ay) * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = ax + dx * t;
        const py = ay + dy * t;
        const residual = (xHere - px) * (xHere - px) + (y - py) * (y - py);
        if (residual > best + thresh) continue;
        if (residual < best) best = residual;
        cands.push({arc: cum[j] + (cum[j + 1] - cum[j]) * t, residual, segment: j});
        for (let k = cands.length - 1; k >= 0; k--) {
            if (cands[k].residual > best + thresh) cands.splice(k, 1);
        }
        if (cands.length > 8) cands.shift();
    }
    const kept = cands.filter((c) => c.residual <= best + thresh);
    kept.sort((a, b) => a.arc - b.arc);
    return kept;
}
/**
 * Wie `projectOntoRing`, aber der Scan wird auf ein enges Arc-Fenster um
 * `expected` (± tol) begrenzt. Begründung siehe projectPieceLineOntoRing:
 * bei selbstüberlappenden Linien gewinnt sonst ein SPÄTERER (oder früherer)
 * Ring-Strang mit Residual 0 gegen den eigenen, quantisierten Vertex — die
 * Breiten wandern auf den falschen Bogenabschnitt. Liefert `null`, wenn im
 * Fenster kein Segment liegt (Aufrufer fällt dann auf den globalen Scan
 * zurück — identisch zum Verhalten vor diesem Fix).
 */
function projectOntoRingWindowed(x: number, y: number, ring: TaperRingInfo, searchFrom: number, expected: number, tol: number): {arc: number; residual: number; segment: number} | null {
    const xs = ring.xs;
    const ys = ring.ys;
    const cum = ring.cum;
    const lo = expected - tol;
    const hi = expected + tol;
    let best: {arc: number; residual: number; segment: number} | null = null;
    for (let j = Math.max(0, searchFrom); j < xs.length - 1; j++) {
        if (cum[j] > hi) break; // Segmente sind arc-sortiert — Fenster vorbei
        const arcEnd = cum[j + 1];
        const ax = xs[j];
        const ay = ys[j];
        const dx = xs[j + 1] - ax;
        const dy = ys[j + 1] - ay;
        const l2 = dx * dx + dy * dy;
        const xHere = x + (l2 > 0 ? Math.round(ax - x) : 0);
        let t = l2 > 0 ? ((xHere - ax) * dx + (y - ay) * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = ax + dx * t;
        const py = ay + dy * t;
        const residual = (xHere - px) * (xHere - px) + (y - py) * (y - py);
        if (arcEnd < lo) continue; // Segment endet vor dem Fenster
        if (!best || residual < best.residual) {
            const arc = cum[j] + (cum[j + 1] - cum[j]) * t;
            // Nur Kandidaten, deren Arc im Fenster liegt (der Fußpunkt kann
            // hinter dem Segmentende klemmen — dessen Arc zählt).
            if (arc >= lo && arc <= hi && (!best || residual < best.residual)) {
                best = {arc, residual, segment: j};
            }
            if (residual < RESIDUAL_EPSILON) break; // exakter Treffer im Fenster
        }
    }
    return best;
}

const RESIDUAL_EPSILON = 1e-18; // (mercator units)^2, well below any visible scale
function projectOntoRing(x: number, y: number, ring: TaperRingInfo, searchFrom: number): {arc: number; residual: number; segment: number} {
    const xs = ring.xs;
    const ys = ring.ys;
    const cum = ring.cum;
    let best = {arc: 0, residual: Infinity, segment: Math.max(0, searchFrom)};
    for (let j = Math.max(0, searchFrom); j < xs.length - 1; j++) {
        const ax = xs[j];
        const ay = ys[j];
        const dx = xs[j + 1] - ax;
        const dy = ys[j + 1] - ay;
        const l2 = dx * dx + dy * dy;
        // Snap across the antimeridian: for wrapped geometry the piece vertex and
        // the ring may be a whole world apart in x.
        const xHere = x + (l2 > 0 ? Math.round(ax - x) : 0);
        let t = l2 > 0 ? ((xHere - ax) * dx + (y - ay) * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = ax + dx * t;
        const py = ay + dy * t;
        const residual = (xHere - px) * (xHere - px) + (y - py) * (y - py);
        if (residual < best.residual) {
            best = {arc: cum[j] + (cum[j + 1] - cum[j]) * t, residual, segment: j};
        }
        if (residual < RESIDUAL_EPSILON) break;
    }
    return best;
}

/**
 * Expands per-vertex taper knots from the tile piece as delivered by the worker
 * (`rawVertices`/`knots`, index-aligned) onto the possibly subdivided vertex list
 * the bucket emits. Subdivision only inserts points ON existing segments, so an
 * inserted vertex's knot is a linear blend of its segment's endpoint knots —
 * exactly what the shader's varying interpolation does between them anyway.
 *
 * Returns `null` when the alignment cannot be recovered (the caller then falls
 * back to the piece-local knots).
 */
export function expandTaperKnots(rawVertices: Point[], vertices: Point[], knots: number[]): number[] | null {
    if (vertices.length === rawVertices.length) return knots.slice();
    const expanded = new Array<number>(vertices.length);
    let rawIndex = 0;
    for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i];
        if (rawIndex < rawVertices.length && v.equals(rawVertices[rawIndex])) {
            expanded[i] = knots[rawIndex];
            rawIndex++;
        } else if (rawIndex > 0 && rawIndex < rawVertices.length) {
            const a = rawVertices[rawIndex - 1];
            const b = rawVertices[rawIndex];
            const total = a.dist(b);
            const f = total > 0 ? a.dist(v) / total : 0;
            expanded[i] = knots[rawIndex - 1] + (knots[rawIndex] - knots[rawIndex - 1]) * Math.min(Math.max(f, 0), 1);
        } else {
            return null; // unexpected alignment (e.g. ring closing) — fall back
        }
    }
    return rawIndex === rawVertices.length ? expanded : null;
}
