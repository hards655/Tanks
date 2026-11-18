// Optional procedural surface detail for Three.js MeshStandardMaterial.
// Designed for static meshes and InstancedMesh. Keep it separate from game code
// until checked against the project's Three.js renderer.
export function addWinterSurface(material, options = {}) {
  if (!material?.isMeshStandardMaterial) {
    throw new TypeError('addWinterSurface expects MeshStandardMaterial');
  }
  const settings = {
    snow: {value: Math.max(0, Math.min(1, options.snow ?? 0.6))},
    weathering: {value: Math.max(0, Math.min(1, options.weathering ?? 0.55))},
    scale: {value: Math.max(0.01, options.scale ?? 1)}
  };
  const previousCompile = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey.bind(material);
  const cacheKey = previousKey();
  material.onBeforeCompile = function(shader, renderer) {
    previousCompile.call(this, shader, renderer);
    shader.uniforms.winterSnow = settings.snow;
    shader.uniforms.winterWeathering = settings.weathering;
    shader.uniforms.winterScale = settings.scale;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWinterPos;
varying vec3 vWinterNormal;`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
vWinterNormal = inverseTransformDirection(transformedNormal, viewMatrix);`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vec4 winterWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  winterWorld = instanceMatrix * winterWorld;
#endif
vWinterPos = (modelMatrix * winterWorld).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWinterPos;
varying vec3 vWinterNormal;
uniform float winterSnow;
uniform float winterWeathering;
uniform float winterScale;
float winterHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.37, 0.71));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float winterNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(mix(winterHash(i),winterHash(i+vec3(1,0,0)),f.x),
                 mix(winterHash(i+vec3(0,1,0)),winterHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(winterHash(i+vec3(0,0,1)),winterHash(i+vec3(1,0,1)),f.x),
                 mix(winterHash(i+vec3(0,1,1)),winterHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float winterFbm(vec3 p) {
  return 0.52*winterNoise(p) + 0.26*winterNoise(p*2.13) +
         0.14*winterNoise(p*4.37) + 0.08*winterNoise(p*9.11);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 winterP = vWinterPos * winterScale;
float winterMacro = winterFbm(winterP * 1.6);
float winterGrain = winterNoise(winterP * 125.0);
float winterSlope = normalize(vWinterNormal).y;
float winterCover = winterSnow * smoothstep(0.42,0.86,
  winterSlope + (winterMacro-0.5)*0.65);
diffuseColor.rgb *= mix(1.0,0.72+0.43*winterMacro,winterWeathering);
vec3 winterWhite = mix(vec3(0.60,0.71,0.82),vec3(0.93,0.96,0.99),
  clamp(winterMacro*0.75+winterGrain*0.25,0.0,1.0));
diffuseColor.rgb = mix(diffuseColor.rgb,winterWhite,winterCover);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor,0.76+0.17*winterMacro,winterCover);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor *= 1.0-winterCover;`);
  };
  material.customProgramCacheKey = () => cacheKey + ':winter-surface-v1';
  material.needsUpdate = true;
  return settings;
}
