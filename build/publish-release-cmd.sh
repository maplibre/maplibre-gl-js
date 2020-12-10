#!/bin/bash

set -ex

git clone https://github.com/maplibre/maplibre-gl-js.git --single-branch

cd maplibre-gl-js

yarn install
yarn prepublishOnly

npm publish
