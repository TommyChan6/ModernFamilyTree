import * as THREE from 'three'

// Ribbon material for all link curves. Dashes are computed from world-unit arc length so
// they scale with zoom exactly like SVG stroke-dasharray did inside the zoomed group.
export function createLinkMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      in vec3 aColor;
      in float aArc;
      in vec2 aDash;     // (dashLen, gapLen) in world units; dashLen<=0 => solid
      in float aOpacity;
      out vec3 vColor;
      out float vArc;
      out vec2 vDash;
      out float vOpacity;
      void main() {
        vColor = aColor; vArc = aArc; vDash = aDash; vOpacity = aOpacity;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec3 vColor;
      in float vArc;
      in vec2 vDash;
      in float vOpacity;
      out vec4 fragColor;
      void main() {
        if (vDash.x > 0.0) {
          float period = vDash.x + vDash.y;
          if (mod(vArc, period) > vDash.x) discard;
        }
        fragColor = vec4(vColor, vOpacity);
      }
    `,
  })
}

// Instanced arrowhead material (one triangle per parent/adopted link, oriented along the
// curve's end tangent). Colour + scale are per-instance so lineage emphasis can animate them.
export function createArrowMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      in vec2 iPos;
      in float iAngle;
      in float iScale;
      in vec3 iColor;
      out vec3 vColor;
      out float vAlpha;
      void main() {
        vColor = iColor;
        vAlpha = iScale > 0.001 ? 0.9 : 0.0;
        float c = cos(iAngle), s = sin(iAngle);
        vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
        vec2 world = iPos + p * iScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec3 vColor;
      in float vAlpha;
      out vec4 fragColor;
      void main() {
        if (vAlpha < 0.01) discard;
        fragColor = vec4(vColor, vAlpha);
      }
    `,
  })
}
