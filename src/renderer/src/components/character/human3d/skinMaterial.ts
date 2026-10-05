// The skin shader: a MeshPhysicalMaterial extended in place (onBeforeCompile)
// so it keeps three's lights, shadows, environment and tone mapping, plus:
//
//  * subsurface-style diffuse — per-channel wrap lighting (red bleeds furthest
//    past the terminator) and back-scatter through thin parts (ears,
//    nostrils, fingers) from the `thin` mask;
//  * dual-lobe specular — the base GGX lobe plus a sharper clearcoat "oil"
//    lobe whose strength follows the T-zone, the lips and the gloss slider;
//  * procedural micro-detail in REFERENCE space (the unmorphed base-mesh
//    position, attribute aRef) so pores, freckles, moles, stubble and age
//    lines stay glued to the skin through every morph and pose: pores and
//    wrinkles become a derivative bump, the rest tint the albedo;
//  * makeup layers (lipstick + gloss, eyeshadow, liner, blush) on the region
//    masks baked by scripts/human3d/masks.py.

import * as THREE from 'three'

export interface SkinParams {
  tone: string
  flush: number
  freckles: number
  moles: number
  circles: number
  sheen: number
  detail: number
  sss: number
  wrinkles: number
  /** 0..1 age factor (from the age macro) — age spots + deeper lines. */
  age: number
  lipColor: string
  lips: number
  gloss: number
  shadowColor: string
  shadow: number
  liner: number
  blushColor: string
  blush: number
  stubbleColor: string
  scalpColor: string
  browColor: string
  /** Painted brow underlay strength (strands draw the rest). */
  browPaint: number
}

const linear = (hex: string) => new THREE.Color(hex)

export function createSkinMaterial() {
  const uniforms = {
    uTone: { value: linear('#d9a184') },
    uFlush: { value: 0.35 },
    uFreckles: { value: 0 },
    uMoles: { value: 0.15 },
    uCircles: { value: 0.2 },
    uDetail: { value: 0.6 },
    uSss: { value: 0.6 },
    uWrinkles: { value: 0 },
    uAge: { value: 0 },
    uLipColor: { value: linear('#b0474f') },
    uLips: { value: 0 },
    uGloss: { value: 0.2 },
    uShadowColor: { value: linear('#7a5a8c') },
    uShadow: { value: 0 },
    uLiner: { value: 0 },
    uBlushColor: { value: linear('#e07a7a') },
    uBlush: { value: 0 },
    uStubbleColor: { value: linear('#2a1e15') },
    uScalpColor: { value: linear('#3b2a1e') },
    uBrowColor: { value: linear('#2f2219') },
    uBrowPaint: { value: 0.5 },
    uHighlight: { value: 0 }, // editor: glow the hovered region
    uHighlightCenter: { value: new THREE.Vector3() },
    uHighlightRadius: { value: 0.3 }
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.52,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.38,
    specularIntensity: 0.55,
    sheen: 0.15,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(0.9, 0.75, 0.7)
  })
  mat.name = 'human3d-skin'

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
attribute vec4 aMaskA; // flush, eyeUpper, eyeLower, thin
attribute vec4 aMaskB; // stubble, scalpShade, lips, brow
attribute vec4 aMaskC; // forehead, crow's feet, nasolabial, (spare)
attribute vec3 aRef;   // unmorphed base position (dm)
varying vec4 vMaskA;
varying vec4 vMaskB;
varying vec4 vMaskC;
varying vec3 vRef;`
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
vMaskA = aMaskA; vMaskB = aMaskB; vMaskC = aMaskC; vRef = aRef;`
      )

    const lightsChunk = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
      /* glsl */ `{
    // Subsurface approximation: per-channel wrap + soft red terminator
    float ndl = dot( geometryNormal, directLight.direction );
    vec3 w = vec3( 0.62, 0.28, 0.18 ) * uSss;
    vec3 wrapped = clamp( ( vec3( ndl ) + w ) / ( ( 1.0 + w ) * ( 1.0 + w ) ), 0.0, 1.0 );
    reflectedLight.directDiffuse += directLight.color * wrapped * BRDF_Lambert( material.diffuseColor );
    // Back-scatter through ears / nostrils / fingers
    vec3 bl = normalize( directLight.direction + geometryNormal * 0.35 );
    float tr = pow( saturate( dot( geometryViewDir, -bl ) ), 3.0 ) * vMaskA.w * uSss;
    reflectedLight.directDiffuse += directLight.color * tr * vec3( 1.0, 0.32, 0.18 ) * material.diffuseColor * 2.2;
  }`
    )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
varying vec4 vMaskA;
varying vec4 vMaskB;
varying vec4 vMaskC;
varying vec3 vRef;
uniform vec3 uTone;
uniform float uFlush, uFreckles, uMoles, uCircles, uDetail, uSss, uWrinkles, uAge;
uniform vec3 uLipColor; uniform float uLips, uGloss;
uniform vec3 uShadowColor; uniform float uShadow, uLiner;
uniform vec3 uBlushColor; uniform float uBlush;
uniform vec3 uStubbleColor, uBrowColor, uScalpColor; uniform float uBrowPaint;
uniform float uHighlight, uHighlightRadius; uniform vec3 uHighlightCenter;

float h3( vec3 p ) { p = fract( p * vec3( 443.897, 441.423, 437.195 ) ); p += dot( p, p.yzx + 19.19 ); return fract( ( p.x + p.y ) * p.z ); }
vec3 h33( vec3 p ) {
  p = vec3( dot( p, vec3( 127.1, 311.7, 74.7 ) ), dot( p, vec3( 269.5, 183.3, 246.1 ) ), dot( p, vec3( 113.5, 271.9, 124.6 ) ) );
  return fract( sin( p ) * 43758.5453123 );
}
float vnoise( vec3 p ) {
  vec3 i = floor( p ); vec3 f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( h3( i ), h3( i + vec3( 1, 0, 0 ) ), f.x ), mix( h3( i + vec3( 0, 1, 0 ) ), h3( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( h3( i + vec3( 0, 0, 1 ) ), h3( i + vec3( 1, 0, 1 ) ), f.x ), mix( h3( i + vec3( 0, 1, 1 ) ), h3( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
// Worley: x = distance to the nearest feature, y = that cell's random id
vec2 cells( vec3 p ) {
  vec3 i = floor( p ); vec3 f = fract( p ); float best = 8.0; float id = 0.0;
  for ( int z = -1; z <= 1; z++ ) for ( int y = -1; y <= 1; y++ ) for ( int x = -1; x <= 1; x++ ) {
    vec3 g = vec3( x, y, z ); vec3 o = h33( i + g ); vec3 r = g + o - f; float d = dot( r, r );
    if ( d < best ) { best = d; id = h3( i + g + 7.31 ); }
  }
  return vec2( sqrt( best ), id );
}
// Skin micro-relief height in metres (pores + age lines), in reference space
float skinHeight( vec3 r ) {
  float h = 0.0;
  // pores ~0.4mm, faded out where they'd alias
  float lod = 1.0 - smoothstep( 0.25, 0.9, length( fwidth( r ) ) * 220.0 );
  if ( lod > 0.0 ) {
    vec2 c = cells( r * 220.0 );
    h -= ( 1.0 - smoothstep( 0.0, 0.42, c.x ) ) * 0.00006 * lod * ( 0.6 + 0.8 * vMaskA.x ) * ( 0.3 + uDetail );
    h += ( vnoise( r * 520.0 ) - 0.5 ) * 0.00003 * lod * ( 0.3 + uDetail );
  }
  float lines = uWrinkles + uAge * 0.6;
  if ( lines > 0.001 ) {
    float fh = vMaskC.x * lines;
    if ( fh > 0.0 ) {
      float wob = vnoise( r * vec3( 6.0, 2.0, 6.0 ) ) * 1.6;
      h -= pow( 1.0 - abs( sin( r.y * 58.0 + wob ) ), 6.0 ) * fh * 0.00035;
    }
    float cf = vMaskC.y * lines;
    if ( cf > 0.0 ) {
      vec2 d = vec2( abs( r.x ) - 0.56, r.y - 7.28 );
      float ang = atan( d.y, d.x );
      h -= pow( 1.0 - abs( sin( ang * 9.0 + vnoise( r * 30.0 ) * 1.5 ) ), 5.0 ) * cf * 0.0003;
    }
    h -= vMaskC.z * lines * 0.0012;
  }
  return h;
}
vec3 bumpNormal( vec3 surf_pos, vec3 surf_norm, float h, float strength, float faceDir ) {
  vec2 dHdxy = vec2( dFdx( h ), dFdy( h ) ) * strength;
  vec3 vSigmaX = dFdx( surf_pos.xyz );
  vec3 vSigmaY = dFdy( surf_pos.xyz );
  vec3 vN = surf_norm;
  vec3 R1 = cross( vSigmaY, vN );
  vec3 R2 = cross( vN, vSigmaX );
  float fDet = dot( vSigmaX, R1 ) * faceDir;
  vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
  return normalize( abs( fDet ) * surf_norm - vGrad );
}`
      )
      .replace('#include <lights_physical_pars_fragment>', lightsChunk)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
{
  vec3 r = vRef;
  vec3 skin = uTone;
  // gentle mottling + slightly darker extremities
  skin *= 0.94 + 0.12 * vnoise( r * 9.0 );
  // blood: cheeks, nose, ears, lips' rim
  vec3 blood = skin * vec3( 1.06, 0.78, 0.76 );
  skin = mix( skin, blood, clamp( vMaskA.x * ( 0.35 + uFlush * 1.1 ), 0.0, 1.0 ) );
  // under-eye shadows (+ lid shading)
  skin = mix( skin, skin * vec3( 0.78, 0.72, 0.8 ), vMaskA.z * uCircles * 0.9 );
  skin = mix( skin, skin * vec3( 0.88, 0.8, 0.8 ), vMaskA.y * 0.35 );
  // natural lips
  vec3 lipNat = skin * vec3( 0.95, 0.62, 0.62 );
  skin = mix( skin, lipNat, vMaskB.z * 0.85 );
  // freckles (cheeks + nose, a little everywhere on the face)
  if ( uFreckles > 0.001 ) {
    vec2 c = cells( r * 45.0 );
    float zone = clamp( vMaskA.x * 1.4 + 0.15, 0.0, 1.0 );
    float f = ( 1.0 - smoothstep( 0.12, 0.3, c.x ) ) * step( 1.0 - uFreckles * zone * 0.8, c.y );
    skin = mix( skin, skin * vec3( 0.72, 0.56, 0.45 ), f * 0.75 );
  }
  // moles + age spots
  {
    vec2 c = cells( r * 3.2 );
    float m = ( 1.0 - smoothstep( 0.02, 0.045, c.x ) ) * step( 1.0 - uMoles * 0.25, c.y );
    skin = mix( skin, skin * vec3( 0.42, 0.3, 0.25 ), m );
    if ( uAge > 0.25 ) {
      vec2 a = cells( r * 9.0 );
      float s = ( 1.0 - smoothstep( 0.05, 0.22, a.x ) ) * step( 1.0 - ( uAge - 0.25 ) * 0.5, a.y );
      skin = mix( skin, skin * vec3( 0.8, 0.68, 0.56 ), s * 0.6 );
    }
  }
  // stubble / shaved shadow: dense dark dots + a bluish-grey cast; the scalp
  // under hair (or a buzz cut) gets the same treatment in the hair colour
  if ( vMaskB.x > 0.001 ) {
    vec2 c = cells( r * 160.0 );
    float dots = 1.0 - smoothstep( 0.18, 0.42, c.x );
    float cover = clamp( vMaskB.x, 0.0, 1.0 );
    skin = mix( skin, mix( skin * vec3( 0.86, 0.88, 0.93 ), uStubbleColor, 0.25 ), cover * 0.55 );
    skin = mix( skin, uStubbleColor, dots * cover * 0.75 );
  }
  if ( vMaskB.y > 0.001 ) {
    vec2 c = cells( r * 140.0 );
    float dots = 1.0 - smoothstep( 0.2, 0.5, c.x );
    float cover = clamp( vMaskB.y, 0.0, 1.0 );
    skin = mix( skin, mix( skin, uScalpColor, 0.55 ), cover * 0.8 );
    skin = mix( skin, uScalpColor, dots * cover * 0.85 );
  }
  // painted brow underlay
  skin = mix( skin, uBrowColor, vMaskB.w * uBrowPaint * 0.45 );
  // makeup
  skin = mix( skin, uLipColor, vMaskB.z * uLips );
  float lid = vMaskA.y * smoothstep( 0.0, 1.0, vMaskA.y );
  skin = mix( skin, uShadowColor, lid * uShadow * 0.85 );
  skin = mix( skin, vec3( 0.02 ), pow( vMaskA.y, 4.0 ) * uLiner * 0.9 + pow( vMaskA.z, 5.0 ) * uLiner * 0.5 );
  skin = mix( skin, uBlushColor, smoothstep( 0.2, 1.0, vMaskA.x ) * uBlush * 0.5 );
  diffuseColor.rgb = skin;
}`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
roughnessFactor = clamp( roughnessFactor - vMaskA.x * 0.06 - vMaskB.z * ( 0.12 + uGloss * 0.3 ) + vMaskB.x * 0.08, 0.12, 1.0 );`
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
{
  float h = skinHeight( vRef );
  normal = bumpNormal( -vViewPosition, normal, h, 1.0, faceDirection );
}`
      )
      .replace(
        '#include <lights_physical_fragment>',
        /* glsl */ `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
  material.clearcoat = clamp( material.clearcoat + vMaskA.x * 0.15 + vMaskB.z * uGloss * 0.85, 0.0, 1.0 );
  material.clearcoatRoughness = mix( material.clearcoatRoughness, 0.08, vMaskB.z * uGloss );
#endif`
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
if ( uHighlight > 0.0 ) {
  float d = distance( vRef, uHighlightCenter ) / uHighlightRadius;
  float ring = smoothstep( 1.0, 0.7, d ) * ( 0.35 + 0.65 * smoothstep( 0.55, 0.95, d ) );
  totalEmissiveRadiance += vec3( 0.25, 0.45, 1.0 ) * ring * uHighlight * 0.18;
}`
      )
  }
  // Every instance shares one program
  mat.customProgramCacheKey = () => 'human3d-skin-v1'

  function setParams(p: SkinParams) {
    uniforms.uTone.value.set(p.tone)
    uniforms.uFlush.value = p.flush
    uniforms.uFreckles.value = p.freckles
    uniforms.uMoles.value = p.moles
    uniforms.uCircles.value = p.circles
    uniforms.uDetail.value = p.detail
    uniforms.uSss.value = p.sss
    uniforms.uWrinkles.value = p.wrinkles
    uniforms.uAge.value = p.age
    uniforms.uLipColor.value.set(p.lipColor)
    uniforms.uLips.value = p.lips
    uniforms.uGloss.value = p.gloss
    uniforms.uShadowColor.value.set(p.shadowColor)
    uniforms.uShadow.value = p.shadow
    uniforms.uLiner.value = p.liner
    uniforms.uBlushColor.value.set(p.blushColor)
    uniforms.uBlush.value = p.blush
    uniforms.uStubbleColor.value.set(p.stubbleColor)
    uniforms.uScalpColor.value.set(p.scalpColor)
    uniforms.uBrowColor.value.set(p.browColor)
    uniforms.uBrowPaint.value = p.browPaint
    mat.clearcoat = 0.05 + p.sheen * 0.35
    mat.clearcoatRoughness = 0.45 - p.sheen * 0.2
    mat.roughness = 0.6 - p.sheen * 0.16
  }

  return { material: mat, uniforms, setParams }
}

export type SkinMaterial = ReturnType<typeof createSkinMaterial>
