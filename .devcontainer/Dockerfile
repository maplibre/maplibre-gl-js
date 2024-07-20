# See https://github.com/devcontainers/images/blob/main/src/javascript-node/.devcontainer/Dockerfile
ARG VARIANT=22-bookworm-slim

FROM --platform=$BUILDPLATFORM node:${VARIANT}
LABEL org.opencontainers.image.source="https://github.com/maplibre/maplibre-gl-js"

ARG USERNAME=node
ARG NPM_GLOBAL=/usr/local/share/npm-global

# Add NPM global to PATH.
ENV PATH=${NPM_GLOBAL}/bin:${PATH}

RUN \
    # Configure global npm install location, use group to adapt to UID/GID changes
    if ! cat /etc/group | grep -e "^npm:" > /dev/null 2>&1; then groupadd -r npm; fi \
    && usermod -a -G npm ${USERNAME} \
    && umask 0002 \
    && mkdir -p ${NPM_GLOBAL} \
    && touch /usr/local/etc/npmrc \
    && chown ${USERNAME}:npm ${NPM_GLOBAL} /usr/local/etc/npmrc \
    && chmod g+s ${NPM_GLOBAL} \
    && npm config -g set prefix ${NPM_GLOBAL} \
    && su ${USERNAME} -c "npm config -g set prefix ${NPM_GLOBAL}" \
    # Install eslint
    && su ${USERNAME} -c "umask 0002 && npm install -g eslint" \
    && npm cache clean --force > /dev/null 2>&1

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

CMD npm ci && npm run start
EXPOSE 9966