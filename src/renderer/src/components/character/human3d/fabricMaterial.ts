// Fabric shader for procedural garments: a MeshPhysicalMaterial extended in
// place (keeps lights, shadows, environment, tone mapping) with
//  * crisp hems: the garment's coverage mask is alpha-clipped at 0.5 and a
//    darker, slightly raised hem band is drawn just inside the edge;
//  * patterns in REFERENCE space (aRef, the unmorphed base mesh — patterns
//    stay put through morphs and poses): stripes, pinstripes, plaid, dots,
//    gradient, camo;
//  * weave micro-normals per fabric (knit ribs, denim twill, canvas, silk),
//    soft folds that gather at elbows / knees / waist, and per-fabric
//    sheen / roughness / metalness (cotton, denim, knit, silk, leather, metal).

import * as THREE from 'three'

export const FABRICS = ['cotton', 'denim', 'knit', 'silk', 'leather', 'metal', 'canvas'] as const
export type Fabric = (typeof FABRICS)[number]

export const PATTERNS = [
  'solid',
  'stripes',
  'pinstripe',
  'plaid',
  'dots',
  'gradient',
  'camo'
] as const

export interface FabricLook {
  color: string
  color2: string
  pattern: string
  fabric: Fabric
  /** Skirt-style trims: discard fragments below this reference y (dm); −99 = off. */
  cutY?: number
  /** Shoes: below this reference y the sole (colour2, glossier) shows. */
  soleY?: number
}

const FABRIC_PARAMS: Record<
  Fabric,
  { rough: number; sheen: number; metal: number; clear: number; weave: number; scale: number }
> = {
  cotton: { rough: 0.85, sheen: 0.55, metal: 0, clear: 0, weave: 1, scale: 420 },
  denim: { rough: 0.9, sheen: 0.35, metal: 0, clear: 0, weave: 2, scale: 300 },
  knit: { rough: 0.95, sheen: 0.7, metal: 0, clear: 0, weave: 3, scale: 70 },
  silk: { rough: 0.32, sheen: 0.9, metal: 0, clear: 0.25, weave: 4, scale: 600 },
  leather: { rough: 0.5, sheen: 0.1, metal: 0, clear: 0.3, weave: 5, scale: 90 },
  metal: { rough: 0.32, sheen: 0, metal: 0.95, clear: 0.2, weave: 6, scale: 12 },
  canvas: { rough: 0.9, sheen: 0.3, metal: 0, clear: 0, weave: 1, scale: 220 }
}

export function createFabricMaterial() {
  const uniforms = {
    uColor2: { value: new THREE.Color('#e8e2d6') },
    uPattern: { value: 0 },
    uWeave: { value: 1 },
    uWeaveScale: { value: 420 },
    uCutY: { value: -99 },
    uSoleY: { value: -99 },
    uFolds: { value: 1 }
  }
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x3d4a5c,
    roughness: 0.85,
    sheen: 0.55,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(1, 1, 1),
    side: THREE.DoubleSide,
    alphaTest: 0.5
  })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 aRef;
attribute float aCover;
attribute float aFold;
varying vec3 vRef;
varying float vCover;
varying float vFold;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vRef = aRef; vCover = aCover; vFold = aFold;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vRef;
varying float vCover;
varying float vFold;
uniform vec3 uColor2;
uniform float uPattern, uWeave, uWeaveScale, uCutY, uFolds, uSoleY;
float fh( vec3 p ) { p = fract( p * vec3( 443.897, 441.423, 437.195 ) ); p += dot( p, p.yzx + 19.19 ); return fract( ( p.x + p.y ) * p.z ); }
float fn( vec3 p ) {
  vec3 i = floor( p ); vec3 f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( fh( i ), fh( i + vec3( 1, 0, 0 ) ), f.x ), mix( fh( i + vec3( 0, 1, 0 ) ), fh( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( fh( i + vec3( 0, 0, 1 ) ), fh( i + vec3( 1, 0, 1 ) ), f.x ), mix( fh( i + vec3( 0, 1, 1 ) ), fh( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
float fbm( vec3 p ) { return fn( p ) * 0.55 + fn( p * 2.1 ) * 0.3 + fn( p * 4.3 ) * 0.15; }
// fabric relief (metres) — weave + folds
float fabricHeight( vec3 r ) {
  float h = 0.0;
  float lod = 1.0 - smoothstep( 0.3, 1.0, length( fwidth( r ) ) * uWeaveScale );
  if ( lod > 0.0 ) {
    vec3 q = r * uWeaveScale;
    if ( uWeave < 1.5 ) h += ( sin( q.x * 3.1 ) * sin( q.y * 3.1 ) ) * 0.00003;               // plain weave
    else if ( uWeave < 2.5 ) h += sin( ( q.x + q.y ) * 3.1 + fn( q * 0.2 ) ) * 0.00005;      // twill
    else if ( uWeave < 3.5 ) h += pow( abs( sin( q.x * 3.14159 ) ), 0.6 ) * 0.00035;          // knit ribs
    else if ( uWeave < 4.5 ) h += fn( q * 0.5 ) * 0.00001;                                      // silk
    else if ( uWeave < 5.5 ) h += ( fn( q ) + fn( q * 3.0 ) * 0.4 ) * 0.00012;               // leather grain
    else h += ( 1.0 - smoothstep( 0.42, 0.48, abs( fract( q.y ) - 0.5 ) ) ) * 0.0006;         // metal plates
    h *= lod;
  }
  // soft drape folds, gathering where joints bend
  float folds = ( fbm( r * vec3( 1.6, 7.0, 1.6 ) ) - 0.5 ) * 0.0016 + ( fbm( r * vec3( 7.0, 1.5, 7.0 ) ) - 0.5 ) * 0.0007;
  h += folds * uFolds * ( 0.5 + vFold * 1.8 );
  return h;
}
vec3 fabricBump( vec3 surf_pos, vec3 surf_norm, float h, float faceDir ) {
  vec2 dHdxy = vec2( dFdx( h ), dFdy( h ) );
  vec3 vSigmaX = dFdx( surf_pos.xyz );
  vec3 vSigmaY = dFdy( surf_pos.xyz );
  vec3 R1 = cross( vSigmaY, surf_norm );
  vec3 R2 = cross( surf_norm, vSigmaX );
  float fDet = dot( vSigmaX, R1 ) * faceDir;
  vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
  return normalize( abs( fDet ) * surf_norm - vGrad );
}`
      )
      .replace('#include <alphatest_fragment>', `if ( vCover < 0.5 || vRef.y < uCutY ) discard;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 r = vRef;
  vec3 c1 = diffuseColor.rgb;
  vec3 c = c1;
  if ( uPattern > 0.5 && uPattern < 1.5 ) {          // stripes
    c = mix( c1, uColor2, step( 0.5, fract( r.y * 3.2 ) ) );
  } else if ( uPattern < 2.5 && uPattern > 1.5 ) {   // pinstripe
    c = mix( c1, uColor2, 1.0 - smoothstep( 0.0, 0.08, abs( fract( r.x * 6.0 + r.z * 6.0 ) - 0.5 ) * 2.0 - 0.9 ) );
  } else if ( uPattern > 2.5 && uPattern < 3.5 ) {   // plaid
    float a = step( 0.62, fract( r.x * 2.4 + r.z * 2.4 ) );
    float b = step( 0.62, fract( r.y * 2.4 ) );
    float t = step( 0.92, fract( r.x * 7.2 + r.z * 7.2 ) ) + step( 0.92, fract( r.y * 7.2 ) );
    c = mix( c1, uColor2, ( a + b ) * 0.35 );
    c = mix( c, vec3( 0.95 ), min( t, 1.0 ) * 0.25 );
  } else if ( uPattern > 3.5 && uPattern < 4.5 ) {   // dots
    vec3 q = r * 5.0;
    vec3 g = fract( q ) - 0.5;
    c = mix( c1, uColor2, 1.0 - smoothstep( 0.17, 0.2, length( g ) ) );
  } else if ( uPattern > 4.5 && uPattern < 5.5 ) {   // gradient (top → bottom)
    c = mix( uColor2, c1, smoothstep( -2.0, 5.0, r.y ) );
  } else if ( uPattern > 5.5 ) {                      // camo
    float n = fbm( r * 1.2 );
    float m = fbm( r * 2.3 + 7.0 );
    c = n < 0.42 ? c1 : n < 0.55 ? uColor2 : mix( c1, uColor2, 0.5 ) * 0.7;
    c = m > 0.62 ? c * 0.55 : c;
  }
  // denim: fade + twill colour noise
  if ( uWeave > 1.5 && uWeave < 2.5 ) c *= 0.85 + 0.3 * fn( r * vec3( 600.0, 40.0, 600.0 ) ) * fn( r * 3.0 );
  // fabric variation + hem band (stitching just inside the edge)
  c *= 0.93 + 0.14 * fn( r * 30.0 );
  // shoe soles + a contrast welt line just above them
  if ( vRef.y < uSoleY ) c = uColor2 * ( 0.92 + 0.08 * fn( r * 200.0 ) );
  c *= 1.0 - ( 1.0 - smoothstep( 0.0, 0.03, abs( vRef.y - uSoleY - 0.04 ) ) ) * 0.35 * step( -90.0, uSoleY );
  float hem = smoothstep( 0.5, 0.56, vCover ) * ( 1.0 - smoothstep( 0.56, 0.62, vCover ) );
  c *= 1.0 - hem * 0.28;
  // folds catch less light in their valleys
  c *= 0.9 + 0.1 * smoothstep( 0.3, 0.7, fbm( r * vec3( 1.6, 7.0, 1.6 ) ) );
  diffuseColor.rgb = c;
}`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
normal = fabricBump( -vViewPosition, normal, fabricHeight( vRef ), faceDirection );`
      )
  }
  mat.customProgramCacheKey = () => 'human3d-fabric-v1'

  function setLook(look: FabricLook) {
    const p = FABRIC_PARAMS[look.fabric] || FABRIC_PARAMS.cotton
    mat.color.set(look.color)
    uniforms.uColor2.value.set(look.color2)
    uniforms.uPattern.value = Math.max(0, (PATTERNS as readonly string[]).indexOf(look.pattern))
    uniforms.uWeave.value = p.weave
    uniforms.uWeaveScale.value = p.scale
    uniforms.uCutY.value = look.cutY ?? -99
    uniforms.uSoleY.value = look.soleY ?? -99
    uniforms.uFolds.value = look.fabric === 'metal' || look.fabric === 'leather' ? 0.3 : 1
    mat.roughness = p.rough
    mat.metalness = p.metal
    mat.sheen = p.sheen
    mat.sheenColor.set(look.color).lerp(new THREE.Color(1, 1, 1), 0.5)
    mat.clearcoat = p.clear
    mat.clearcoatRoughness = 0.3
  }

  return { material: mat, uniforms, setLook }
}

export type FabricMaterial = ReturnType<typeof createFabricMaterial>
