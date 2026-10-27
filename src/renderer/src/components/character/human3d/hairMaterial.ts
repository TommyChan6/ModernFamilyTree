// Strand material for hair, brows, lashes and beards — instanced ribbons.
//
// Memory layout (a long hairstyle is ~25k strands × 28 points): the strand
// POINTS live once in a float texture (xyz + "outerness"); the geometry is a
// single ribbon template (point index + side per vertex) drawn once per
// strand instance; per-strand data (width, randoms, lid/eye, root skin
// weights) are instance attributes. Tangents come from neighbouring points in
// the shader. ~10× smaller than expanding every ribbon on the CPU.
//
// Each ribbon faces the camera with a half-pixel width floor (MSAA resolves
// sub-pixel coverage); only the tips fade through alpha-to-coverage. Shading is
// Marschner-style lobes on a Kajiya–Kay base (a whitish R highlight, a
// hair-coloured TRT highlight with glints, TT back-light), wrap diffuse from
// the key and fill, strong fake volumetric self-shadowing (roots + inner
// layers much darker), per-strand + per-clump colour variation, and
// alpha-to-coverage under MSAA.
// Lashes rotate with blinks about the eye centres.

import * as THREE from 'three'

/** Shared vertex logic: fetch point + tangent, lash blink, skinning. */
const STRAND_VERTEX = /* glsl */ `
uniform sampler2D uPoints;
uniform int uPerRow;
uniform int uP;
uniform float uBlinkL, uBlinkR;
uniform vec3 uEyeL, uEyeR;
// scalp hair: blend roots (head) toward neck / chest by height
uniform float uScalpBlend;
uniform float uHeadY, uNeckY;
uniform vec3 uBlendBones;
// head centre (rig space): the hair MASS normal is radial from it on the
// head and cylindrical (from a vertical axis through it) below it
uniform vec3 uHeadC;
attribute vec2 aK;      // point index, ribbon side (−1 / +1)
attribute vec4 aStrand; // width (dm), rand, clump rand, kind
attribute vec2 aLid;    // lid (+1 upper / −1 lower / 0), eye (0 left / 1 right)

vec4 strandPoint( int k ) {
  int s = gl_InstanceID;
  ivec2 c = ivec2( ( s - ( s / uPerRow ) * uPerRow ) * uP + k, s / uPerRow );
  return texelFetch( uPoints, c, 0 );
}

vec3 lidRotate( vec3 p, vec3 c, float ang ) {
  vec3 d = p - c;
  float s = sin( ang ), co = cos( ang );
  return c + vec3( d.x, d.y * co - d.z * s, d.y * s + d.z * co );
}

// outputs: pos (bone space→rig space, skinned), tan, mass normal, t, outer
void strandSetup( out vec3 pos, out vec3 tan, out vec3 nrm, out float t, out float outer ) {
  int k = int( aK.x + 0.5 );
  vec4 here = strandPoint( k );
  vec3 prev = strandPoint( max( k - 1, 0 ) ).xyz;
  vec3 next = strandPoint( min( k + 1, uP - 1 ) ).xyz;
  pos = here.xyz;
  outer = here.w;
  tan = normalize( next - prev + 1e-7 );
  nrm = normalize( pos - vec3( uHeadC.x, min( pos.y, uHeadC.y ), uHeadC.z ) + vec3( 0.0, 0.0, 1e-5 ) );
  t = float( k ) / float( uP - 1 );
  if ( aLid.x != 0.0 ) {
    float blink = aLid.y < 0.5 ? uBlinkL : uBlinkR;
    vec3 c = aLid.y < 0.5 ? uEyeL : uEyeR;
    float ang = aLid.x > 0.0 ? blink * 0.95 : -blink * 0.12;
    pos = lidRotate( pos, c, ang );
    tan = lidRotate( tan + c, c, ang ) - c;
  }
  #ifdef USE_SKINNING
    vec4 sIdx = skinIndex;
    vec4 sW = skinWeight;
    if ( uScalpBlend > 0.5 && pos.y < uHeadY + 0.2 ) {
      float wHead = clamp( ( pos.y - uNeckY ) / ( uHeadY + 0.2 - uNeckY ), 0.0, 1.0 );
      float wChest = clamp( ( uNeckY - pos.y ) / 1.2, 0.0, 1.0 );
      sIdx = vec4( uBlendBones, 0.0 );
      sW = vec4( wHead, max( 0.0, 1.0 - wHead - wChest ), wChest, 0.0 );
    }
    mat4 boneMatX = getBoneMatrix( sIdx.x );
    mat4 boneMatY = getBoneMatrix( sIdx.y );
    mat4 boneMatZ = getBoneMatrix( sIdx.z );
    mat4 boneMatW = getBoneMatrix( sIdx.w );
    vec4 sv = bindMatrix * vec4( pos, 1.0 );
    vec4 sk = boneMatX * sv * sW.x + boneMatY * sv * sW.y + boneMatZ * sv * sW.z + boneMatW * sv * sW.w;
    pos = ( bindMatrixInverse * sk ).xyz;
    mat4 sm = sW.x * boneMatX + sW.y * boneMatY + sW.z * boneMatZ + sW.w * boneMatW;
    sm = bindMatrixInverse * sm * bindMatrix;
    tan = normalize( ( sm * vec4( tan, 0.0 ) ).xyz );
    nrm = normalize( ( sm * vec4( nrm, 0.0 ) ).xyz );
  #endif
}

float strandTaper( float t, float kind ) {
  // brows + lashes taper to a point; scalp/beard hair keeps some body
  return kind > 0.5 && kind < 2.5 ? 1.0 - t * 0.85 : 1.0 - pow( t, 1.6 ) * 0.55;
}
`

const vertexShader = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
${STRAND_VERTEX}
uniform float uPxScale;
varying vec3 vTan;
varying vec3 vWorld;
varying float vT;
varying float vRand;
varying float vOuter;
varying float vClump;
varying float vCoverage;
varying vec3 vMass;

void main() {
  vec3 pos; vec3 tan; vec3 nrm; float t; float outer;
  strandSetup( pos, tan, nrm, t, outer );
  vec4 world = modelMatrix * vec4( pos, 1.0 );
  vec3 wTan = normalize( mat3( modelMatrix ) * tan );
  vMass = normalize( mat3( modelMatrix ) * nrm );
  vec3 toCam = normalize( cameraPosition - world.xyz );
  vec3 sideDir = normalize( cross( wTan, toCam ) + 1e-5 );
  float scale = length( modelMatrix[ 0 ].xyz );
  float w = aStrand.x * strandTaper( t, aStrand.w ) * scale;
  // a floor of half a pixel keeps far strands from flickering; MSAA resolves
  // the rest geometrically (alpha-to-coverage would reuse one sample mask per
  // alpha value, so stacked strands never build up — only tips fade)
  vec4 viewPos = viewMatrix * world;
  float minW = -viewPos.z * uPxScale * 0.5;
  vCoverage = 1.0;
  w = max( w, minW );
  world.xyz += sideDir * aK.y * w * 0.5;
  vTan = wTan;
  vWorld = world.xyz;
  vT = t;
  vRand = aStrand.y;
  vOuter = outer;
  vClump = aStrand.z;
  gl_Position = projectionMatrix * viewMatrix * world;
  vec4 worldPosition = world;
  vec3 transformedNormal = normalize( ( viewMatrix * vec4( toCam, 0.0 ) ).xyz );
  #include <shadowmap_vertex>
}
`

const fragmentShader = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
uniform vec3 uRoot, uTip, uHighlight, uGreyColor;
uniform float uHighlightAmt, uGrey, uGloss, uTipFade, uDarkRoots;
uniform vec3 uKeyDir, uKeyColor, uRimDir, uRimColor, uFillDir, uFillColor, uSky, uGround;
uniform float uAmbient;
// how much the hair-MASS normal drives shading (1 = scalp hair; beards and
// brows mostly follow their own strand, or they go black under the chin)
uniform float uMass;
varying vec3 vTan;
varying vec3 vWorld;
varying float vT;
varying float vRand;
varying float vOuter;
varying float vClump;
varying float vCoverage;
varying vec3 vMass;

float kk( vec3 T, vec3 H, float e ) {
  float d = dot( T, H );
  return pow( sqrt( max( 1.0 - d * d, 0.0 ) ), e );
}
float sh1( float x ) { return fract( sin( x * 91.7 ) * 43758.5453 ); }

// One light on a strand (Marschner-style lobes on a Kajiya–Kay base):
//  R   — a near-white, tight highlight shifted toward the root;
//  TRT — a broader, hair-coloured highlight shifted toward the tip, with
//        glints that sparkle along each strand;
//  TT  — light passing through the hair when it is behind the head.
// M is the hair-MASS normal: it gives the whole hairstyle a lit side and a
// shadow side (the camera-facing ribbon normal alone lights every strand alike)
vec3 strandLight( vec3 T, vec3 N, vec3 M, vec3 V, vec3 L, vec3 col, float gloss, float occl ) {
  float TL = dot( T, L );
  float sinTL = sqrt( max( 1.0 - TL * TL, 0.0 ) );
  float ml = dot( M, L );
  float side = smoothstep( -0.45, 0.85, ml );
  // diffuse: Kajiya term wrapped around the hair volume
  float diff = sinTL * side * clamp( dot( N, L ) * 0.3 + 0.7, 0.0, 1.0 );
  vec3 H = normalize( L + V );
  float shift = ( vRand - 0.5 ) * 0.12;
  float eR = mix( 80.0, 420.0, gloss );
  float eT = mix( 14.0, 60.0, gloss );
  float r = kk( normalize( T + N * ( 0.1 + shift ) ), H, eR );
  float trt = kk( normalize( T - N * ( 0.14 + shift ) ), H, eT );
  float glint = 0.8 + 0.4 * sh1( floor( vT * 40.0 ) + vRand * 113.0 );
  vec3 spec = vec3( 0.9, 0.92, 1.0 ) * r * ( 0.08 + gloss * 0.42 )
            + col * col * 3.0 * trt * glint * ( 0.25 + gloss * 0.6 );
  float tt = pow( clamp( dot( -V, L ), 0.0, 1.0 ), 6.0 ) * ( 0.4 + 0.6 * ( 1.0 - vOuter ) );
  return col * diff * occl + spec * occl * sinTL * smoothstep( -0.2, 0.5, ml ) + col * tt * 1.4;
}

void main() {
  vec3 col = mix( uRoot, uTip, smoothstep( 0.15, 1.0, vT ) );
  if ( vClump < uHighlightAmt ) col = mix( col, uHighlight, smoothstep( 0.0, 0.4, vT ) * 0.85 );
  if ( vRand < uGrey ) col = mix( col, uGreyColor, 0.9 );
  // strand-to-strand + clump-to-clump variation (no two hairs alike)
  col *= 0.74 + vRand * 0.42;
  col *= 0.88 + vClump * 0.24;
  col = mix( col, col * vec3( 1.08, 0.98, 0.9 ), sh1( vRand * 17.0 ) * 0.5 );
  col *= mix( 1.0, 0.5, uDarkRoots * ( 1.0 - smoothstep( 0.0, 0.3, vT ) ) );

  vec3 T = normalize( vTan );
  vec3 V = normalize( cameraPosition - vWorld );
  vec3 N = normalize( V - T * dot( V, T ) + 1e-5 );
  // volumetric self-shadowing: strands deep in the mass are much darker than
  // the outer layer — this is what gives a hairstyle its depth
  float depth = smoothstep( 0.0, 1.0, vOuter );
  float occl = mix( mix( 0.55, 0.2, uMass ), 1.0, depth ) * mix( 0.5, 1.0, smoothstep( 0.0, 0.35, vT ) );

  vec3 lit = vec3( 0.0 );
  float shadow = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    shadow = mix( 0.15, 1.0, getShadowMask() );
  #endif
  vec3 M = normalize( mix( N, normalize( vMass ), uMass ) );
  lit += uKeyColor * strandLight( T, N, M, V, normalize( uKeyDir ), col, uGloss, occl ) * shadow;
  lit += uFillColor * strandLight( T, N, M, V, normalize( uFillDir ), col, uGloss * 0.6, occl );
  {
    // rims: a bright edge where the hair mass silhouettes against the light
    vec3 L = normalize( uRimDir );
    float edge = pow( 1.0 - abs( dot( M, V ) ), 2.0 );
    float fwd = pow( clamp( dot( -V, L ) * 0.5 + 0.5, 0.0, 1.0 ), 3.0 );
    float TL = dot( T, L );
    float sinTL = sqrt( max( 1.0 - TL * TL, 0.0 ) );
    float facing = smoothstep( -0.3, 0.6, dot( M, L ) );
    lit += uRimColor * ( col * ( sinTL * 0.3 * facing + fwd * 1.2 * ( 0.3 + edge ) ) + col * edge * facing * 0.8 ) * mix( 0.4, 1.0, depth );
  }
  vec3 amb = mix( uGround, uSky, M.y * 0.5 + 0.5 ) * uAmbient;
  lit += col * amb * mix( occl, occl * occl, uMass ) * 1.3;

  float alpha = vCoverage * ( 1.0 - smoothstep( 1.0 - uTipFade, 1.0, vT ) );
  if ( alpha < 0.02 ) discard;
  gl_FragColor = vec4( lit, alpha );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const depthVertex = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
${STRAND_VERTEX}
varying vec2 vHighPrecisionZW;
void main() {
  if ( aLid.x != 0.0 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; } // lashes cast no shadow
  vec3 pos; vec3 tan; vec3 nrm; float t; float outer;
  strandSetup( pos, tan, nrm, t, outer );
  vec4 world = modelMatrix * vec4( pos, 1.0 );
  vec3 wTan = normalize( mat3( modelMatrix ) * tan );
  vec3 toCam = normalize( cameraPosition - world.xyz );
  vec3 sideDir = normalize( cross( wTan, toCam ) + 1e-5 );
  float scale = length( modelMatrix[ 0 ].xyz );
  world.xyz += sideDir * aK.y * aStrand.x * scale * 1.5;
  gl_Position = projectionMatrix * viewMatrix * world;
  vHighPrecisionZW = gl_Position.zw;
}
`
const depthFragment = /* glsl */ `
#include <common>
#include <packing>
varying vec2 vHighPrecisionZW;
void main() {
  float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
  gl_FragColor = packDepthToRGBA( fragCoordZ );
}
`

function strandUniforms() {
  return {
    uPoints: { value: null as THREE.Texture | null },
    uPerRow: { value: 1 },
    uP: { value: 2 },
    uBlinkL: { value: 0 },
    uBlinkR: { value: 0 },
    uEyeL: { value: new THREE.Vector3() },
    uEyeR: { value: new THREE.Vector3() },
    uScalpBlend: { value: 0 },
    uHeadY: { value: 7 },
    uNeckY: { value: 6 },
    uBlendBones: { value: new THREE.Vector3() },
    uHeadC: { value: new THREE.Vector3(0, 7.5, 0) }
  }
}

export function createHairMaterial() {
  const shared = strandUniforms()
  const visual = {
    uRoot: { value: new THREE.Color('#3b2a1e') },
    uTip: { value: new THREE.Color('#3b2a1e') },
    uHighlight: { value: new THREE.Color('#c79a5b') },
    uGreyColor: { value: new THREE.Color('#d9d6d0') },
    uHighlightAmt: { value: 0 },
    uGrey: { value: 0 },
    uGloss: { value: 0.5 },
    uTipFade: { value: 0.18 },
    uDarkRoots: { value: 0.5 },
    uKeyDir: { value: new THREE.Vector3(0.5, 0.6, 0.6) },
    uKeyColor: { value: new THREE.Color(3, 3, 3) },
    uRimDir: { value: new THREE.Vector3(-0.5, 0.4, -0.7) },
    uRimColor: { value: new THREE.Color(1, 1, 1) },
    uFillDir: { value: new THREE.Vector3(0.6, 0.2, 0.7) },
    uFillColor: { value: new THREE.Color(0.3, 0.3, 0.3) },
    uSky: { value: new THREE.Color('#9aa6bd') },
    uGround: { value: new THREE.Color('#2a2420') },
    uAmbient: { value: 0.35 },
    uMass: { value: 1 },
    uPxScale: { value: 0.001 }
  }
  const uniforms = Object.assign(
    THREE.UniformsUtils.clone(THREE.UniformsLib.lights) as Record<string, THREE.IUniform>,
    visual,
    shared
  ) as typeof visual & typeof shared & Record<string, THREE.IUniform>
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    lights: true,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
    transparent: false
  })
  material.name = 'human3d-hair'
  // The depth material shares the strand uniform OBJECTS so both stay in sync
  const depthMaterial = new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: depthVertex,
    fragmentShader: depthFragment,
    side: THREE.DoubleSide
  })
  return { material, depthMaterial, uniforms }
}

export type HairMaterial = ReturnType<typeof createHairMaterial>

/** Max texture width used for the strand point texture. */
export const POINT_TEX_WIDTH = 4096
