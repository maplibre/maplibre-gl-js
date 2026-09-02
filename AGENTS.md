# Agent conventions

## Comments

Explain code in **TSDoc comments on the declaration**, not in comments inside the body.

A reader meets a function through its signature and its doc block, and so does the generated API
documentation. A comment buried three lines into a method is invisible to both. Anything worth
saying about *what* a function does, *why* it exists, or what a caller has to know belongs above it:

```ts
/**
 * Returns the offsets, counted in UTF-16 code units, at which a word begins.
 *
 * Leaving this to the segmenter rather than to a table of punctuation brings word wrapping to
 * writing systems that do not put spaces between words, because the browser has the dictionaries.
 */
export function wordBoundaries(text: string): Set<number> {
```

The same goes for a type, a field, or a constant: document it where it is declared.

```ts
type Entry = {
    /** One TinySDF per `font-faces` file this stack draws with, keyed by the file's CSS family. */
    fontFaceTinySDFs?: {[family: string]: Promise<TinySDF>};
};
```

An in-body comment is a last resort, for a single step whose reason cannot be seen from the code and
does not generalise to the whole function — a workaround for a specific browser bug, say. If you
find yourself writing several, the explanation belongs in the doc block, or the body wants splitting
into named functions that can each carry one.

Do not restate the code (`// increment i`), and do not narrate the change you are making
(`// now uses the segmenter`) — the diff already says that, and it stops being true immediately.

**No file-level preamble.** A comment belongs to the thing below it, not to the file. A block at the
top of a module explaining the subject in general has nothing to attach to: it is not in the API
docs, nobody scrolls back up to it from the function they are reading, and it drifts once the file
gains a function the preamble never anticipated.

Everything such a preamble wants to say belongs to one of the declarations underneath it. Why a
grapheme cluster is the unit of layout belongs on the function that produces them. What
`Intl.Segmenter` does belongs on the constant that holds it. Split it up and put each part where a
reader meets the code it explains — if a part fits nowhere, it was background rather than
documentation, and the PR description is where it goes.

## Nesting

**Keep indentation shallow.** Every level a reader descends is another condition they have to hold
in their head to know whether the line in front of them runs at all. Three levels inside a function
is usually the point to stop and restructure.

Two moves cover most of it. **Hoist what does not vary** — a condition that depends on none of the
loop variables is computed once, above the loop, under a name:

```ts
const needsVerticalForms = (textAlongLine || allowVerticalPlacement) && doesAllowVerticalWritingMode;

for (const grapheme of toGraphemes(text)) {
```

**Turn a wrapping `if` into a guard.** `if (!ready) continue;` in a loop, or an early `return` in a
function, puts the exceptional case out of the way and lets the work that matters sit at the
outer level instead of inside a block:

```ts
for (const char of grapheme) {
    stack[char] = true;
    if (!needsVerticalForms) continue;

    const verticalChar = verticalizedCharacterMap[char];
    if (verticalChar) stack[verticalChar] = true;
}
```

Extracting a named function is the third move, and the right one when a block has grown its own
subject rather than merely its own indentation.

Flattening must not change behaviour. Splitting one pass into two reorders the work, which is fine
for a pure computation and not fine where something downstream can observe the order — insertion
order into an object used as a set, for one. If you cannot see that it is safe, leave it nested.

## Types

**Spell a map as `Record<K, V>`, not as an index signature.** `Record<string, Promise<TinySDF>>`
reads as one thing; `{[family: string]: Promise<TinySDF>}` makes the reader parse a type literal to
find out it is a map, and nests badly — a map of maps is four lines as an index signature and one as
a `Record`.

```ts
glyphs: Record<string, StyleGlyph | null>;
export type GetGlyphsResponse = Record<string, Record<string, StyleGlyph>>;
```

Keep an index signature only where it carries something a `Record` cannot: a named key that
documents itself in a type with other members, or a numeric key alongside declared properties.

## Changelog

**One line per entry.** Say what changed and what it means for someone using the library, then stop.
The changelog is skimmed, not read, and a paragraph buries the one clause a reader was looking for.

```md
- Support `font-faces` style spec property and improve text rendering for complex script languages ([#6637](https://github.com/maplibre/maplibre-gl-js/issues/6637))
```

Resist explaining the mechanism, listing every affected script, or narrating the design decision —
that belongs in the PR description and the code's own doc comments. If a change genuinely needs two
sentences to be understood, it is usually two entries, or one entry and a link.

## Tests

**Declare test helpers with `function`, not with a lambda assigned to a `const`.** A hoisted,
named function reads as part of the file's vocabulary and can be defined below the tests that use it;
`const helper = () => {...}` has to come first and puts the name and the arguments further apart.

```ts
function createGlyphManager(remoteEnabled: boolean, font?: string | false): GlyphManager {
```

**Cover the code, then stop.** Every branch worth a name deserves a test, but two tests that differ
only in an input value are one test — consolidate them and pick the input that says the most. What
you are guarding against is a suite where a single change reddens fifteen tests that were all making
the same point.

**Keep tests DAMP rather than DRY.** A test should read top to bottom without the reader having to go
and find what a shared fixture contains. Repeating three lines of setup in each test is cheaper for
the reader than one clever builder that every test calls with different arguments. Factor out only
what is genuinely incidental — a stub of an unrelated collaborator, say — and leave the parts the
test is actually about inline.

**Test through the public API.** Do not reach for `_`-prefixed fields or methods. If a behaviour can
only be observed through internals, that is a sign the class is missing an accessor or the test is
asserting on the wrong thing — assert on what a caller can see.

**Fake the network with a fake server, not by mocking the request functions.** `nise`'s
`fakeServer` is what the rest of the suite uses. Mocking `getArrayBuffer` or `getJSON` skips the
request-building the code under test does — the URL it composed, the headers it set, the
`transformRequest` it went through — which is usually the part worth asserting on.

```ts
let server: FakeServer;

beforeEach(() => {
    global.fetch = null;   // sends the request down the XHR path the fake server intercepts
    server = fakeServer.create();
});

afterEach(() => {
    server.restore();
});
```

**Stub collaborators, never the unit under test.** Replacing a method on the class you are testing
means the test no longer exercises the thing it names. Replace what that class *uses* — its
dependencies, the network, the clock — and let the unit itself run.
