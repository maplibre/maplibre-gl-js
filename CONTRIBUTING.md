# Contributing to MapLibre GL JS

Hi, and thanks in advance for contributing to MapLibre GL JS. Here's how we work. Please follow these conventions when submitting an issue or pull request.

## Do not violate Mapbox copyright!

In December 2020 Mapbox decided to publish future versions of mapbox-gl-js under a proprietary license. **You are not allowed to backport code from Mapbox projects which has been contributed under this new license**. Unauthorized backports are the biggest threat to the MapLibre project. If you are unsure about this issue, [please ask](https://github.com/maplibre/maplibre-gl-js/discussions)!

## Best Practices for Contributions

MapLibre welcomes contributions from community! This codebase is large and complex, and following these best practices will assist the maintainer team in reviewing your contribution. In general, the project values discussion and communication over process and documentation. However, due to the size and complexity of the code, below are some best practices that have aided contributors.

It is a good idea to discuss proposed changes before proceeding to an issue ticket or PR. The project team is active in the following forums:

* For informal chat discussions, visit the project's [Slack Channel](https://osmus.slack.com/archives/C01G3D28DAB).
* For discussions whose output and outcomes should not be ephemeral, consider starting a thread on [GitHub Discussions](https://github.com/maplibre/maplibre-gl-js/discussions). This makes it easier to find and reference the discussion in the future.

MapLibre software relies heavily on automated testing, and the project includes a suite of unit and integration tests. For both new features and bugfixes, contributions should update or add test cases to prevent regressions.

### New Features

For new features, it is usually a good idea to start with an issue ticket. If the feature requires changes to the style specification, an issue ticket should be created in the [style specification GitHub repository](https://github.com/maplibre/maplibre-gl-style-spec). Style specification changes are hard to change later, so there will be particularly close scrutiny on changes to the specification.

If possible, it is beneficial to demonstrate proposed new features and assess the performance implications of the proposed change. You can use `npm install <location-of-maplibre-source-code>` to test changes in an npm context, or `npm run build-prod` to build a .js package for this purpose.

For more complex proposed features that require deeper discussion, you should consider bringing it up in the [Technical Steering Committee](https://maplibre.org/categories/steering-committee/) meeting for a video discussion with the team about the proposed change. We find that sometimes it's easier to have a focused, face-to-face discussion for more consequential decisions.

The Technical Steering Committee meetings are open to anyone who wants to get involved in the technical direction of the project. These meetings offer a chance for discussion and collaboration on various technical topics. We welcome you to join the meetings if you're interested in getting involved.

### Bug Fixes

If you've identified a significant bug, or one that you don't intend to fix yourself, please write up an issue ticket describing the problem. For minor or straightforward bug fixes, feel free to proceed directly to a PR.

Some best practices for PRs for bugfixes are as follows:

1. Begin by writing a failing test which demonstrates how the current software fails to operate as expected. Commit and push the branch.
2. Create a draft PR which documents the incorrect behavior. This will show the failing test you've just written in the project's continuous integration and demonstrates the existence of the bug.
3. Fix the bug, and update the PR with any other notes needed to describe the change in the PR's description.
4. Don't forget to mark the PR as ready for review when you're satisfied with the code changes.

This is not intended to be a strict process but rather a guideline that will build confidence that your PR is addressing the problem.

## Preparing your Development Environment

### CodeSpaces

By creating a code space you should be able to start working immediately after the post create script finishes running.
This script basically installes everything written here in the linux part.

### macOS

Install the Xcode Command Line Tools Package
```bash
xcode-select --install
```

Install [node.js](https://nodejs.org/) version in [.nvmrc](.nvmrc)
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

#### Apple silicon

If you have one of the newer arm64 machines, you might find that canvas.node or webgl.node can't be found for your architecture. In that case go to `node_modules/canvas` and `node_modules/gl` and run:

```
npm install --build-from-source
```

If you have installed from non-M1 machine to an M1 machine using Migration Assistant and you had `brew` installed before, and you get this error when running tests:

```
dlopen(/Users/[...]/common/temp/node_modules/.pnpm/canvas@2.11.0/node_modules/canvas/build/Release/canvas.node, 0x0001): symbol not found in flat namespace '_cairo_fill'

      at Object.<anonymous> (../../common/temp/node_modules/.pnpm/canvas@2.11.0/node_modules/canvas/lib/bindings.js:3:18)
```

Try
- Uninstall then re-install `brew` [brew](https://brew.sh/)
- Run `arch -arm64 brew install pkg-config cairo pango libpng jpeg giflib librsvg`
- delete `node_modules` folder and re-run `npm install`

### Linux (and by extension GitHub codespaces)

Install [git](https://git-scm.com/), [GNU Make](https://www.gnu.org/software/make/), and libglew-dev
```bash
sudo apt-get update &&
sudo apt-get install build-essential git libglew-dev libxi-dev default-jre default-jdk xvfb
```

If prebuilt binaries for canvas and gl aren’t available, you will also need:

```bash
sudo apt-get install python-is-python3 pkg-config libpixman-1-dev libcairo2-dev libpango1.0-dev libgif-dev
```

Install [nvm](https://github.com/nvm-sh/nvm)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
```

Install [Node.js](https://nodejs.org/) from .nvmrc
```
nvm install
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

Before you can [run the docs](./docs/README.md), you need to ensure Docker is installed and you have permission to run `docker` commands without `sudo`, as explained [here in the Docker docs](https://docs.docker.com/engine/install/linux-postinstall/).


### Windows

Consider using WSL and follow the above Linux guide or follow the next steps

Install [git](https://git-scm.com/), [node.js](https://nodejs.org/) (version in [.nvmrc](.nvmrc)), [npm and node-gyp](https://github.com/Microsoft/nodejs-guidelines/blob/master/windows-environment.md#compiling-native-addon-modules).

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

## Creating a Standalone Build

A standalone build allows you to turn the contents of this repository into `maplibre-gl.js` and `maplibre-gl.css` files that can be included on an html page.

To create a standalone build, run
```bash
npm run build-prod
npm run build-css
```

Once those commands finish, you will have a standalone build at `dist/maplibre-gl.js` and `dist/maplibre-gl.css`

## Testing changes and Writing Documentation

See [`docs/README.md`](./docs/README.md)

## Writing & Running Tests

See [`test/README.md`](./test/README.md).

## Writing & Running Benchmarks

See [`test/bench/README.md`](./test/bench/README.md).

## Further guides

See [`developer-guides`](./developer-guides) directory for guides on the release process and tile lifecycle.

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

- [Greggman's WebGL articles](https://webglfundamentals.org/)
- [WebGL reference card](https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf)

### GL Performance

- [Debugging and Optimizing WebGL applications](https://docs.google.com/presentation/d/12AGAUmElB0oOBgbEEBfhABkIMCL3CUX7kdAPLuwZ964)

### Misc

- [drawing antialiased lines](https://blog.mapbox.com/drawing-antialiased-lines-with-opengl-8766f34192dc)
- [drawing text with signed distance fields](https://blog.mapbox.com/drawing-text-with-signed-distance-fields-in-mapbox-gl-b0933af6f817)
- [label placement](https://www.mapbox.com/blog/placing-labels/)
- [distance fields](https://bytewrangler.blogspot.com/2011/10/signed-distance-fields.html)
