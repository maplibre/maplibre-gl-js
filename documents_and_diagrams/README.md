This folder contains developer documentation for MapLibre GL JS. Put any diagrams you reference in the [diagrams](./diagrams) folder. If you use PlantUML, put the source code in `diagrams/*.plantuml` files and run `npm run build-diagrams` to generate SVG versions of them. There is also a [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) for previewing them while you edit.

## Writing API Documentation

API documentation is written as [TSDoc comments](https://tsdoc.org/) and processed with [typedoc](https://typedoc.org/)

* Classes, methods, events, and anything else in the public interface must be documented with TSDoc comments. Everything outside of the public interface may be documented and must be tagged as `@private`.
* Use `@group` to indicate to which group to send a specific class, these groups are defined in `typedoc.json` file and are important for the API documentation intro file.
* Text within TSDoc comments may use markdown formatting. Code identifiers must be surrounded by \`backticks\`.
* Documentation must be written in grammatically correct sentences ending with periods.
* Documentation must specify measurement units when applicable.
* Documentation descriptions must contain more information than what is obvious from the identifier and JSDoc metadata.
* Class descriptions should describe what the class *is*, or what its instances *are*. They do not document the constructor, but the class. They should begin with either a complete sentence or a phrase that would complete a sentence beginning with "A `T` is..." or "The `T` class is..." Examples: "Lists are ordered indexed dense collections." "A class used for asynchronous computations."
* Function descriptions should begin with a third person singular present tense verb, as if completing a sentence beginning with "This function..." If the primary purpose of the function is to return a value, the description should begin with "Returns..." Examples: "Returns the layer with the specified id." "Sets the map's center point."
* `@param`, `@property`, and `@returns` descriptions should be capitalized and end with a period. They should begin as if completing a sentence beginning with "This is..." or "This..."
* Functions that do not return a value (return `undefined`), should not have a `@returns` annotation.
* Member descriptions should document what a member represents or gets and sets. They should also indicate whether the member is read-only.
* Event descriptions should begin with "Fired when..." and so should describe when the event fires. Event entries should clearly document any data passed to the handler, with a link to MDN documentation of native Event objects when applicable.

## Writing Examples

Examples are written as regular html files in `test/examples`. Each example should have a title and a og:description.
* `title`: A short title for the example in **sentence case** as a **verb phrase**.
* `description`: A one sentence description of the example in plain text. This description will appear alongside a thumbnail and title on the examples page.

Every example **must** have an accompanying image.

1. Run `npm run generate-image <example-file-name>`. The script will take a screenshot of the map in the example and save it to `docs/assests/examples/`. Commit the image.

For some examples, `npm run generate-image` does not generate an ideal image. In these cases, you can interact with the map after running the command before the screenshot is taken, or take a screenshot yourself by running the site locally with `npm start`, take a screenshot and save it in the `docs/assests/examples/` folder.

To regenerate all images, run `npm run generate-image`. Note that this doesn't support interaction and examples that require manual interaction (e.g. popups) will need to be manually redone afterward. This feature is experimental and may crash before sucessfully generating all examples.

## Running the Documentation Server Locally

To start a documentation server locally, run:

```bash
docker run --rm -it -p 8000:8000 -v ${PWD}:/docs squidfunk/mkdocs-material
```

The command will print the URL you can use to view the documentation.

The examples section of the locally run documentation will use the GL JS version released that has the same version as the in the package.json.

## Committing and Publishing Documentation

When a new GL JS release goes out the documentation will be released with it.

To update or add a new example, PR the relevant changes to this repo. The example will be live once a new version will be released. If this example uses a version of GL JS that isn't yet released, the PR should not be merged until the release is out.

## How does all this work?

It uses 3 tools:
1. typedoc cli
2. mkdocs material
3. `generate-docs.ts` script

The typedoc cli is used to generate markdown files of the API from the TSDocs comments and places the output in API folder of the docs.
The `generate-docs.ts` does some manipulation of this API output and also uses the examples html files from the test folder to generate markdown of the examples index file and all the examples markdown files.
Other markdown from the docs folder are used as is.
mkdocs is used to build the documentation site for production and server it in debug. It has a live reload and the markdown files can be looked at in order to understand why things are shown as they do.
