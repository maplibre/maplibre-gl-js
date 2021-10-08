# Build Scripts
This folder holds common build scripts accessed via the various `npm run` commands.

## Bundeling all the code

The bundeling process can be split into several steps:

`npx run tsc`
This command will transpile all the typescript files into javascript files and place them in the `rollup/build` folder.

`npm run build-glsl`
This command will copy all the shader files to the build output and convert the shaders into strings that can be imported to javascript.

`npm run build-css`
This command will compile the css code and create the css file.

`npm run build-prod` or `npm run build-prod-min` or `npm run build-dev`
These commands will use rollup to bundle the code. This is where the magic happens and uses some files in this folder.

`banner.js` is used to create a banner at the beginning of the output file

`rollup_plugins.js` is used to define common plugins for rollup configurations

`rollup_plugin_minify_style_spec.js` is used to specify the plugin used in style spec bundeling

In the `rollup` folder there are some files that are used as linking files as they link to other files for rollup to pick when bundling.
Rollup also has a configuration in the `package.json` file to signal which files it needs to replace when bundling for the browser, this is where `web_worker_replacement.js` is used - as it replaces the node mocking of web worker that is present in the source code.

Rollup is generating 3 files throughout the process of bundling: 

`index.js` a file containing all the code that will run in the main thread. 

`shared.js` a file containing all the code shared between the main and worker code.

`worker.js` a file containing all the code the will run in the worker threads.

These 3 files are then referenced and used by the `bundle_prelude.js` file. It allows loading the web wroker code automatically in web workers without any extra effort from someone who would like to use the library, i.e. it simply works.

### check-bundle-size.js
This file is used by CI to make sure the bundle size is kept constant

<hr>

### `npm run codegen`
The `codegen` command runs the following three scripts, to update the corresponding code files based on the `v8.json` style source, and other data files. Contributers should run this command manually when the underlying style data is modified. The generated code files are then commited to the repo.
#### generate-struct-arrays.ts		
Generates `data/array_types.ts`, which consists of:
 - `StructArrayLayout_*` subclasses, one for each underlying memory layout
 - Named exports mapping each conceptual array type (e.g., `CircleLayoutArray`) to its corresponding `StructArrayLayout` class
 - Specific named `StructArray` subclasses, when type-specific struct accessors are needed (e.g., `CollisionBoxArray`)
#### generate-style-code.ts			
Generates the various `style/style_layer/[layer type]_style_layer_properties.ts` code files based on the content of `v8.json`. These files provide the type signatures for the paint and layout properties for each type of style layer.
#### generate-style-spec.ts			
Generates `style-spec/types.ts` based on the content of `v8.json`. This provides the type signatures for a style specification (sources, layers, etc.).
<hr>

### Generate Release Nodes
The following files are being used to generate release notes:

`release-notes.js` Used to generate release notes when releasing a new version

`release-notes.md.ejs` Used for the generation as a template file