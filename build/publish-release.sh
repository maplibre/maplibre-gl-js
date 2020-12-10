#!/bin/bash

# Publishes a repeatable release of maplibre-gl to NPM
#
# USAGE:
# 1. Run: ./build/publish-release.sh
# 2. Yarn will prompt you for a new version, enter it, and it will publish
# 3. Commit the new package.json on your host with the updated version
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

cd ..
PACKAGE_VERSION=`node -pe "require('./package.json').version"`
echo
echo
echo "maplibre-gl@${PACKAGE_VERSION} published to NPM!"
echo
echo "1. package.json was updated with the new version number you entered, please commit and push this"
echo "2. Check https://www.npmjs.com/package/maplibre-gl/v/${PACKAGE_VERSION} to verify your release"
echo
