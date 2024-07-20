ARG VARIANT=20-bookworm-slim

FROM --platform=$BUILDPLATFORM node:${VARIANT}
LABEL org.opencontainers.image.source="https://github.com/maplibre/maplibre-gl-js"

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install \
    --no-install-recommends \
    build-essential \
    git \
    libglew-dev \
    libxi-dev \
    default-jre \
    default-jdk \
    xvfb \
    python3 \
    python-is-python3 \
    pkg-config \
    libpixman-1-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libgif-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /maplibre-gl-js
CMD npm ci && npm run build-dist
