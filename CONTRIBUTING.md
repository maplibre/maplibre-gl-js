Hi, and thanks in advance for contributing to MapLibre GL. Here's how we work. Please follow these conventions when submitting an issue or pull request.

## Do not violate Mapbox copyright!
In December 2020 Mapbox decided to publish future versions of mapbox-gl-js under a proprietary license. **You are not allowed to backport code from Mapbox projects which has been contributed under this new license**. Unauthorized backports are the biggest threat to the MapLibre project. If you are unsure about this issue, [please ask](https://github.com/maplibre/maplibre-gl-js/discussions)!


## Preparing your Development Environment

### OSX

Install the Xcode Command Line Tools Package
```bash
xcode-select --install
```

Install [node.js](https://nodejs.org/) version ^14
```bash
brew install node
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

### Linux

Install [git](https://git-scm.com/), [GNU Make](http://www.gnu.org/software/make/), and libglew-dev
```bash
sudo apt-get update &&
sudo apt-get install build-essential git libglew-dev libxi-dev default-jre default-jdk
```

Install [nvm](https://github.com/nvm-sh/nvm)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
```

Install [Node.js](https://nodejs.org/) ^14
```
nvm install 14
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

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/) (version ^14), [npm and node-gyp](https://github.com/Microsoft/nodejs-guidelines/blob/master/windows-environment.md#compiling-native-addon-modules).

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

Open the debug page at [http://localhost:9966/debug](http://localhost:9966/debug)

## Creating a Standalone Build

A standalone build allows you to turn the contents of this repository into `maplibre-gl.js` and `maplibre-gl.css` files that can be included on an html page.

To create a standalone build, run
```bash
npm run build-prod-min
npm run build-css
```

Once those commands finish, you will have a standalone build at `dist/maplibre-gl.js` and `dist/maplibre-gl.css`

## Writing & Running Tests

See [`test/README.md`](./test/README.md).

## Writing & Running Benchmarks

See [`bench/README.md`](./bench/README.md).

## Code Conventions

* We use [`error` events](https://www.mapbox.com/mapbox-gl-js/api/#Map.event:error) to report user errors.
* We use [`assert`](https://nodejs.org/api/assert.html) to check invariants that are not likely to be caused by user error. These `assert` statements are stripped out of production builds.
* We use the following ES6 features:
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
* The following ES6 features are not to be used, in order to maintain support for IE 11 and older mobile browsers. This may change in the future.
  * Spread (`...`) operator (because it requires Object.assign)
  * Iterators and generators
  * "Library" features such as `Map`, `Set`, `array.find`, etc.

The conventions for module exports are:

* No exported "namespace objects" -- modules should export either classes or functions, with an occasional exception as needed for stubbing.
* If a module exports something with the same name as the file name (modulo case), it should be the default export.
* Anything else should be a named export.

### Version Control Conventions

* We use [rebase merging](https://git-scm.com/book/en/v2/Git-Branching-Rebasing) (as opposed to [basic merging](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging#Basic-Merging)) to merge branches

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

- Any changelog entry should be descriptive and concise; it should explain the change to a reader without context
- Any changelog entry should be added to the pull request in the following format: `<changelog>Changelog description</changelog>`
- Any change that does not require a changelog should be labelled `skip changelog`

### Github Issue Labels

Our labeling system is

 - **minimalistic:** Labels' usefulness are inversely proportional to how many we have.
 - **objective:** Labels should be objective enough that any two people would agree on a labeling decision.
 - **useful:** Labels should track state or capture semantic meaning that would otherwise be hard to search.

We have divided our labels into categories to make them easier to use.

 - type (blue)
 - actionable status (red)
 - non-actionable status (grey)
 - importance / urgency (green)
 - topic / project / misc (yellow)

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
