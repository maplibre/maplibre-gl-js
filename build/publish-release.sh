#!/bin/bash

# Publishes a repeatable release of maplibre-gl to NPM
#
# USAGE:
# 1. Run: ./build/publish-release.sh [command, default is `yarn publish`]
# 2. Yarn will prompt you for a new version, enter it, and it will publish
# 3. Commit the new package.json on your host with the updated version
# 4. Verify: new version is up at https://www.npmjs.com/package/maplibre-gl

echo "Heads up: this script assumes you only have /one/ NPM registry setup, which is true for most devs."
echo "If you /do/ have more than just registry.npmjs.org in ~/.npmrc, it may not"
echo "try to npm publish with the correct (authorized) npm authToken, and publish will fail to auth"
echo

cd `dirname ${BASH_SOURCE[0]}`

set -ex

docker build \
  -t maplibre-gl-js \
  -f ./maplibre-gl-js.dockerfile \
  ..

set +x
export NPM_TOKEN=$(cat ~/.npmrc | grep -o '_authToken=.*' | sed 's/_authToken=//g')
export GIT_AUTHOR_NAME=$(git config user.name)
export GIT_AUTHOR_EMAIL=$(git config user.email)
set -x

docker run -it \
  -v "$(pwd)"/../package.json:/src/package.json \
  -v "$(pwd)"/../.git:/src/.git \
  --env NPM_TOKEN \
  --env GIT_USER_NAME \
  --env GIT_USER_EMAIL \
  maplibre-gl-js \
  ${1:-yarn publish}

set +x

cd ..
PACKAGE_VERSION=`node -pe "require('./package.json').version"`
echo
echo
echo "SUCCESS: maplibre-gl@${PACKAGE_VERSION} published to NPM!"
echo
echo "1. package.json was updated with the new version number you entered, please commit and push this"
echo "2. Check https://www.npmjs.com/package/maplibre-gl/v/${PACKAGE_VERSION} to verify your release"
echo
