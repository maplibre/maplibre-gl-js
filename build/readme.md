# Build Scripts
This folder holds common build scripts accessed via the various `npm run` commands.

### banner.js				
### check-bundle-size.js			
### diff-tarball.js				
### generate-release-list.js	
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

### print-release-url.js			
### release-notes.js			
### release-notes.md.ejs
### rollup_plugin_minify_style_spec.js
### rollup_plugins.js
### web_worker_replacement.js
