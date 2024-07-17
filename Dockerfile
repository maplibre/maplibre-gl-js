FROM --platform=$BUILDPLATFORM node:lts-bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

RUN echo "hello world"

RUN apt-get update && apt-get install -y \
  build-essential \
  git \
  libglew-dev \
  libxi-dev \
  default-jre \
  default-jdk \
  xvfb \
  && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
  python3 \
  python-is-python3 \
  pkg-config \
  libpixman-1-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libgif-dev \
  && rm -rf /var/lib/apt/lists/*

COPY ./ /maplibre-gl-js/

WORKDIR /maplibre-gl-js
RUN npm install
RUN npm run build-css
RUN npm run build-dev
CMD npm run watch-dev