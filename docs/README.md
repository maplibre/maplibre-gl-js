# MapLibre GL JS Documentation

This directory contains the source for the [MapLibre GL JS docs](https://maplibre.org/maplibre-gl-js/docs/) hosted on the MapLibre site.

Besides this README, each other `.md` file in this directory corresponds to a site page. Each is converted into an `.html` file by [MkDocs](https://www.mkdocs.org/).

## Running the Documentation Server Locally

To start a documentation server locally, first, ensure that you have an up-to-date build:

```bash
npm run build-prod
npm run build-css
```

Then generate the docs files:

```bash
npm run generate-docs
```

Finally, run:

```bash
npm run start-docs
```

Navigate to [http://0.0.0.0:8000/](http://0.0.0.0:8000/) to view the docs. After making changes, run `npm run generate-docs` again to apply them. Some tile service providers of the docs example pages such as MapTiler or Stadia Maps might only send you tiles if the host is localhost. In that case, try http://localhost:8000.

The examples section of the locally run documentation will use the GL JS version released that has the same version as the in the package.json.

## Writing API Documentation

API documentation is written as [TSDoc comments](https://tsdoc.org/) and processed with [TypeDoc](https://typedoc.org/)

* Classes, methods, events, and anything else in the public interface must be documented with TSDoc comments, and the typescript `public` can be used to indicate that it's public API.
* The `@internal` tag can be used to indicate that a class, method, or event is not part of the public interface and should not be documented.
* Methods implementing an interface need an `{@inheritDoc reference}` in order to inherit the documentation from the interface.
* Use `@group` to indicate to which group to send a specific class, these groups are defined in `typedoc.json` file and are important for the API documentation intro file.
* Text within TSDoc comments may use markdown formatting. Code identifiers must be surrounded by \`backticks\`.
* Documentation must be written in grammatically correct sentences ending with periods.
* Documentation must specify measurement units when applicable.
* Documentation descriptions must contain more information than what is obvious from the identifier and JSDoc metadata.
* Class descriptions should describe what the class *is*, or what its instances *are*. They do not document the constructor, but the class. They should begin with either a complete sentence or a phrase that would complete a sentence beginning with "A `T` is..." or "The `T` class is..." Examples: "Lists are ordered indexed dense collections." "A class used for asynchronous computations."
* Function descriptions should begin with a third person singular present tense verb, as if completing a sentence beginning with "This function..." If the primary purpose of the function is to return a value, the description should begin with "Returns..." Examples: "Returns the layer with the specified id." "Sets the map's center point."
* `@param`, and `@returns` descriptions should be capitalized and end with a period. They should begin as if completing a sentence beginning with "This is..." or "This..."
* Functions that do not return a value (return `void`), should not have a `@returns` annotation.
* Member descriptions should document what a member represents or gets and sets. They should also indicate whether the member is read-only.
* Event descriptions should begin with "Fired when..." and so should describe when the event fires. Event entries should clearly document any data passed to the handler, with a link to MDN documentation of native Event objects when applicable.
* Lists need an empty line above to be formatted as HTML list.
* All documentation is spellchecked with [cSpell](https://cspell.org/) as part of the linting process via a [GitHub Action](https://github.com/marketplace/actions/cspell-action). We recommend using the VS Code extension to catch any misspellings before making your PR. You can run `npx cspell "docs/**/*.html" "docs/**/*.md"` from the CLI to check all files. If there's a false-postitive (a technical term which isn't in the default dictionary) you can add it to the `.spell.json` file's words array in the root.

## Writing Examples

Examples are written as regular HTML files in `test/examples`. Each example should have a title and a og:description.

* `title`: A short title for the example in **sentence case** as a **verb phrase**.
* `description`: A one sentence description of the example in plain text. This description will appear alongside a thumbnail and title on the examples page.

When you create a new example, you **must** make an accompanying image.

1. Run `npm run generate-images <example-file-name>`. The script will take a screenshot of the map in the example and save it to `docs/assets/examples/`.
2. Optimize the image with [compresspng](https://compresspng.com/) to reduce the file size. (Optional)
3. Commit the image.

For some examples, `npm run generate-images` does not generate an ideal image. In these cases, you can interact with the map after running the command before the screenshot is taken, or take a screenshot yourself by running the site locally with `npm start`, take a screenshot and save it in the `docs/assets/examples/` folder.

To regenerate all images, run `npm run generate-images`. Note that this doesn't support interaction and examples that require manual interaction (e.g. popups) will need to be manually redone afterward. This feature is experimental and may crash before successfully generating all examples.

## Committing and Publishing Documentation

When a new MapLibre GL JS release goes out the documentation will be released with it.

To update or add a new example, PR the relevant changes to this repo. The example will be live once a new version will be released. If this example uses a version of GL JS that isn't yet released, the PR should not be merged until the release is out.

## How does all this work?

It uses 3 tools:

1. [TypeDoc](https://typedoc.org/) cli
2. [MkDocs material](https://squidfunk.github.io/mkdocs-material/)
3. `generate-docs.ts` script

The TypeDoc CLI convert is used to generate markdown files of the API from the TSDoc comments and places the output in API folder of the docs.
The `generate-docs.ts` does some manipulation of this API output and also uses the examples html files from the test folder to generate markdown of the examples index file and all the examples markdown files.
Other markdown from the docs folder are used as is.
[MkDocs](https://www.mkdocs.org/) is used to build the documentation site for production and server it in debug. It has a live reload and the markdown files can be looked at in order to understand why things are shown as they do.
