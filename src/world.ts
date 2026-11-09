import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { asset } from "./config";
import type { MapSpec } from "./types";
import type { FigureLook } from "./figures";

const GLSL_NOISE = /* glsl */ `
// Sine-free hash: sin() of large arguments loses precision on GPUs (stars vanish, patterns break far from the origin).
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
`;

// A sky picture is a window on the sky: its bottom edge is the horizon, its top edge 55 degrees up,
// and sideways it repeats mirrored so there is no seam.
const PHOTO_GLSL = /* glsl */ `
vec3 skyPhoto(sampler2D tex, vec3 d, float aspect, float t) {
  float az = atan(d.x, -d.z) / 6.2831853 * 360.0 / (55.0 * max(aspect, 0.76)) + 0.5 + t * 0.0015; // +0.5: the picture centre, not a mirror seam, faces forward
  float u = abs(fract(az * 0.5) * 2.0 - 1.0);
  // Above the top edge of the picture (55 degrees) the picture is mirrored, so looking far up shows more sky instead of a stretched last row.
  float v = 1.0 - abs(1.0 - asin(clamp(d.y, 0.0, 1.0)) / 0.9599311);
  // Stay a little inside the picture: the outermost pixels are often a dark border or JPEG edge, which shows as a line at every mirror fold.
  return texture2D(tex, vec2(0.015 + 0.97 * u, 0.01 + 0.98 * v)).rgb;
}
`;

// Night sky: NASA's deep star map (public domain, see public/sounds/CREDITS.txt) plus the moon, drawn
// additively over the physical sky (which is black at night). The map turns slowly with the hour.
const starMap = new THREE.TextureLoader().load(asset("/sky/starmap.jpg"));
starMap.colorSpace = THREE.SRGBColorSpace;
starMap.generateMipmaps = true; // blurred levels give the diffuse Milky Way glow
starMap.minFilter = THREE.LinearMipmapLinearFilter;
starMap.wrapS = THREE.RepeatWrapping;
const moonMap = new THREE.TextureLoader().load(asset("/sky/moon.jpg"));
moonMap.colorSpace = THREE.SRGBColorSpace;
const nightMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
  uniforms: {
    uMoon: { value: new THREE.Vector3() }, uMoonSize: { value: 0.095 }, uCamR: { value: new THREE.Vector3(1, 0, 0) }, uCamU: { value: new THREE.Vector3(0, 1, 0) }, uCamF: { value: new THREE.Vector3(0, 0, -1) }, uMoonTint: { value: new THREE.Vector3(0.9, 0.97, 1.1) }, uMoonGlow: { value: new THREE.Vector3(0.45, 0.62, 1.0) }, uStars: { value: 1 }, uNight: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.5 }, uAurora: { value: 0 },
    uMap: { value: starMap }, uMoonMap: { value: moonMap }, uRot: { value: new THREE.Matrix3() },
    uPhoto: { value: null as THREE.Texture | null }, uPhotoOn: { value: 0 }, uPhotoAspect: { value: 1.5 },
  },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uMoon, uMoonTint, uMoonGlow, uCamR, uCamU, uCamF; uniform float uMoonSize, uStars, uNight, uTime, uCloud, uAurora; uniform sampler2D uMap, uMoonMap, uPhoto; uniform mat3 uRot; uniform float uPhotoOn, uPhotoAspect;
    varying vec3 vDir;
    ${GLSL_NOISE}
    ${PHOTO_GLSL}
    // One meteor every PERIOD seconds, streaking for about 1.2 s along a short random arc in the forward sky.
    float meteor(vec3 d, float seed, float period) {
      float x = uTime / period + seed;
      float cyc = floor(x);
      float t = fract(x) * period / 1.2;
      if (t > 1.0) return 0.0;
      vec3 a = normalize(vec3(hash(vec2(cyc, seed + 1.0)) * 2.0 - 1.0, 0.35 + 0.5 * hash(vec2(cyc, seed + 2.0)), -0.3 - hash(vec2(cyc, seed + 3.0))));
      vec3 b = normalize(a + vec3((hash(vec2(cyc, seed + 4.0)) - 0.5) * 0.7, -0.16, 0.0));
      vec3 head = normalize(mix(a, b, t));
      vec3 tail = normalize(mix(a, b, max(t - 0.25, 0.0)));
      vec3 ab = head - tail;
      float h = clamp(dot(d - tail, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      float dist = length(normalize(tail + ab * h) - d);
      return (1.0 - smoothstep(0.0, 0.004, dist)) * h * sin(t * 3.1416);
    }
    // Point stars on a hash grid: round core plus a soft glow; sparkle > 0 adds a thin cross to the brightest ones.
    vec3 pointStars(vec3 d, float scale, float prob, float sparkle) {
      vec3 sp = d * scale;
      vec3 q = floor(sp);
      vec2 f = fract(sp).xy - 0.5;
      float on = step(1.0 - prob, hash(q.xy + q.z * 17.0 + scale));
      float mag = pow(hash(q.yz + 3.0), 3.0);
      float r = length(f);
      float s = smoothstep(mix(0.1, 0.34, mag), 0.0, r) + 0.22 * mag * exp(-r * 9.0);
      float cross_ = (smoothstep(0.035, 0.0, abs(f.x)) * smoothstep(0.5, 0.0, abs(f.y)) + smoothstep(0.035, 0.0, abs(f.y)) * smoothstep(0.5, 0.0, abs(f.x))) * mag * sparkle;
      float v = on * (s + cross_) * (0.35 + 0.65 * hash(q.zx + 7.0));
      return v * mix(vec3(0.7, 0.82, 1.0), vec3(1.0, 0.9, 0.75), hash(q.xz + 11.0));
    }
    // The moon: an anime moon picture, a tint (silver or red) and a glow. Also used over a night picture.
    vec3 addMoon(vec3 col, vec3 d){
      float md = dot(d, uMoon);
      // The disc is round on the screen, not in angle: the camera is a rectilinear projection, which stretches things near the edges
      // of the picture into ovals. So the moon is measured in the screen plane (camera right, up and forward).
      float df = dot(d, uCamF), mf = dot(uMoon, uCamF);
      vec2 mp = vec2(9.0);
      if (df > 0.05 && mf > 0.05) mp = (vec2(dot(d, uCamR), dot(d, uCamU)) / df - vec2(dot(uMoon, uCamR), dot(uMoon, uCamU)) / mf) / uMoonSize;
      float mr = length(mp);
      if (md > 0.0 && mr < 1.0) {
        // The moon picture is an anime moon seen straight on: its disc fills the picture.
        vec2 muv = mp * 0.5 + 0.5;
        col = mix(col, texture2D(uMoonMap, muv).rgb * uMoonTint * 0.5, smoothstep(1.0, 0.97, mr));
      }
      // A faint glow only outside the rim, and a disc dimmer than the bloom threshold: the moon stays crisp instead of hazy.
      col += uMoonGlow * (0.22 * exp(-max(mr - 1.0, 0.0) * 9.0) * step(0.0, md) * smoothstep(0.985, 1.03, mr) + 0.03 * pow(max(md, 0.0), 120.0));
      return col;
    }
    void main(){
      vec3 d = normalize(vDir);
      float above = smoothstep(-0.02, 0.05, d.y);
      if (uPhotoOn > 0.5) {
        vec3 ph = skyPhoto(uPhoto, d, uPhotoAspect, uTime);
        ph *= mix(1.0, 0.62, smoothstep(0.12, 0.6, d.y)); // darker overhead
        ph += vec3(0.06, 0.08, 0.15) * pow(1.0 - clamp(d.y * 2.2, 0.0, 1.0), 2.5); // brighter toward the mountains
        ph += vec3(1.0, 0.97, 0.92) * 0.5 * (meteor(d, 0.0, 19.0) + meteor(d, 0.37, 31.0)) * uStars;
        ph = addMoon(ph, d);
        gl_FragColor = vec4(ph * above * uNight * uStars * 1.9, 1.0); // x1.9: the output pass tone-maps the domes too
        #include <colorspace_fragment>
        return;
      }
      vec3 r = uRot * d;
      vec2 uv = vec2(atan(r.z, r.x) / 6.2831853 + 0.5, asin(clamp(r.y, -1.0, 1.0)) / 3.1415927 + 0.5);

      // Milky Way: the star map's blurred glow, colored blue to violet to pink with nebula patches and dark dust lanes.
      float gl = dot(textureLod(uMap, uv, 5.0).rgb, vec3(0.333));
      float broad = dot(textureLod(uMap, uv, 6.5).rgb, vec3(0.333));
      float band = smoothstep(0.012, 0.18, gl);
      float tone = fbm(uv * vec2(14.0, 7.0) + 3.0);
      vec3 blue = vec3(0.28, 0.45, 1.0), violet = vec3(0.62, 0.36, 0.95), pink = vec3(1.0, 0.45, 0.62), warm = vec3(1.0, 0.72, 0.45);
      vec3 hue = mix(mix(blue, violet, smoothstep(0.3, 0.55, tone)), pink, smoothstep(0.52, 0.72, tone) * smoothstep(0.06, 0.3, gl));
      hue = mix(hue, warm, smoothstep(0.2, 0.5, gl) * 0.45);
      vec3 mw = hue * pow(gl, 0.85) * 3.6;
      mw *= clamp((gl - broad) * 7.0 + 0.75, 0.25, 1.0);
      vec3 mapStars = pow(textureLod(uMap, uv, 0.0).rgb, vec3(1.1)) * 2.0;
      vec3 pts = pointStars(d, 300.0, 0.022 * (1.0 + 3.0 * band), 0.0) * 1.5
               + pointStars(d, 620.0, 0.03 * (1.0 + 2.5 * band), 0.0) * 0.8
               + pointStars(d, 85.0, 0.018, 1.0) * 2.2;
      vec3 sky = (mw + mapStars + pts) * uStars;
      sky += vec3(1.0, 0.97, 0.92) * 0.55 * (meteor(d, 0.0, 19.0) + meteor(d, 0.37, 31.0)) * uStars;
      // Aurora (northern maps): slow green-to-violet ribbons low in the forward sky, with fine vertical rays.
      if (uAurora > 0.0) {
        float az = atan(d.x, -d.z);
        float band = smoothstep(0.05, 0.22, d.y) * (1.0 - smoothstep(0.4, 0.9, d.y));
        float front = smoothstep(-0.5, 0.9, -d.z);
        float ribbon = fbm(vec2(az * 2.4 + uTime * 0.04, d.y * 0.9 + uTime * 0.01));
        float rays = 0.55 + 0.45 * noise(vec2(az * 38.0 + sin(uTime * 0.17 + az * 3.0) * 3.0, d.y * 2.0));
        float aur = band * front * smoothstep(0.35, 0.8, ribbon) * rays;
        sky += mix(vec3(0.12, 1.0, 0.5), vec3(0.55, 0.35, 1.0), smoothstep(0.18, 0.6, d.y)) * aur * 1.3 * uAurora;
      }

      // Moonlit clouds low in the sky: dark blue bodies with silver edges toward the moon; they hide the stars behind.
      float md = dot(d, uMoon);
      vec2 cuv = d.xz / (d.y + 0.16) * 0.9 + vec2(uTime * 0.004, 0.0);
      float cn = fbm(cuv);
      float cn2 = fbm(cuv + normalize(uMoon.xz + vec2(1e-4)) * 0.05);
      float cm = smoothstep(mix(0.82, 0.42, uCloud), mix(0.82, 0.42, uCloud) + 0.2, cn) * smoothstep(0.0, 0.07, d.y) * (1.0 - 0.8 * smoothstep(0.22, 0.8, d.y));
      float rim = clamp(0.5 + (cn - cn2) * 9.0, 0.0, 1.0);
      float moonAmt = 0.3 + 0.7 * pow(max(md, 0.0), 3.0);
      vec3 cloudCol = mix(vec3(0.012, 0.026, 0.065), vec3(0.78, 0.84, 1.0), rim * moonAmt * 0.85);
      vec3 col = sky * (1.0 - cm) * 0.7 * mix(1.0, 0.7, smoothstep(0.2, 0.7, d.y)) + cloudCol * cm * 0.9;

      col = addMoon(col, d);

      // Night glow: deep blue overhead, a warm rose haze along the horizon (distant lights on the dust).
      vec3 glow = mix(vec3(0.11, 0.06, 0.08), vec3(0.002, 0.006, 0.02), pow(clamp(d.y * 1.7, 0.0, 1.0), 0.45));
      gl_FragColor = vec4((col * above + glow) * uNight * 1.9, 1.0);
      #include <colorspace_fragment>
    }`,
});

// Daytime sky picture: replaces the physical sky while one is loaded.
const dayMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { uPhoto: { value: null as THREE.Texture | null }, uAspect: { value: 1.5 }, uLight: { value: 1 }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D uPhoto; uniform float uAspect, uLight, uTime; varying vec3 vDir;
    ${PHOTO_GLSL}
    void main(){
      vec3 d = normalize(vDir);
      vec3 c = skyPhoto(uPhoto, d, uAspect, uTime);
      c *= mix(1.0, 0.8, smoothstep(0.2, 0.8, d.y)); // a little darker overhead
      c += vec3(0.1, 0.12, 0.16) * pow(1.0 - clamp(d.y * 2.2, 0.0, 1.0), 2.5) * 0.8; // lighter toward the mountains
      gl_FragColor = vec4(c * uLight * 1.9, 1.0);
      #include <colorspace_fragment>
    }`,
});

// Haze that seeps into the sky above the horizon, so the line between sky and land dissolves.
const hazeMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, transparent: true,
  uniforms: { uHaze: { value: new THREE.Color() }, uAmt: { value: 1 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uHaze; uniform float uAmt; varying vec3 vDir;
    void main(){
      float y = max(normalize(vDir).y, 0.0);
      gl_FragColor = vec4(uHaze, 0.8 * uAmt * exp(-y * 7.0));
    }`,
});

// Rough horizon tint by sun height, used for the cloud deck and the ambient light.
const HORIZON = { day: new THREE.Color("#c9dcee"), dusk: new THREE.Color("#f0a479"), night: new THREE.Color("#141b3a") };
const NIGHT_HAZE = new THREE.Color(0.55, 0.66, 1.1); // band color at night, before tone mapping
const SKY_SCALE = 4000;
const WALL_R = 150; // radius of the panorama wall, in meters
const DECK_Y = -0.2; // height of the cloud deck; the figure stands in it
const FIGURE_SIZE = 3.1 * 0.7; // meters (the picture is square)
const FIGURE_DROP = 0.62; // meters the figure stands lower on the screen; the panorama is placed without it, so the scenery does not move
// The endless sea of clouds the figure floats above. It fades into the horizon haze with distance.
const deckMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: { value: 0 }, uHaze: { value: new THREE.Color() }, uTint: { value: new THREE.Color("#f3f8ff") }, uLight: { value: 1 }, uNight: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(0, 1, 0) } },
  vertexShader: `varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `
    uniform float uTime, uLight, uNight; uniform vec3 uHaze, uTint, uCam, uSun; varying vec3 vP;
    ${GLSL_NOISE}
    void main(){
      vec2 p = vP.xz;
      float dist = length(vP - uCam);
      // Rolling cumulus: two drifting noise layers; the near field gets finer detail than the far field.
      float n = fbm(p * 0.035 + vec2(uTime * 0.012, 0.0)) * 0.65 + fbm(p * 0.12 - vec2(uTime * 0.02, 0.0)) * 0.35;
      float puff = smoothstep(0.32, 0.78, n);
      vec3 shade = mix(vec3(0.62, 0.7, 0.86), vec3(1.0), puff);       // valleys are blue-grey, tops are white
      vec3 col = uTint * shade * (0.45 + 0.55 * uLight);
      col += vec3(1.0, 0.82, 0.62) * pow(max(uSun.y, 0.0) < 0.35 ? 1.0 - max(uSun.y, 0.0) / 0.35 : 0.0, 2.0) * puff * 0.25; // warm rim at dusk
      col = mix(col, uHaze, smoothstep(40.0, 650.0, dist));            // distance haze
      col *= mix(1.0, 0.16, uNight);
      // With a panorama behind, only the cloud bank around the figure is kept; the scenery shows beyond it.
      gl_FragColor = vec4(col * 1.9, 1.0);
      #include <colorspace_fragment>
    }`,
});

// The panorama behind the figure: a curved wall. The picture has its sky cut out (alpha), so the real sky shows
// above the scenery; the wall fades into the clouds below.
const photoMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uTex: { value: null as THREE.Texture | null }, uLight: { value: 1 }, uNight: { value: 0 }, uHaze: { value: new THREE.Color() }, uH: { value: 1 }, uE: { value: 0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: /* glsl */ `
    uniform sampler2D uTex; uniform float uLight, uNight, uH, uE; uniform vec3 uHaze; varying vec2 vUv;
    void main(){
      // The wall reaches uE meters below the picture; there the last row of the picture is stretched, so the scenery fills the bottom of the screen.
      // (Computed per pixel: per vertex, the two ends of the wall would be interpolated and the whole picture stretched.)
      float v = clamp((vUv.y * (uH + uE) - uE) / uH, 0.0, 1.0);
      vec4 c = texture2D(uTex, vec2(vUv.x, v));
      float a = c.a * smoothstep(0.0, 0.1, min(vUv.x, 1.0 - vUv.x)); // the sky is already cut out of the picture (alpha)
      vec3 col = c.rgb * (0.62 + 0.7 * uLight);
      col = mix(col, uHaze * 0.5, 0.12 * (1.0 - uLight));            // a little sky color in the dark
      col *= mix(vec3(1.0), vec3(0.6, 0.67, 0.9), uNight);              // at night the beach and the sea stay readable: a cool moonlit tint, not black
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

// The figure: a picture (with its own transparent background) of a person seen from behind on a seat of the sky.
const figureMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uTex: { value: null as THREE.Texture | null }, uLight: { value: 1 }, uNight: { value: 0 }, uWarm: { value: new THREE.Color("#ffffff") } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: /* glsl */ `
    uniform sampler2D uTex; uniform float uLight, uNight; uniform vec3 uWarm; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(uTex, vUv);
      vec3 col = c.rgb * uWarm * (0.5 + 0.6 * uLight);
      col *= mix(vec3(1.0), vec3(0.82, 0.88, 1.0), uNight); // at night the figure stays clearly readable, with a cool moonlit tint
      gl_FragColor = vec4(col * 1.9, c.a); // pre-multiplied like the domes: the output pass tone-maps once
      #include <colorspace_fragment>
    }`,
});

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.3, 7000);
  readonly yaw = 0; // the view cannot be turned sideways
  readonly pitch = 0.14;
  tilt = 0; // radians the view is tilted up (positive) or down (negative) by dragging up and down; the camera itself does not move
  night = 0;
  sunUp = true;
  moonOverride?: THREE.Vector3;
  dist = 6; // camera distance from the figure
  private windLevel = 0.4;
  private t = 0;
  private bloom!: UnrealBloomPass;
  private composer!: EffectComposer;
  private sky = new Sky();
  private hazeDome = new THREE.Mesh(new THREE.SphereGeometry(1700, 32, 16), hazeMat);
  private dayDome = new THREE.Mesh(new THREE.SphereGeometry(1790, 32, 16), dayMat);
  private dayLoaded = false;
  private stars = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 12), nightMat);
  private deck = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), deckMat);
  private sunLight = new THREE.DirectionalLight(0xffffff, 1);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.2);
  private haze = new THREE.Color();
  private photo!: THREE.Mesh;
  private figure = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), figureMat);
  private figureTexture?: THREE.Texture;
  private figureUrl = "";
  private look: FigureLook = { floats: true };
  private figureLight = 1;
  private photoTexture?: THREE.Texture;
  private map?: MapSpec;
  private mapPicture = false;
  private photoUrl: Record<"day" | "night", string | null> = { day: null, night: null };

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.4;

    this.sky.scale.setScalar(SKY_SCALE);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -2;
    this.stars.renderOrder = -1;
    this.hazeDome.renderOrder = 0;
    this.hazeDome.frustumCulled = false;
    this.dayDome.renderOrder = -1.5;
    this.dayDome.frustumCulled = false;
    this.dayDome.visible = false;
    this.stars.frustumCulled = false;
    this.deck.rotation.x = -Math.PI / 2;
    this.deck.position.y = DECK_Y;
    this.deck.renderOrder = 2.5; // after the panorama (2), before the figure (3)
    this.deck.frustumCulled = false;

    // The photo wall: 160 degrees of a cylinder around the figure, in front of the first view.
    const R = WALL_R, SPAN = 2.8, H = (R * SPAN) / (1792 / 768), E = 80;
    photoMat.uniforms.uH.value = H; photoMat.uniforms.uE.value = E;
    const wall = new THREE.CylinderGeometry(R, R, H + E, 48, 1, true, Math.PI - SPAN / 2, SPAN); // theta 0 faces +z, so this arc faces the camera at -z
    this.photo = new THREE.Mesh(wall, photoMat);
    this.photo.scale.x = -1; // the cylinder is seen from inside: mirror it back so the picture reads left to right
    this.photo.renderOrder = 2;
    this.photo.frustumCulled = false;
    this.photo.visible = false;
    this.photo.userData.height = H;

    this.figure.renderOrder = 3;
    this.figure.frustumCulled = false;
    this.figure.visible = false;
    this.scene.add(this.sky, this.dayDome, this.stars, this.hazeDome, this.deck, this.photo, this.figure, this.sunLight, this.hemi);
    this.makeEnvironment();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Only values above the threshold glow: the moon, the sun, bright stars and the horizon haze.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
    addEventListener("resize", () => this.resize());
    this.bindTilt();
  }

  private makeEnvironment() {
    const envScene = new THREE.Scene();
    const s = new Sky();
    s.scale.setScalar(50);
    const u = s.material.uniforms;
    u.sunPosition.value.set(0.6, 0.55, 0.3).normalize();
    u.cloudCoverage.value = 0.3;
    u.showSunDisc.value = 0;
    envScene.add(s);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(envScene).texture;
    pm.dispose();
  }

  /** Dragging up and down tilts the view (more sky, or more ground); sideways movement is ignored. */
  private bindTilt() {
    let last: number | null = null;
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => { last = e.clientY; try { c.setPointerCapture(e.pointerId); } catch { /* a synthetic event has no active pointer */ } });
    c.addEventListener("pointermove", (e) => {
      if (last === null) return;
      this.tilt = Math.min(0.8, Math.max(-0.12, this.tilt + (e.clientY - last) * 0.004)); // drag down: look up, like pulling the sky down
      last = e.clientY;
    });
    const end = () => (last = null);
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  }

  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setMap(m: MapSpec) {
    this.map = m;
    this.setResortPhoto(m.scenery.photo);
    deckMat.uniforms.uTint.value.set(m.scenery.cloud);
    if (m.sky.picture) { this.mapPicture = true; this.setSkyPhoto("day", m.sky.picture); }
    else if (this.mapPicture) { this.mapPicture = false; this.setSkyPhoto("day", null); } // leaving a map with its own sky picture
    nightMat.uniforms.uStars.value = m.sky.stars;
    nightMat.uniforms.uCloud.value = m.sky.clouds;
    const u = this.sky.material.uniforms;
    u.cloudCoverage.value = 0.1 + m.sky.clouds * 0.6;
    u.cloudDensity.value = 0.4 + m.sky.clouds * 0.2;
    u.turbidity.value = 1 + m.sky.haze * 9;
    u.mieCoefficient.value = 0.0025; // less forward glare, so the sun can be looked at without a white-out
    u.mieDirectionalG.value = 0.68;
    u.rayleigh.value = 0.5 + m.sky.blue * 3.5;
    this.windLevel = m.ambience.wind;
  }

  private setResortPhoto(path: string) {
    this.photo.visible = !!path;
    if (this.photoTexture?.userData.path === path) return;
    this.photoTexture?.dispose();
    this.photoTexture = undefined;
    photoMat.uniforms.uTex.value = null;
    if (!path) return;
    new THREE.TextureLoader().load(asset(path), (texture) => {
      if (this.map?.scenery.photo !== path) return texture.dispose(); // another map was picked meanwhile
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.userData.path = path;
      this.photoTexture = texture;
      photoMat.uniforms.uTex.value = texture;
    });
  }

  /** The moon is silver, or now and then a red one (a tint over the same surface picture). */
  setMoonRed(red: boolean) {
    nightMat.uniforms.uMoonTint.value.set(...(red ? [1.9, 0.38, 0.26] : [0.9, 0.97, 1.1]) as [number, number, number]);
    nightMat.uniforms.uMoonGlow.value.set(...(red ? [1.0, 0.22, 0.15] : [0.45, 0.62, 1.0]) as [number, number, number]);
  }

  /** Use a sky picture for the day or the night phase (null = the procedural sky). */
  setSkyPhoto(kind: "day" | "night", url: string | null) {
    if (url === this.photoUrl[kind]) return;
    this.photoUrl[kind] = url;
    if (!url) {
      if (kind === "night") nightMat.uniforms.uPhotoOn.value = 0;
      else this.dayLoaded = false;
      return;
    }
    new THREE.TextureLoader().load(asset(url), (tex) => {
      if (this.photoUrl[kind] !== url) return; // a newer pick arrived meanwhile
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const aspect = tex.image.width / tex.image.height;
      const slot = kind === "night" ? nightMat.uniforms : dayMat.uniforms;
      const old = slot.uPhoto.value as THREE.Texture | null;
      if (kind === "night") { slot.uPhoto.value = tex; slot.uPhotoAspect.value = aspect; slot.uPhotoOn.value = 1; }
      else { slot.uPhoto.value = tex; slot.uAspect.value = aspect; this.dayLoaded = true; }
      old?.dispose(); // free the previous picture's GPU memory
    }, undefined, () => {
      this.photoUrl[kind] = null;
      if (kind === "night") nightMat.uniforms.uPhotoOn.value = 0; else this.dayLoaded = false; // a failed load must not leave the old picture up
    });
  }

  /** A small square JPEG of the current map at noon, for its card. The frame is drawn and read in the same task,
   *  so no preserved drawing buffer is needed; the normal loop redraws the real hour right after. */
  snapshot(size = 200): string {
    const savedTilt = this.tilt;
    this.tilt = 0;
    this.update(0, 11);
    const src = this.renderer.domElement;
    const side = Math.min(src.width, src.height * 0.8);
    const out = document.createElement("canvas");
    out.width = out.height = size;
    const sy = Math.max(0, Math.min(src.height - side, src.height * 0.55 - side * 0.5));
    out.getContext("2d")!.drawImage(src, (src.width - side) / 2, sy, side, side, 0, 0, size, size);
    this.tilt = savedTilt;
    return out.toDataURL("image/jpeg", 0.82);
  }

  /** Show a figure: a picture with a transparent background, shown standing in front of the scenery. */
  setFigure(url: string, look: FigureLook = { floats: true }) {
    this.look = look;
    if (url === this.figureUrl) return;
    this.figureUrl = url;
    this.figure.visible = false;
    new THREE.TextureLoader().load(asset(url), (texture) => {
      if (this.figureUrl !== url) return texture.dispose(); // another figure was picked meanwhile
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      this.figureTexture?.dispose();
      this.figureTexture = texture;
      figureMat.uniforms.uTex.value = texture;
      this.figure.visible = true;
    }, undefined, () => { if (this.figureUrl === url) this.figureUrl = ""; });
  }

  update(dt: number, hour: number) {
    if ((this.map?.sky.hour ?? -1) >= 0) hour = this.map!.sky.hour; // a map can keep one time of day (a sunset that never ends)
    this.t += dt;

    this.updateSky(hour);

    // Place the figure: the person of every picture sits where the person of the sun lounger sits (same head position and size), but the
    // drawing never goes below the sand line of the lounger. Everything except the lounger floats: it bobs and sways.
    const S = FIGURE_SIZE, REF = { x: 0.55, y: 0.23, d: 0.30, bottom: 0.92 };
    const baseY = DECK_Y - 0.12 - FIGURE_DROP;             // bottom of the lounger picture
    const refCy = baseY + S * 0.5;                          // its centre
    const groundY = refCy + S * (0.5 - REF.bottom);         // the lowest drawn row of the lounger, in meters
    const hd = this.look.head, bf = this.look.bottom ?? 0.95;
    const k = hd ? Math.min(1.5, Math.max(0.8, REF.d / hd[2])) : 1, S2 = S * k;
    let cx = 0, cy = groundY - S2 * (0.5 - bf);
    if (hd) {
      cx = (REF.x - 0.5) * S - (hd[0] - 0.5) * S2;
      cy = refCy + S * (0.5 - REF.y) - S2 * (0.5 - hd[1]);
      const low = cy + S2 * (0.5 - bf);
      if (low < groundY) cy += groundY - low;
    }
    const f = this.look.floats;
    const bob = f ? 0.1 + 0.09 * Math.sin(this.t * 1.1) + 0.04 * Math.sin(this.t * 0.5 + 1) : 0; // hovers 10 cm above the sand line and sways around that
    this.figure.scale.set(S2, S2, 1);
    this.figure.position.set(cx + (f ? 0.03 * Math.sin(this.t * 0.7) : 0), cy + bob, 0);
    this.figure.rotation.set(0, this.yaw, f ? 0.025 * Math.sin(this.t * 0.8) : 0);

    const target = new THREE.Vector3(0, 0.9, 0);
    const d = this.dist, p = this.pitch;
    const bx = Math.sin(this.yaw), bz = Math.cos(this.yaw);
    this.camera.position.set(target.x + bx * Math.cos(p) * d, target.y + 0.4 + Math.sin(p) * d, target.z + bz * Math.cos(p) * d);
    // Face the same way for every pitch: the front of the view is -z, so the wall sits straight ahead at yaw 0.
    // The resting view looks 2.8 degrees down; dragging up and down tilts it (the panorama and the figure stay put in the world).
    this.camera.lookAt(target.x, this.camera.position.y - 0.575 + 11.94 * Math.tan(this.tilt), target.z - 6);
    // The camera's right, up and forward vectors, for the moon (see addMoon in the night shader).
    this.camera.updateMatrixWorld();
    const fw = this.camera.getWorldDirection(new THREE.Vector3()), rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)).normalize();
    nightMat.uniforms.uCamF.value.copy(fw);
    nightMat.uniforms.uCamR.value.copy(rt);
    nightMat.uniforms.uCamU.value.crossVectors(rt, fw);
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.dayDome.position.copy(this.camera.position);
    this.hazeDome.position.copy(this.camera.position);
    this.deck.position.x = this.camera.position.x;
    this.deck.position.z = this.camera.position.z;
    // The picture is placed so that its row "stand" (where the sand is) lies at the feet of the figure: the figure never stands in the sea.
    const camY = this.camera.position.y;
    const feetY = DECK_Y - 0.12; // bottom of the figure picture before it is lowered: the panorama is placed for this height
    const rowY = camY - WALL_R * Math.tan(Math.atan((camY - feetY) / this.dist)); // height on the wall that appears at the feet
    const h = this.photo.userData.height as number, E = photoMat.uniforms.uE.value as number;
    this.photo.position.set(0, rowY - 0.5 * h + h * (this.map?.scenery.stand ?? 0.85) - E / 2, 0);

    figureMat.uniforms.uLight.value = this.figureLight;
    figureMat.uniforms.uNight.value = this.night;
    this.deck.visible = !this.photo.visible; // with a panorama there is no cloud floor: the scenery reaches the bottom of the screen
    deckMat.uniforms.uTime.value = this.t;
    deckMat.uniforms.uCam.value.copy(this.camera.position);
    this.composer.render();
  }

  private updateSky(hour: number) {
    const a = ((hour - 6) / 24) * Math.PI * 2;
    // The arc leans toward the front (-z): the sun rises on the right of the view and sets on the left.
    const sun = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.85, -0.6).normalize();
    const e = sun.y;
    const day = smooth(0, 0.35, e);
    const [from, to, t] = e > 0 ? [HORIZON.dusk, HORIZON.day, day] : [HORIZON.dusk, HORIZON.night, smooth(0, -0.25, e)];
    const hor = from.clone().lerp(to, t);
    this.night = e > 0 ? 0 : t;
    const light = 0.28 + 0.72 * smooth(-0.1, 0.3, e);
    this.sunUp = e > 0;
    // A day picture replaces the physical sky until the sun is well below the horizon.
    const showDay = this.dayLoaded && e > -0.12;
    this.dayDome.visible = showDay;
    this.sky.visible = !showDay;
    dayMat.uniforms.uLight.value = smooth(-0.12, 0.25, e);
    dayMat.uniforms.uTime.value = this.t;

    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(sun);
    u.time.value = this.t;
    u.cloudSpeed.value = 0.00002 * (0.5 + this.windLevel * 2);
    // The moon crosses the view once a night: it rises on the right at 18:00, climbs to about 15 degrees at midnight and sets on the left
    // at 06:00, so it always stays on the screen (a real moon path would carry it far above the top edge).
    const np = ((((hour - 18) % 24) + 24) % 24) / 12; // 0 at 18:00, 1 at 06:00, up to 2 by day (below the horizon)
    const az = THREE.MathUtils.degToRad(38 - 76 * np), el = THREE.MathUtils.degToRad(3 + 12 * Math.sin(Math.PI * np));
    nightMat.uniforms.uMoon.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    if (this.moonOverride) nightMat.uniforms.uMoon.value.copy(this.moonOverride).normalize(); // debugging aid: pin the moon somewhere
    nightMat.uniforms.uNight.value = this.night;
    nightMat.uniforms.uTime.value = this.t;
    // The sky turns about a pole tilted 37 degrees from the horizon, one revolution per day.
    const axis = new THREE.Vector3(0, Math.sin(0.65), -Math.cos(0.65));
    nightMat.uniforms.uRot.value.setFromMatrix4(new THREE.Matrix4().makeRotationAxis(axis, -(hour / 24) * Math.PI * 2));

    // Horizon band: scales with daylight, plus a cool glow of its own so the line never disappears at night.
    this.haze.copy(hor).multiplyScalar(4.6 * (0.12 + 0.88 * light)).add(NIGHT_HAZE.clone().multiplyScalar(this.night));
    hazeMat.uniforms.uHaze.value.copy(this.haze);
    hazeMat.uniforms.uAmt.value = 1;
    deckMat.uniforms.uHaze.value.copy(hor).multiplyScalar(0.5 + 0.5 * light);
    deckMat.uniforms.uLight.value = light;
    deckMat.uniforms.uNight.value = this.night;
    deckMat.uniforms.uSun.value.copy(sun);
    this.figureLight = light;
    figureMat.uniforms.uWarm.value.set("#ffffff").lerp(new THREE.Color("#ffb88a"), (1 - day) * (e > 0 ? 1 : 0) * 0.5); // warm at dusk
    photoMat.uniforms.uLight.value = light;
    photoMat.uniforms.uNight.value = this.night;
    photoMat.uniforms.uHaze.value.copy(hor);

    const lightDir = e > -0.05 ? sun : sun.clone().multiplyScalar(-1);
    this.sunLight.position.copy(lightDir).multiplyScalar(50);
    this.sunLight.color.set("#fff0d8").lerp(new THREE.Color("#b8c8ff"), this.night).lerp(new THREE.Color("#ffb27a"), (1 - day) * (e > 0 ? 1 : 0) * 0.8);
    this.sunLight.intensity = 0.3 + 2.4 * smooth(-0.05, 0.4, Math.abs(lightDir.y)) * (e > -0.05 ? 1 : 0.15);
    this.hemi.color.copy(hor);
    // Glow on the moon and stars at night; by day the sky itself is bright everywhere, so it must not bloom.
    this.bloom.enabled = this.night > 0.02;
    this.bloom.strength = 0.1 + 0.2 * this.night;
    this.hemi.intensity = 0.05 + 0.2 * light;
    this.scene.environmentIntensity = 0.1 + 0.6 * light;
  }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
