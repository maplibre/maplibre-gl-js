'use strict';
/// js files in this project are esm.
/// This package.json ensures that node imports from outside see them as such
// https://nodejs.org/api/packages.html#type

import { writeFile, mkdir, copyFile } from "node:fs/promises"

async function ensureDist() {
  const dist = new URL("../dist/", import.meta.url);
  await mkdir(dist, { recursive: true })
  return dist
}

await writeFile(
  new URL("package.json", await ensureDist()),
  JSON.stringify({
    name: "maplibre-gl",
    type: "commonjs",
    deprecated: "Please install maplibre-gl from parent directory instead",
  })
)

await copyFile(
  "./LICENSE.txt",
  new URL("LICENSE.txt", await ensureDist())
)