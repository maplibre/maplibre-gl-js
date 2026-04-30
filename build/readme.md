# Build Scripts

This folder holds common build scripts accessed via the various `npm run` commands.
Codegen is executed when calling `npm install` in order to generate all artifacts needed for the build to pass

## Bundling all the code

The bundling process can be split into several steps:

`npm run build-css`
This command will compile the css code and create the css file.

`npm run build-prod` and `npm run build-dev`
These commands will use [rolldown](https://rolldown.rs/) to bundle the code as ES modules. The output is two files:

- `dist/maplibre-gl.mjs` (main bundle, entry: `src/index.ts`)
- `dist/maplibre-gl-worker.mjs` (worker bundle, entry: `src/source/worker.ts`)

The main bundle creates the worker via `new Worker(url, {type: 'module'})`, where the URL is whatever the consumer passes to `setWorkerUrl()`.

`banner.ts` is used to create a banner at the beginning of the output file

`rolldown_plugins.ts` is used to define common plugins for rolldown configurations (also reused by the benchmarks). Rolldown ships with built-in TypeScript, JSON, CommonJS interop, node resolution and minification, so the previous `@rollup/plugin-*` set is no longer needed — only the maplibre-specific transforms (e.g. the jsonlint `_token_stack:` patch) and bundle-stats visualizer are kept here.

<hr>

### `npm run codegen`

The `codegen` command runs the following three scripts, to update the corresponding code files based on the `v8.json` style source, and other data files. Contributors should run this command manually when the underlying style data is modified. The generated code files are then committed to the repo.

#### generate-struct-arrays.ts

Generates `data/array_types.ts`, which consists of:

 - `StructArrayLayout_*` subclasses, one for each underlying memory layout
 - Named exports mapping each conceptual array type (e.g., `CircleLayoutArray`) to its corresponding `StructArrayLayout` class
 - Specific named `StructArray` subclasses, when type-specific struct accessors are needed (e.g., `CollisionBoxArray`)

#### generate-style-code.ts

Generates the various `style/style_layer/[layer type]_style_layer_properties.ts` code files based on the content of `v8.json`. These files provide the type signatures for the paint and layout properties for each type of style layer.

<hr>
