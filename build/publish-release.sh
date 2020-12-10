#!/bin/bash

# Publishes a repeatable release of maplibre-gl to NPM
#
# USAGE:
# 1. Update version: in package.json
# 2. Commit and push package.json: to maplibre/maplibre-gl-js#main
# 3. Run: ./build/publish-release.sh
# 4. Verify: new version is up at https://www.npmjs.com/package/maplibre-gl

export NPM_TOKEN=$(cat ~/.npmrc | grep -o '_authToken=.*' | sed 's/_authToken=//g')
cd `dirname ${BASH_SOURCE[0]}`

set -ex

docker build \
  -t maplibre-gl/publish-release \
  -f ./publish-release.dockerfile \
  ..

docker run -it \
  -v "$(pwd)"/../package.json:/src/package.json \
  -v "$(pwd)"/../.git:/src/.git \
  --env NPM_TOKEN \
  maplibre-gl/publish-release
