import * as THREE from 'three'

// Instanced camera-facing ribbons (plus arrowhead triangles) for the Space (3D)
// graph type. Each link is one instance: the vertex shader stretches a unit
// quad between the two endpoint attributes and widens it perpendicular to the
// view direction, so links always present their face to the camera. Dashes are
// world-unit arc length (straight segments), exactly like the 2D LinkMaterial.

function fogChunk() {
  return /* glsl */ `
    uniform vec2 uFogRange;
    float fogAt(vec3 viewPos) {
      return clamp((-viewPos.z - uFogRange.x) / max(uFogRange.y - uFogRange.x, 1.0), 0.0, 1.0);
    }
  `
}

export function createLink3DMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uFogColor: { value: new THREE.Color(0x0f1117) },
      uFogRange: { value: new THREE.Vector2(1200, 5200) }
    },
    vertexShader: /* glsl */ `
      // position.x = t along the link (0..1), position.y = side (-1..1)
      in vec3 iStart;
      in vec3 iEnd;
      in vec3 iColor;
      in float iOpacity;
      in vec2 iDash;
      in float iWidth;

      out vec3 vColor;
      out float vOpacity;
      out vec2 vDash;
      out float vArc;
      out float vFog;

      ${fogChunk()}

      void main() {
        float t = position.x;
        float side = position.y;
        vec3 A = (modelViewMatrix * vec4(iStart, 1.0)).xyz;
        vec3 B = (modelViewMatrix * vec4(iEnd, 1.0)).xyz;
        vec3 P = mix(A, B, t);
        vec3 seg = B - A;
        float segLen = max(length(seg), 1e-5);
        vec3 dir = seg / segLen;
        vec3 sideV = cross(dir, normalize(-P));
        float sl = length(sideV);
        if (sl > 1e-4) { sideV /= sl; } else { sideV = vec3(1.0, 0.0, 0.0); }
        P += sideV * (iWidth * 0.5) * side;
        vColor = iColor;
        vOpacity = iOpacity;
        vDash = iDash;
        vArc = t * segLen;
        vFog = fogAt(P);
        gl_Position = projectionMatrix * vec4(P, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uFogColor;
      in vec3 vColor;
      in float vOpacity;
      in vec2 vDash;
      in float vArc;
      in float vFog;
      out vec4 fragColor;
      void main() {
        if (vDash.x > 0.0) {
          float period = vDash.x + vDash.y;
          if (mod(vArc, period) > vDash.x) discard;
        }
        float a = vOpacity * (1.0 - vFog * 0.7);
        if (a < 0.01) discard;
        fragColor = vec4(mix(vColor, uFogColor, vFog * 0.75), a);
      }
    `
  })
}

export function createArrow3DMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uNodeRadius: { value: 22 },
      uFogColor: { value: new THREE.Color(0x0f1117) },
      uFogRange: { value: new THREE.Vector2(1200, 5200) }
    },
    vertexShader: /* glsl */ `
      // Template triangle: tip at origin pointing +x, body trailing behind.
      in vec3 iStart;
      in vec3 iEnd;
      in float iScale;
      in vec3 iColor;

      out vec3 vColor;
      out float vAlpha;
      out float vFog;

      uniform float uNodeRadius;
      ${fogChunk()}

      void main() {
        vec3 A = (modelViewMatrix * vec4(iStart, 1.0)).xyz;
        vec3 B = (modelViewMatrix * vec4(iEnd, 1.0)).xyz;
        vec3 seg = B - A;
        float segLen = max(length(seg), 1e-5);
        vec3 dir = seg / segLen;
        vec3 tip = B - dir * (uNodeRadius + 2.0);
        vec3 sideV = cross(dir, normalize(-tip));
        float sl = length(sideV);
        if (sl > 1e-4) { sideV /= sl; } else { sideV = vec3(1.0, 0.0, 0.0); }
        vec3 P = tip + dir * (position.x * iScale) + sideV * (position.y * iScale);
        vColor = iColor;
        vAlpha = iScale > 0.001 ? 0.9 : 0.0;
        vFog = fogAt(P);
        gl_Position = projectionMatrix * vec4(P, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uFogColor;
      in vec3 vColor;
      in float vAlpha;
      in float vFog;
      out vec4 fragColor;
      void main() {
        float a = vAlpha * (1.0 - vFog * 0.7);
        if (a < 0.01) discard;
        fragColor = vec4(mix(vColor, uFogColor, vFog * 0.75), a);
      }
    `
  })
}

export class Link3DLayer {
  constructor() {
    this.capacity = 0
    this.count = 0
    this.material = createLink3DMaterial()
    this.arrowMaterial = createArrow3DMaterial()
    this.mesh = new THREE.Mesh()
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 2
    this.arrowMesh = new THREE.Mesh()
    this.arrowMesh.frustumCulled = false
    this.arrowMesh.renderOrder = 2
    this._attr = {}
    this._arr = {}
    this._allocate(16)
  }

  get object3d() {
    return this.mesh
  }
  get arrowObject3d() {
    return this.arrowMesh
  }

  _allocate(capacity) {
    this.mesh.geometry?.dispose()
    const g = new THREE.InstancedBufferGeometry()
    // Unit quad: x = t (0..1), y = side (-1..1)
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3)
    )
    g.setIndex([0, 1, 2, 2, 1, 3])
    const mk = (name, size) => {
      const arr = new Float32Array(capacity * size)
      const a = new THREE.InstancedBufferAttribute(arr, size)
      a.setUsage(THREE.DynamicDrawUsage)
      g.setAttribute(name, a)
      this._attr[name] = a
      return arr
    }
    this.start = mk('iStart', 3)
    this.end = mk('iEnd', 3)
    this.color = mk('iColor', 3)
    this.opacity = mk('iOpacity', 1)
    this.dash = mk('iDash', 2)
    this.width = mk('iWidth', 1)
    g.instanceCount = this.count
    this.geometry = g
    this.mesh.geometry = g
    this.mesh.material = this.material

    // Arrowheads share the endpoint attributes (their own copies).
    this.arrowMesh.geometry?.dispose()
    const ag = new THREE.InstancedBufferGeometry()
    ag.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, -1, -0.55, 0, -1, 0.55, 0], 3)
    )
    ag.setIndex([0, 1, 2])
    const amk = (name, size) => {
      const arr = new Float32Array(capacity * size)
      const a = new THREE.InstancedBufferAttribute(arr, size)
      a.setUsage(THREE.DynamicDrawUsage)
      ag.setAttribute(name, a)
      this._arr[name] = a
      return arr
    }
    this.aStart = amk('iStart', 3)
    this.aEnd = amk('iEnd', 3)
    this.aScale = amk('iScale', 1)
    this.aColor = amk('iColor', 3)
    ag.instanceCount = this.count
    this.arrowGeometry = ag
    this.arrowMesh.geometry = ag
    this.arrowMesh.material = this.arrowMaterial
    this.capacity = capacity
  }

  setCount(n) {
    if (n > this.capacity) this._allocate(Math.ceil(n * 1.3) + 8)
    this.count = n
    this.geometry.instanceCount = n
    this.arrowGeometry.instanceCount = n
  }

  // Per-frame endpoints (positions move every sim tick / drag).
  writeEndpoints(i, ax, ay, az, bx, by, bz) {
    this.start[i * 3] = ax
    this.start[i * 3 + 1] = ay
    this.start[i * 3 + 2] = az
    this.end[i * 3] = bx
    this.end[i * 3 + 1] = by
    this.end[i * 3 + 2] = bz
    this.aStart[i * 3] = ax
    this.aStart[i * 3 + 1] = ay
    this.aStart[i * 3 + 2] = az
    this.aEnd[i * 3] = bx
    this.aEnd[i * 3 + 1] = by
    this.aEnd[i * 3 + 2] = bz
  }

  // Style-change-only writes (colour / opacity / dash / width / arrow).
  writeStyle(i, s) {
    this.color[i * 3] = s.color[0]
    this.color[i * 3 + 1] = s.color[1]
    this.color[i * 3 + 2] = s.color[2]
    this.opacity[i] = s.opacity
    this.dash[i * 2] = s.dashLen || 0
    this.dash[i * 2 + 1] = s.dashGap || 0
    this.width[i] = s.width
    this.aScale[i] = s.arrowColorRGB ? s.arrowSize : 0
    if (s.arrowColorRGB) {
      this.aColor[i * 3] = s.arrowColorRGB[0]
      this.aColor[i * 3 + 1] = s.arrowColorRGB[1]
      this.aColor[i * 3 + 2] = s.arrowColorRGB[2]
    }
  }

  commitEndpoints() {
    if (!this._attr.iStart) return
    this._attr.iStart.needsUpdate = true
    this._attr.iEnd.needsUpdate = true
    this._arr.iStart.needsUpdate = true
    this._arr.iEnd.needsUpdate = true
  }

  commitStyles() {
    if (!this._attr.iColor) return
    for (const k of ['iColor', 'iOpacity', 'iDash', 'iWidth']) this._attr[k].needsUpdate = true
    for (const k of ['iScale', 'iColor']) this._arr[k].needsUpdate = true
  }

  setNodeRadius(r) {
    this.arrowMaterial.uniforms.uNodeRadius.value = r
  }

  setFog(colorHex, near, far) {
    for (const m of [this.material, this.arrowMaterial]) {
      m.uniforms.uFogColor.value.set(colorHex)
      m.uniforms.uFogRange.value.set(near, far)
    }
  }

  dispose() {
    this.geometry?.dispose()
    this.arrowGeometry?.dispose()
    this.material?.dispose()
    this.arrowMaterial?.dispose()
  }
}
