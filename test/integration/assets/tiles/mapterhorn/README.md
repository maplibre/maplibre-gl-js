# Mapterhorn elevation fixtures

These Terrarium-encoded PNGs contain unmodified elevation samples from
[Mapterhorn](https://mapterhorn.com/), downloaded on 2026-09-05. The source tiles
are `https://tiles.mapterhorn.com/10/{x}/{y}.webp`, with `x` in `531, 532` and `y`
in `361, 362`. See [Mapterhorn's attribution](https://mapterhorn.com/attribution/)
for its data sources, including the Federal Office of Topography swisstopo's
[swissALTI3D](https://www.swisstopo.admin.ch/en/height-model-swissalti3d).

Each fixture is the 64 × 64 pixel corner nearest the four tiles' shared junction
at longitude 7.03125, latitude 46.55886030311718. The crop starts at pixel 448 on
each axis for the western or northern tile, and at pixel 0 otherwise. Cropping
the 512 × 512 source tiles without resampling gives 64 × 64 tiles at zoom 13 with
the same geographic sample spacing. Their tile coordinates are `4255, 4256` in
x and `2895, 2896` in y. The render test overzooms this junction to expose
interpolation seams along both axes.
