Hi, and thanks in advance for contributing to MapLibre GL. Here's how we work. Please follow these conventions when submitting an issue or pull request.

## Do not violate Mapbox copyright!
In December 2020 Mapbox decided to publish future versions of mapbox-gl-js under a proprietary license. **You are not allowed to backport code from Mapbox projects which has been contributed under this new license**. Unauthorized backports are the biggest threat to the MapLibre project. If you are unsure about this issue, [please ask](https://github.com/maplibre/maplibre-gl-js/discussions)!


## Preparing your Development Environment

### OSX

Install the Xcode Command Line Tools Package
```bash
xcode-select --install
```

Install [node.js](https://nodejs.org/) version ^16
```bash
brew install node
```

Clone the repository
```bash
git clone git@github.com:maplibre/maplibre-gl-js.git
```

Install dependencies for node_canvas (https://github.com/Automattic/node-canvas)
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

Install node module dependencies
```bash
cd maplibre-gl-js &&
npm install
```

**Apple silicon**
If you have one of the newer arm64 machines, you might find that canvas.node or webgl.node can't be found for your architecture. In that case go to node_modules/canvas and node_modules/gl and run:

```
npm install --build-from-source
```

### Linux

Install [git](https://git-scm.com/), [GNU Make](http://www.gnu.org/software/make/), and libglew-dev
```bash
sudo apt-get update &&
sudo apt-get install build-essential git libglew-dev libxi-dev default-jre default-jdk
```

If prebuilt binaries for canvas and gl aren’t available, you will also need:

```bash
sudo apt-get install python-is-python3 pkg-config libpixman-1-dev libcairo2-dev libpango1.0-dev libgif-dev
```

Install [nvm](https://github.com/nvm-sh/nvm)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
```

Install [Node.js](https://nodejs.org/) ^16
```
nvm install 16
```

Clone the repository
```bash
git clone git@github.com:maplibre/maplibre-gl-js.git
```

Install node module dependencies
```bash
cd maplibre-gl-js &&
npm install
```

### Windows

Consider using WSL and follow the above Linux guide or follow the next steps

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/) (version ^16), [npm and node-gyp](https://github.com/Microsoft/nodejs-guidelines/blob/master/windows-environment.md#compiling-native-addon-modules).

Clone the repository
```bash
git clone git@github.com:maplibre/maplibre-gl-js.git
```


Install node module dependencies
```bash
cd maplibre-gl-js
npm install
```

Install headless-gl dependencies https://github.com/stackgl/headless-gl#windows
```
copy node_modules/headless-gl/deps/windows/dll/x64/*.dll c:\windows\system32
```

## Serving the Debug Page

Start the debug server

```bash
npm run start-debug
```

Open the debug page at [http://localhost:9966/test/debug-pages](http://localhost:9966/test/debug-pages)

## Creating a Standalone Build

A standalone build allows you to turn the contents of this repository into `maplibre-gl.js` and `maplibre-gl.css` files that can be included on an html page.

To create a standalone build, run
```bash
npm run build-prod
npm run build-css
```

Once those commands finish, you will have a standalone build at `dist/maplibre-gl.js` and `dist/maplibre-gl.css`

## Writing & Running Tests

See [`test/README.md`](./test/README.md).

## Writing & Running Benchmarks

See [`test/bench/README.md`](./test/bench/README.md).

## Code Conventions

* We use [`error` events](https://www.mapbox.com/mapbox-gl-js/api/#Map.event:error) to report user errors.
* We use the latest feature that the TypeScript language has to offer including, but not limited to:
  * `let`/`const`
  * `for...of` loops (for arraylike iteration only, i.e. what is supported by [Bublé's `dangerousForOf` transform](https://buble.surge.sh/guide/#dangerous-transforms))
  * Arrow functions
  * Classes
  * Template strings
  * Computed and shorthand object properties
  * Default parameters
  * Rest parameters
  * Destructuring
  * Modules

The conventions for module exports are:

* No exported "namespace objects" -- modules should export either classes or functions, with an occasional exception as needed for stubbing.
* If a module exports something with the same name as the file name (modulo case), it should be the default export.
* Anything else should be a named export.

To keep code uniformly styled and avoid common mistakes, you can check some files with the following scripts:

```bash
npm run lint
npm run lint-css
```

Additionally, if you're using VSCode, the "Format Document" action or "Editor: Format on Save" should enforce the js, ts, and css formatting for this project by default.

### Version Control Conventions

Here is a recommended way to get setup:
1. Fork this project
2. Clone your new fork, `git clone git@github.com:GithubUser/maplibre-gl-js.git`
3. `cd maplibre-gl-js`
4. Add the MapLibre repository as an upstream repository: `git remote add upstream git@github.com:maplibre/maplibre-gl-js.git`
5. Create a new branch `git checkout -b your-branch` for your contribution
6. Write code, open a PR from your branch when you're ready
7. If you need to rebase your fork's PR branch onto main to resolve conflicts: `git fetch upstream`, `git rebase upstream/main` and force push to Github `git push --force origin your-branch`

## Changelog Conventions

What warrants a changelog entry?

- Any change that affects the public API, visual appearance or user security *must* have a changelog entry
- Any performance improvement or bugfix *should* have a changelog entry
- Any contribution from a community member *may* have a changelog entry, no matter how small
- Any documentation related changes *should not* have a changelog entry
- Any regression change introduced and fixed within the same release *should not* have a changelog entry
- Any internal refactoring, technical debt reduction, render test, unit test or benchmark related change *should not* have a changelog entry

How to add your changelog?

- Edit the [`CHANGELOG.md`](CHANGELOG.md) file directly, inserting a new entry at the top of the appropriate list
- Any changelog entry should be descriptive and concise; it should explain the change to a reader without context

## Recommended Reading

### Learning WebGL

- [Greggman's WebGL articles](http://webglfundamentals.org/)
- [WebGL reference card](http://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf)

### GL Performance

- [Debugging and Optimizing WebGL applications](https://docs.google.com/presentation/d/12AGAUmElB0oOBgbEEBfhABkIMCL3CUX7kdAPLuwZ964)
- [Graphics Pipeline Performance](http://developer.download.nvidia.com/books/HTML/gpugems/gpugems_ch28.html)

### Misc

- [drawing antialiased lines](https://www.mapbox.com/blog/drawing-antialiased-lines/)
- [drawing text with signed distance fields](https://www.mapbox.com/blog/text-signed-distance-fields/)
- [label placement](https://www.mapbox.com/blog/placing-labels/)
- [distance fields](http://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html)
