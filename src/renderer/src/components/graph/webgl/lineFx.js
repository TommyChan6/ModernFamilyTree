// Line effects — animated, shader-drawn link styles (Style panel → Line Effects).
//
// Each effect is one branch of the link fragment shader, driven entirely by the
// shared uTime clock (no per-frame buffer writes, like dash flow). A link opts in
// through per-vertex values written once per restyle: its effect id and its core
// fraction. The ribbon geometry is laid out `pad`× wider than the visible line so
// glows, sparks and strands have room around the core; `vSide` (−1..+1) is the
// across-ribbon coordinate and `vFx.z` the padded half-width in world units, so
// shapes (cells, stars, sparks) stay round at any zoom. `body` is the visible
// line width (world units) an effect needs to read — linkVisual widens in-scope
// bonds to at least that.
//
// Every effect composites its layers front-to-back in premultiplied alpha
// (`lay`), so a glow keeps its own hue as it fades instead of greying out.
//
// Effects pause (render as plain lines) while the 水墨 brush look owns the links.

/** The catalog — order is the Style panel's order. `label` / `hint` are the English
 *  fallback; UIs render the i18n keys `labelKey` / `hintKey` (graphStyle.fx.<id>.*). */
export const LINE_FX = [
  { id: 'none', n: 0, pad: 1, body: 0, label: 'Classic', icon: 'minus', hint: 'Plain lines' },
  {
    id: 'blood',
    n: 1,
    pad: 2.6,
    body: 7.5,
    label: 'Bloodstream',
    icon: 'droplet',
    hint: 'A living vessel — red cells drift down the generations on a heartbeat'
  },
  {
    id: 'river',
    n: 2,
    pad: 2.2,
    body: 9,
    label: 'River',
    icon: 'waves',
    hint: 'Flowing water — caustic light, current streaks, foam at the banks'
  },
  {
    id: 'neon',
    n: 3,
    pad: 4.2,
    body: 4.5,
    label: 'Neon',
    icon: 'zap',
    hint: 'Cyber conduit — white-hot core, data packets racing, circuit ticks'
  },
  {
    id: 'helix',
    n: 4,
    pad: 1.6,
    body: 11,
    label: 'Helix',
    icon: 'dna',
    hint: 'A DNA double helix twisting along the line, base pairs glowing'
  },
  {
    id: 'ember',
    n: 5,
    pad: 2.8,
    body: 7,
    label: 'Ember',
    icon: 'flame',
    hint: 'A line of fire — licking flames and sparks thrown into the dark'
  },
  {
    id: 'aurora',
    n: 6,
    pad: 2.6,
    body: 10,
    label: 'Aurora',
    icon: 'rainbow',
    hint: 'Northern lights — shifting curtains of green and violet'
  },
  {
    id: 'storm',
    n: 7,
    pad: 3.6,
    body: 6,
    label: 'Storm',
    icon: 'cloud-lightning',
    hint: 'Crackling lightning that re-strikes as you watch'
  },
  {
    id: 'stars',
    n: 8,
    pad: 2.6,
    body: 8,
    label: 'Starlight',
    icon: 'sparkles',
    hint: 'A constellation — twinkling stars strung on a silver thread'
  },
  {
    id: 'gilded',
    n: 9,
    pad: 2.4,
    body: 6.5,
    label: 'Gilded',
    icon: 'crown',
    hint: 'A royal gold rope with a shine that travels its length'
  },
  {
    // The constellation skin's lines: thin and crisp, a faint glow, and a
    // small gap at each end so the line stops short of its star (star charts).
    id: 'starline',
    n: 10,
    pad: 3.2,
    body: 1.6,
    label: 'Star chart',
    icon: 'star',
    hint: 'Constellation lines — fine silver strokes that stop short of each star'
  }
].map((f) => ({
  ...f,
  labelKey: `graphStyle.fx.${f.id}.label`,
  hintKey: `graphStyle.fx.${f.id}.hint`
}))

const BY_ID = new Map(LINE_FX.map((f) => [f.id, f]))
/** Effect spec by id (unknown → Classic). */
export function lineFxSpec(id) {
  return BY_ID.get(id) || LINE_FX[0]
}

/** Which links a scope covers: 'lineage' = parent→child (vertical), 'family'
 *  = + couples (horizontal), 'all' = every bond. */
export function lineFxApplies(scope, symmetryRole) {
  if (scope === 'all') return true
  if (scope === 'family') return symmetryRole === 'vertical' || symmetryRole === 'horizontal'
  return symmetryRole === 'vertical'
}

/** The noise helpers FX_GLSL expects (bHash / bNoise / bNoise2), for shaders
 *  that don't already define them (the link material has its own copy). */
export const FX_NOISE_GLSL = /* glsl */ `
  float bHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
  float bHash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float bNoise(float x) {
    float i = floor(x), f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(bHash(i), bHash(i + 1.0), u);
  }
  float bNoise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = bHash2(i), b = bHash2(i + vec2(1.0, 0.0));
    float c = bHash2(i + vec2(0.0, 1.0)), d = bHash2(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
`

/** GLSL: `vec4 lineFx(int id, …)` — expects bHash / bNoise / bNoise2 in scope.
 *  Returns straight (non-premultiplied) colour + alpha. */
export const FX_GLSL = /* glsl */ `
  uniform float uFxSpeed;   // animation speed multiplier (0 = frozen)
  uniform float uFxGlow;    // glow / bloom strength
  uniform float uFxKeep;    // 1 = keep relationship colours, 0 = effect palette
  uniform float uFxLight;   // 1 on light backgrounds (soften white bloom)

  float fxTint(float k) { return k * (1.0 - 0.82 * uFxKeep); }
  vec3 fxHi(vec3 c) { return mix(vec3(1.0), c * 0.9, uFxLight * 0.55); }
  // Paint a layer over the accumulator (premultiplied "over").
  void lay(inout vec4 acc, vec3 c, float a) {
    a = clamp(a, 0.0, 1.0);
    acc.rgb = c * a + acc.rgb * (1.0 - a);
    acc.a = a + acc.a * (1.0 - a);
  }

  vec4 lineFx(int id, vec3 baseCol, float side, float core, float halfW,
              float arc, float len, float seed) {
    float t = uTime * uFxSpeed;
    float a = abs(side);
    float x = a / max(core, 1e-3);          // 0 spine · 1 core rim · >1 glow zone
    float sc = side / max(core, 1e-3);      // signed, in core units
    float lat = side * halfW;               // signed, world units across
    float coreW = core * halfW;             // core half-width, world units
    float aa = fwidth(side) / max(core, 1e-3) * 1.4 + 0.01;
    float u = arc / max(len, 1.0);
    float tube = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, x);
    float outer = max(x - 1.0, 0.0);
    vec4 acc = vec4(0.0);

    if (id == 1) {
      // ── Bloodstream: a living vessel ──
      vec3 base = mix(baseCol, vec3(0.66, 0.04, 0.09), fxTint(0.85));
      float shade = sqrt(max(0.0, 1.0 - x * x));
      float beat = pow(0.5 + 0.5 * sin((u * 2.2 - t * 1.1) * 6.2831), 8.0);
      float beat2 = pow(0.5 + 0.5 * sin((u * 2.2 - t * 1.1 + 0.13) * 6.2831), 10.0);
      float pulse = beat + beat2 * 0.65;
      lay(acc, base * 1.4 + 0.06, exp(-outer * 2.0) * (1.0 - tube) * (0.3 + 0.5 * pulse) * uFxGlow);
      lay(acc, base * (0.38 + 0.62 * shade) + vec3(0.25, 0.02, 0.02) * pulse, tube * 0.95);
      // Red cells: biconcave discs tumbling down the vessel.
      float P = coreW * 4.2 + 6.0;
      float cc = (arc - t * 40.0) / P;
      float ci = floor(cc);
      float off = (bHash(ci + seed) - 0.5) * 0.9 * coreW;
      float cs = 0.65 + 0.4 * bHash(ci * 1.73 + seed);
      vec2 q = vec2((fract(cc) - 0.5) * P / (coreW * 1.3 * cs), (lat - off) / (coreW * 0.62 * cs));
      float r = length(q);
      float cell = (1.0 - smoothstep(0.78, 1.0, r)) * step(0.22, bHash(ci * 3.7 + seed));
      vec3 cellCol = mix(vec3(0.62, 0.05, 0.06), vec3(1.0, 0.36, 0.3), smoothstep(0.15, 0.75, r));
      lay(acc, cellCol, cell * tube * 0.9);
      lay(acc, vec3(1.0, 0.7, 0.62), pulse * shade * tube * 0.3);
    } else if (id == 2) {
      // ── River: water with light in it ──
      vec3 deep = mix(baseCol, vec3(0.09, 0.45, 0.75), fxTint(0.75));
      float n1 = bNoise2(vec2(arc * 0.06 - t * 1.8, sc * 1.7 + seed));
      float n2 = bNoise2(vec2(arc * 0.14 - t * 3.0, sc * 3.6 - seed));
      float caustic = pow(smoothstep(0.4, 0.95, (n1 + n2) * 0.5 + 0.14 * sin(arc * 0.2 - t * 3.0)), 1.6);
      float streak = smoothstep(0.9, 1.0, sin(arc * 0.38 - t * 7.5 + n1 * 6.0 + sc * 0.8)) * (1.0 - x);
      float foam = smoothstep(0.62, 1.0, x) * smoothstep(0.45, 0.8, bNoise2(vec2(arc * 0.2 - t * 2.4, seed * 3.0 + sign(side))));
      float glint = step(0.982, bHash2(floor(vec2(arc * 0.4, sc * 5.0)) + floor(t * 5.0))) * (1.0 - x);
      lay(acc, deep * 1.3 + 0.05, exp(-outer * 2.6) * (1.0 - tube) * 0.35 * uFxGlow);
      lay(acc, deep * (0.62 + 0.5 * (1.0 - x)), tube * 0.9);
      lay(acc, fxHi(deep), caustic * 0.55 * tube);
      lay(acc, fxHi(deep), streak * 0.5 * tube);
      lay(acc, fxHi(deep) * 0.96, foam * 0.75 * tube);
      lay(acc, vec3(1.0), glint * 0.9 * tube);
    } else if (id == 3) {
      // ── Neon: a cyber conduit ──
      vec3 c = baseCol / max(max(baseCol.r, baseCol.g), max(baseCol.b, 0.05));
      c = mix(baseCol, c, 0.8);
      float hot = 1.0 - smoothstep(0.18, 0.36, x);
      float body = 1.0 - smoothstep(0.75, 1.0 + aa, x);
      float flick = 0.94 + 0.06 * sin(t * 51.0 + seed * 9.0);
      if (bHash(floor(t * 7.0) + seed * 13.0) > 0.965) flick *= 0.4;
      lay(acc, c, exp(-x * 1.25) * 0.85 * uFxGlow * flick);
      lay(acc, c * 1.1, body * 0.9 * flick);
      float rimBand = smoothstep(0.6, 0.66, x) * (1.0 - smoothstep(0.72, 0.8, x));
      float ticks = step(0.55, fract(arc * 0.09 - t * 0.7)) * rimBand;
      lay(acc, fxHi(c), ticks * 0.6);
      lay(acc, fxHi(c), hot * flick);
      // Data packets: bright comets racing down the core, tails trailing.
      float P = 70.0 + 40.0 * bHash(seed * 7.0);
      float pc = fract((arc - t * 160.0) / P);
      float packet = smoothstep(0.82, 0.995, pc) * (1.0 - smoothstep(0.995, 1.0, pc));
      lay(acc, fxHi(c), packet * (1.0 - smoothstep(0.35, 0.95, x)));
    } else if (id == 4) {
      // ── Helix: a DNA double strand ──
      float k = 6.2831 / max(coreW * 7.0, 12.0);
      float ph = arc * k - t * 2.4 + seed * 6.0;
      float y1 = sin(ph) * 0.82;
      float z1 = cos(ph);
      float th = 0.16;
      float s1 = 1.0 - smoothstep(th - aa, th + aa, abs(sc - y1));
      float s2 = 1.0 - smoothstep(th - aa, th + aa, abs(sc + y1));
      float rs = 0.7854;
      float ra = abs(fract(ph / rs + 0.5) - 0.5) * rs / k;
      float rung = (1.0 - smoothstep(0.6, 1.1, ra)) * step(abs(sc), abs(y1) - 0.06);
      float bi = floor(ph / rs + 0.5);
      float hb = bHash(bi + seed * 3.0);
      vec3 pair = hb < 0.25 ? vec3(0.95, 0.35, 0.42) : hb < 0.5 ? vec3(0.35, 0.75, 1.0)
                : hb < 0.75 ? vec3(0.45, 0.95, 0.55) : vec3(1.0, 0.82, 0.3);
      pair = mix(pair, baseCol, 0.2 + 0.5 * uFxKeep);
      vec3 cA = mix(baseCol, fxHi(baseCol), 0.15);
      vec3 cB = mix(baseCol, fxHi(baseCol), 0.5);
      lay(acc, baseCol, exp(-max(x - 0.9, 0.0) * 3.0) * 0.16 * uFxGlow);
      lay(acc, pair, rung * 0.85);
      // Back strand first (dimmer), then the front one crossing over it.
      if (z1 > 0.0) {
        lay(acc, cB * 0.55, s2 * 0.85);
        lay(acc, cA * 1.15, s1);
      } else {
        lay(acc, cA * 0.55, s1 * 0.85);
        lay(acc, cB * 1.15, s2);
      }
    } else if (id == 5) {
      // ── Ember: a line of fire ──
      float n = bNoise2(vec2(arc * 0.05 - t * 3.2, sc * 1.3 + t * 0.8 + seed)) * 0.6
              + bNoise2(vec2(arc * 0.12 - t * 5.4, sc * 2.7 - t)) * 0.4;
      float heat = (1.0 - x * 0.75) + (n - 0.5) * 1.1;
      heat *= 0.9 + 0.2 * sin(arc * 0.045 - t * 4.2);
      vec3 c = mix(vec3(0.6, 0.06, 0.0), vec3(0.95, 0.28, 0.03), smoothstep(0.2, 0.5, heat));
      c = mix(c, vec3(1.0, 0.62, 0.1), smoothstep(0.5, 0.75, heat));
      c = mix(c, vec3(1.0, 0.95, 0.7), smoothstep(0.78, 1.0, heat));
      c = mix(c, baseCol * 1.2, 0.25 * uFxKeep);
      lay(acc, vec3(0.95, 0.3, 0.04), exp(-outer * 1.8) * (1.0 - tube) * 0.3 * uFxGlow);
      lay(acc, c, smoothstep(0.18, 0.45, heat));
      // Sparks thrown outward, each living one short arc.
      float cellL = 13.0;
      float cc = (arc + t * 9.0) / cellL;
      float ci = floor(cc);
      float life = fract(t * 0.85 + bHash(ci + seed));
      float dir = bHash(ci * 3.1 + seed) > 0.5 ? 1.0 : -1.0;
      float py = dir * (0.6 + life * 1.6) * coreW;
      float px = (fract(cc) - 0.5) * cellL + (bHash(ci * 7.7) - 0.5) * 6.0 - life * 7.0;
      float spark = (1.0 - smoothstep(0.0, 1.0, length(vec2(px, lat - py)))) * (1.0 - life)
                  * step(0.3, bHash(ci * 5.3));
      lay(acc, vec3(1.0, 0.85, 0.45), spark);
    } else if (id == 6) {
      // ── Aurora: curtains of light ──
      float w = 0.5 + 0.5 * sin(arc * 0.018 - t * 0.6 + sc * 1.2 + seed * 4.0);
      vec3 aur = mix(vec3(0.16, 0.96, 0.58), vec3(0.6, 0.38, 1.0), w);
      aur = mix(aur, vec3(0.22, 0.78, 1.0), 0.3 * (0.5 + 0.5 * sin(t * 0.4 + arc * 0.012)));
      aur = mix(baseCol, aur, fxTint(0.85));
      float curtain = 0.5 + 0.5 * sin(arc * 0.085 + bNoise(arc * 0.03 - t * 0.6 + seed) * 6.0 - t * 1.4);
      float rays = pow(bNoise2(vec2(arc * 0.22, t * 0.9 + seed)), 2.0);
      float body = exp(-x * x * 1.1);
      lay(acc, aur, body * (0.35 + 0.55 * curtain) * (0.6 + 0.6 * rays) * (0.7 + 0.4 * uFxGlow));
      lay(acc, fxHi(aur), rays * curtain * 0.45 * (1.0 - smoothstep(0.2, 1.0, x)));
    } else if (id == 7) {
      // ── Storm: crackling lightning ──
      vec3 base = mix(baseCol, vec3(0.58, 0.66, 1.0), fxTint(0.65));
      float strike = floor(t * 11.0);
      float on = mix(0.25, 1.0, step(0.32, bHash(strike + seed * 3.0)));
      lay(acc, base, exp(-x * 1.0) * 0.3 * uFxGlow * (0.6 + 0.4 * on));
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        float off = (bNoise(arc * 0.06 + strike * 13.1 + fi * 41.0 + seed * 9.0) - 0.5) * 1.7
                  + (bNoise(arc * 0.28 + strike * 7.0 + fi * 17.0) - 0.5) * 0.55;
        float d = abs(sc - off) * coreW;
        lay(acc, base, exp(-d * 1.1) * 0.35 * on);
        lay(acc, mix(fxHi(base), base, 0.25), (1.0 - smoothstep(0.0, 0.6 + fi * 0.25, d)) * (1.0 - fi * 0.4) * on);
      }
    } else if (id == 8) {
      // ── Starlight: a constellation thread ──
      vec3 sCol = mix(baseCol, vec3(1.0, 0.95, 0.82), fxTint(0.7));
      lay(acc, sCol, exp(-x * 1.8) * 0.16 * uFxGlow);
      lay(acc, sCol * 0.95, (1.0 - smoothstep(0.08, 0.2, x)) * 0.45);
      float cellL = 12.0 + coreW * 2.2;
      float cc = (arc - t * 3.5) / cellL;
      float ci = floor(cc);
      float px = (fract(cc) - 0.5) * cellL;
      float py = (bHash(ci + seed) - 0.5) * 1.4 * coreW;
      vec2 dv = vec2(px, lat - py);
      float size = 0.9 + 1.9 * bHash(ci * 5.3 + seed);
      float tw = 0.45 + 0.55 * sin(t * (1.6 + 3.0 * bHash(ci * 2.9)) + ci * 1.7);
      float star = exp(-length(dv) / size * 2.0);
      float spikes = exp(-abs(dv.y) * 2.2) * exp(-abs(dv.x) / (size * 3.2))
                   + exp(-abs(dv.x) * 2.2) * exp(-abs(dv.y) / (size * 3.2));
      float s = (star + spikes * 0.5) * tw * step(0.22, bHash(ci * 9.1 + seed));
      lay(acc, fxHi(sCol), s);
    } else if (id == 9) {
      // ── Gilded: a royal gold rope ──
      vec3 dark = vec3(0.42, 0.27, 0.05);
      vec3 gold = mix(vec3(1.0, 0.8, 0.32), baseCol, 0.4 * uFxKeep);
      float band = 0.5 + 0.5 * cos(min(x, 1.0) * 2.6);
      float twist = 0.5 + 0.5 * sin(arc * 0.32 + sc * 2.6 - t * 0.6);
      float spec = pow(max(0.0, sin(arc * 0.035 - t * 1.6 + seed * 5.0)), 30.0);
      float glint = step(0.992, bHash2(floor(vec2(arc * 0.3, t * 3.0 + seed)))) * band;
      lay(acc, gold, exp(-outer * 2.2) * (1.0 - tube) * (0.28 + 0.45 * spec) * uFxGlow);
      lay(acc, mix(dark, gold, band * (0.55 + 0.45 * twist)), tube);
      lay(acc, fxHi(gold), (spec * band * 0.85 + glint) * tube);
    } else if (id == 10) {
      // ── Star chart: a crisp constellation line ──
      vec3 sCol = mix(baseCol, vec3(0.78, 0.86, 1.0), fxTint(0.75));
      float gap = min(15.0, len * 0.2);
      float ends = smoothstep(gap - 2.0, gap + 4.0, arc)
                 * (1.0 - smoothstep(len - gap - 4.0, len - gap + 2.0, arc));
      float shimmer = 0.86 + 0.14 * sin(arc * 0.045 - t * 0.7 + seed * 6.0);
      float fine = 1.0 - smoothstep(0.55 - aa, 0.55 + aa, x); // crisper than the core
      lay(acc, sCol, exp(-max(x - 0.55, 0.0) * 1.6) * (1.0 - fine) * 0.2 * uFxGlow * ends);
      lay(acc, mix(sCol, fxHi(sCol), 0.45), fine * 0.62 * ends * shimmer);
    } else {
      lay(acc, baseCol, tube);
    }
    return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
  }
`
