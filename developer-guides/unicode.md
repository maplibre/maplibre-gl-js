## Unicode

MapLibre GL&nbsp;JS supports rendering Unicode text with the following caveats:

* A single codepoint is incorrectly assumed to correspond to a single glyph in any font, and vice versa.
* Complex text shaping is not yet implemented.
* Right-to-left writing systems, such as Arabic and Hebrew, require a separate [mapbox-gl-rtl-text](https://github.com/mapbox/mapbox-gl-rtl-text/) plugin.

### Updating compliance with the Unicode Standard

We use various properties from the Unicode Character Database to determine the behavior of a character in a label, such as whether it stays upright in vertical text. When a new major version of the Unicode Standard is released, follow these steps to ensure up-to-date text layout behavior:

1. Note the version of [the most recent Unicode Standard](https://www.unicode.org/versions/enumeratedversions.html).
2. Find the [Unicode package](https://www.npmjs.com/org/unicode) on NPM that corresponds to the version from step 1. Note that a separate package is published for each version of the standard, and each package has its own versions. Look for the package whose **name** contains the version from step 1, regardless of the version of any package according to NPM.
3. In package.json, update the `devDependencies` section to refer to `@unicode/unicode-x.y.z`, where _x.y.z_ is the version from step 1.
4. In build/generate-unicode-data.ts, update the `unicodeVersion` constant to match the version from step 1.
5. In build/generate-unicode-data.ts, update the `hasUprightVerticalOrientation()` and `hasNeutralVerticalOrientation()` functions to reflect the scripts, blocks, and individual characters enumerated in the latest VerticalOrientation.txt file of the Unicode Character Database. To determine any necessary changes, open `https://www.unicode.org/Public/x.y.z/ucd/VerticalOrientation.txt`, where _x.y.z_ is the previous value of `unicodeVersion` in step 4, and diff that file against [the latest file](https://www.unicode.org/Public/UCD/latest/ucd/VerticalOrientation.txt). If any new codepoint range is listed as `U` or `Tu`, it may need to be added to one of these functions, depending on whether it must be written upright or is more neutral.
6. Run `npm run generate-unicode-data` and verify that unit tests and render tests all pass.
