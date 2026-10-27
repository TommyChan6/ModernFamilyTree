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
eyes and clothing are generated procedurally at runtime.

To rebuild: see the docstring at the top of `scripts/human3d/build.py`.

# skin/*.webp — credits

The four skin photos are MakeHuman **system skins** from
`makehuman_system_assets_cc0.zip`
(<https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/>),
each "explicitly released as CC0 in September 2020" (Data Collection AB,
Joel Palmius, Jonas Hauquier — see each skin's `.mhmat`):

| file          | source skin                                             |
| ------------- | ------------------------------------------------------- |
| `young-f.webp` | `young_caucasian_female/young_lightskinned_female_diffuse.png` |
| `young-m.webp` | `young_caucasian_male/young_lightskinned_male_diffuse.png`     |
| `old-f.webp`   | `old_caucasian_female/old_lightskinned_female_diffuse.png`     |
| `old-m.webp`   | `old_caucasian_male/old_lightskinned_male_diffuse.png`         |

Converted to WebP (quality 0.9, 2048²) with the corner watermark — which lies
outside every UV island — painted over in the padding colour. The skin shader
divides each by its own mean torso colour (measured at conversion, kept in
`skinMaterial.ts`) and recolours the ratio by the chosen skin tone.
