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
// Kajiya–Kay with two shifted specular lobes (Scheuermann), wrap diffuse,
// fake volumetric self-shadowing (roots + inner layers darker), per-strand
// colour variation for greys / highlights, and alpha-to-coverage under MSAA.
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

// outputs: pos (bone space→rig space, skinned), tan, t, outer
void strandSetup( out vec3 pos, out vec3 tan, out float t, out float outer ) {
  int k = int( aK.x + 0.5 );
  vec4 here = strandPoint( k );
  vec3 prev = strandPoint( max( k - 1, 0 ) ).xyz;
  vec3 next = strandPoint( min( k + 1, uP - 1 ) ).xyz;
  pos = here.xyz;
  outer = here.w;
  tan = normalize( next - prev + 1e-7 );
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

void main() {
  vec3 pos; vec3 tan; float t; float outer;
  strandSetup( pos, tan, t, outer );
  vec4 world = modelMatrix * vec4( pos, 1.0 );
  vec3 wTan = normalize( mat3( modelMatrix ) * tan );
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
uniform vec3 uKeyDir, uKeyColor, uRimDir, uRimColor, uSky, uGround;
uniform float uAmbient;
varying vec3 vTan;
varying vec3 vWorld;
varying float vT;
varying float vRand;
varying float vOuter;
varying float vClump;
varying float vCoverage;

float kk( vec3 T, vec3 H, float e ) {
  float d = dot( T, H );
  return pow( sqrt( max( 1.0 - d * d, 0.0 ) ), e );
}

void main() {
  vec3 col = mix( uRoot, uTip, smoothstep( 0.15, 1.0, vT ) );
  if ( vClump < uHighlightAmt ) col = mix( col, uHighlight, smoothstep( 0.0, 0.4, vT ) * 0.85 );
  if ( vRand < uGrey ) col = mix( col, uGreyColor, 0.9 );
  col *= 0.86 + vRand * 0.28;
  col *= mix( 1.0, 0.55, uDarkRoots * ( 1.0 - smoothstep( 0.0, 0.25, vT ) ) );

  vec3 T = normalize( vTan );
  vec3 V = normalize( cameraPosition - vWorld );
  vec3 N = normalize( V - T * dot( V, T ) + 1e-5 );
  float occl = mix( 0.42, 1.0, vOuter ) * mix( 0.55, 1.0, smoothstep( 0.0, 0.35, vT ) );

  vec3 lit = vec3( 0.0 );
  float shadow = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    shadow = getShadowMask();
  #endif
  {
    vec3 L = normalize( uKeyDir );
    float TL = dot( T, L );
    float diff = mix( 0.25, 1.0, sqrt( max( 1.0 - TL * TL, 0.0 ) ) ) * clamp( dot( N, L ) * 0.5 + 0.6, 0.0, 1.0 );
    vec3 H = normalize( L + V );
    float shift = ( vRand - 0.5 ) * 0.15;
    float s1 = kk( normalize( T + N * ( 0.08 + shift ) ), H, mix( 60.0, 260.0, uGloss ) );
    float s2 = kk( normalize( T - N * ( 0.12 + shift ) ), H, mix( 18.0, 70.0, uGloss ) );
    vec3 spec = mix( vec3( 1.0 ), col * 2.5, 0.35 ) * 0.13 * s1 * uGloss + col * s2 * ( 0.35 + uGloss * 0.6 );
    lit += uKeyColor * ( col * diff + spec * occl ) * shadow;
  }
  {
    vec3 L = normalize( uRimDir );
    float fwd = pow( clamp( dot( -V, L ) * 0.5 + 0.5, 0.0, 1.0 ), 3.0 );
    float TL = dot( T, L );
    float diff = sqrt( max( 1.0 - TL * TL, 0.0 ) ) * 0.4;
    lit += uRimColor * col * ( diff + fwd * 1.6 );
  }
  vec3 amb = mix( uGround, uSky, N.y * 0.5 + 0.5 ) * uAmbient;
  lit += col * amb * 1.6;
  lit *= occl;

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
  vec3 pos; vec3 tan; float t; float outer;
  strandSetup( pos, tan, t, outer );
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
    uBlendBones: { value: new THREE.Vector3() }
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
    uSky: { value: new THREE.Color('#9aa6bd') },
    uGround: { value: new THREE.Color('#2a2420') },
    uAmbient: { value: 0.35 },
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
