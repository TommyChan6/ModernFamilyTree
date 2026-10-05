// 水墨 — GLSL snippets shared by the ink layers (InkStrokeLayer, InkThreadLayer,
// InkDropLayer, InkMistLayer and the ink branches of ZoneLayer / ArcLayer).
// Cheap hash-based value noise: no textures, deterministic per seed.

export const INK_NOISE = /* glsl */ `
  float inkHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  // value noise in [0,1]
  float inkNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = inkHash(i);
    float b = inkHash(i + vec2(1.0, 0.0));
    float c = inkHash(i + vec2(0.0, 1.0));
    float d = inkHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float inkFbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * inkNoise(p);
      p = p * 2.03 + vec2(17.1, 9.7);
      a *= 0.5;
    }
    return s / 0.9375;
  }
  // the brush tip's travel ease (mirrors writeEase in inkMath.ts)
  float inkWrite(vec2 w, float time) {
    if (w.y <= 0.0) return 1.0;
    float t = clamp((time - w.x) / w.y, 0.0, 1.0);
    return 1.0 - (1.0 - t) * (1.0 - t);
  }
`
