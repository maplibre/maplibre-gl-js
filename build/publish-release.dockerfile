# Run this dockerfile to publish a new release of maplibre-gl to NPM:
# docker build -f ./publish-release.dockerfile ..

FROM node:15

ENV DEBIAN_FRONTEND noninteractive

RUN \
  # Setup support for HTTPS apt sources
  apt update -y && \
  apt install -y apt-transport-https ca-certificates && \
  # Setup Yarn apt source
  curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
  apt update -y

RUN \
  apt install -y \
    git \
    node-gyp \
    yarn \
    && \
  mkdir -p maplibre-gl-js

# Copy files from the local directory, trusting its clean
ADD . maplibre-gl-js
# OR Checkout straight from the source
# RUN git clone https://github.com/maplibre/maplibre-gl-js.git --single-branch maplibre-gl-js

WORKDIR /maplibre-gl-js

RUN \
  yarn install && \
  yarn prepublishOnly && \
  npm publish
