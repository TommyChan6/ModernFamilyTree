# human3d.bin — credits

`human3d.bin` is compiled by `scripts/human3d/build.py` from the
[MakeHuman](https://github.com/makehumancommunity/makehuman) data directory
(commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`):

- the **hm08 base mesh** (`3dobjs/base.obj`) — body, eyes, teeth, tongue,
  eyelash and skirt helpers;
- the **morph targets** (`targets/…`) — macro (ethnic / universal / height /
  proportions / breast, no infant targets), every local modelling target the
  editor exposes, and the caucasian **expression units**;
- the **default skeleton and skin weights** (`rigs/default.mhskel`,
  `rigs/default_weights.mhw`).

All of these are released by the MakeHuman project under
**CC0 1.0 Universal** (public domain dedication) — see MakeHuman's
`LICENSE.md` §C and `LICENSE.ASSETS.md`. No attribution is legally required;
it's given here gladly.

The region masks inside the file (scalp, brows, beard zones, lips, flush,
translucency, wrinkle zones) are computed by `scripts/human3d/masks.py`. Hair,
skin, eyes and clothing are generated procedurally at runtime — no textures or
third-party art are bundled.

To rebuild: see the docstring at the top of `scripts/human3d/build.py`.
