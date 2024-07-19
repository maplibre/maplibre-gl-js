FROM --platform=$BUILDPLATFORM node:lts-bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

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

WORKDIR /maplibre-gl-js
COPY ./ /maplibre-gl-js/
RUN npm ci
RUN npm run build-dist
CMD npm run start
EXPOSE 9966