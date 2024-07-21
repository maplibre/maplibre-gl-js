ARG VARIANT=20-bookworm-slim

FROM --platform=linux/amd64 node:${VARIANT}
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
    wget \
    && rm -rf /var/lib/apt/lists/*

# For testing purposes
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub > linux_signing_key.pub \
    && install -D -o root -g root -m 644 linux_signing_key.pub /etc/apt/keyrings/linux_signing_key.pub \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/linux_signing_key.pub] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt -y update && export DEBIAN_FRONTEND=noninteractive \
    && apt -y install google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

COPY ./ /maplibre-gl-js/
WORKDIR /maplibre-gl-js
RUN npm ci && npm run build-dist
CMD npm run start
EXPOSE 9966
