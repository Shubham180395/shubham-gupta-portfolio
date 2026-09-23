import * as THREE from 'three';

const canvas = document.getElementById('gl');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
// <html data-no-contact-orb> keeps the orb from returning behind the contact section (its video takes that spot)
const contactOrb = !document.documentElement.hasAttribute('data-no-contact-orb');

THREE.ColorManagement.enabled = false;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
  throw e;
}
window.__glReady = true;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0, 9);

/* ───────── shared GLSL: Ashima 3D simplex noise ───────── */
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/* ───────── orb ───────── */
const uniforms = {
  uTime: { value: 0 },
  uAmp: { value: 0.17 },
  uFreq: { value: 1.15 },
  uPulse: { value: 0 },
  uHover: { value: 0 },
  uMouseDir: { value: new THREE.Vector3(0, 0, 1) },
  uA: { value: new THREE.Color('#b9a4ff') },
  uB: { value: new THREE.Color('#5fd3c0') },
  uFade: { value: 1 },
};

const orbMat = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  vertexShader: /* glsl */`
    uniform float uTime, uAmp, uFreq, uPulse, uHover;
    uniform vec3 uMouseDir;
    varying vec3 vN; varying vec3 vView; varying float vD; varying vec3 vObj; varying float vB;
    ${NOISE}
    float disp(vec3 p){
      vec3 q = p * uFreq;
      float n = snoise(q + vec3(0., uTime * .16, uTime * .11));
      n += snoise(q * 2.3 - uTime * .09) * .32;
      float b = pow(max(dot(normalize(p), uMouseDir), 0.), 5.) * uHover;
      return n * uAmp + b * .38 + uPulse * snoise(p * 3.5 + uTime * 2.) * .22;
    }
    void main(){
      vec3 n = normalize(position);
      vec3 t = normalize(cross(n, abs(n.y) < .99 ? vec3(0.,1.,0.) : vec3(1.,0.,0.)));
      vec3 b = cross(n, t);
      float e = .012;
      float d0 = disp(n);
      vec3 p0 = n * (1. + d0);
      vec3 n1 = normalize(n + t * e); vec3 p1 = n1 * (1. + disp(n1));
      vec3 n2 = normalize(n + b * e); vec3 p2 = n2 * (1. + disp(n2));
      vec3 nn = normalize(cross(p1 - p0, p2 - p0));
      vN = normalize(normalMatrix * nn);
      vD = d0; vObj = p0;
      vB = pow(max(dot(n, uMouseDir), 0.), 4.) * uHover;
      vec4 mv = modelViewMatrix * vec4(p0, 1.);
      vView = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uA, uB; uniform float uFade, uTime;
    varying vec3 vN; varying vec3 vView; varying float vD; varying vec3 vObj; varying float vB;
    void main(){
      vec3 N = normalize(vN); vec3 V = normalize(vView);
      float ndv = max(dot(N, V), 0.);
      float fres = pow(1. - ndv, 1.4);
      // topographic contour lines from the displacement field
      float h = vD * 7. + vObj.y * 1.6 + uTime * .05;
      float f = fract(h * 2.2);
      float w = fwidth(h * 2.2) * 1.8;
      float line = 1. - smoothstep(0., w, min(f, 1. - f));
      float grad = smoothstep(-.8, .8, N.y * .6 + N.x * .4 + vD * 3.2);
      vec3 tint = mix(uB, uA, clamp(grad + vB * 1.6, 0., 1.));
      vec3 L = normalize(vec3(.55, .8, .6));
      float diff = max(dot(N, L), 0.);
      vec3 col = vec3(.02, .02, .03);
      col += tint * (.07 + .3 * diff);
      col += tint * line * (.75 + fres * .5);
      col += mix(uB, uA, clamp(fres * 1.3 + .15, 0., 1.)) * fres * 1.5;
      // hover reaction: the surface under the cursor swells and glows in the accent colour
      col += uA * vB * (.35 + line * 1.4);
      col += pow(max(dot(reflect(-L, N), V), 0.), 32.) * .6;
      col = col / (1. + col * .2);
      gl_FragColor = vec4(col, uFade);
    }`,
});

const detail = coarse ? 40 : 72;
const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), orbMat);
const orbGroup = new THREE.Group();
orbGroup.add(orb);
scene.add(orbGroup);

/* halo ring of particles orbiting the orb */
const RING_N = coarse ? 380 : 700;
const ringGeo = new THREE.BufferGeometry();
{
  const p = new Float32Array(RING_N * 3), s = new Float32Array(RING_N);
  for (let i = 0; i < RING_N; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.55 + Math.pow(Math.random(), 2) * .55;
    p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = (Math.random() - .5) * .05; p[i * 3 + 2] = Math.sin(a) * r;
    s[i] = Math.random();
  }
  ringGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  ringGeo.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
}
const ringMat = new THREE.ShaderMaterial({
  uniforms: { uA: uniforms.uA, uB: uniforms.uB, uFade: uniforms.uFade, uPx: { value: 1 }, uTime: uniforms.uTime },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute float aSeed; uniform float uPx, uTime; varying float vS;
    void main(){
      vS = aSeed;
      vec3 p = position;
      float a = uTime * (.12 + aSeed * .1);
      p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_PointSize = uPx * (1.2 + aSeed * 2.4) * (9. / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uA, uB; uniform float uFade; varying float vS;
    void main(){
      float d = length(gl_PointCoord - .5); if (d > .5) discard;
      gl_FragColor = vec4(mix(uB, uA, vS), (1. - d * 2.) * .8 * uFade);
    }`,
});
const ring = new THREE.Points(ringGeo, ringMat);
ring.rotation.set(1.15, 0, .35);
orbGroup.add(ring);

/* ───────── ambient particle field ───────── */
const FIELD_N = coarse ? 650 : 1500;
const fieldGeo = new THREE.BufferGeometry();
{
  const p = new Float32Array(FIELD_N * 3), s = new Float32Array(FIELD_N);
  for (let i = 0; i < FIELD_N; i++) {
    p[i * 3] = (Math.random() - .5) * 22;
    p[i * 3 + 1] = (Math.random() - .5) * 14;
    p[i * 3 + 2] = -Math.random() * 10 + 2;
    s[i] = Math.random();
  }
  fieldGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  fieldGeo.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
}
const fieldMat = new THREE.ShaderMaterial({
  uniforms: { uTime: uniforms.uTime, uA: uniforms.uA, uB: uniforms.uB, uMouse: { value: new THREE.Vector2(99, 99) }, uScroll: { value: 0 }, uPx: { value: 1 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    attribute float aSeed; uniform float uTime, uScroll, uPx; uniform vec2 uMouse; varying float vS; varying float vA;
    void main(){
      vS = aSeed;
      vec3 p = position;
      float depth = (2. - p.z) / 12.;
      p.y = mod(p.y + uScroll * (1.2 - depth * .8) + 7., 14.) - 7.;
      p.x += sin(uTime * .15 + aSeed * 40.) * .25;
      p.y += cos(uTime * .12 + aSeed * 30.) * .2;
      // repel from the cursor, scaled for depth
      vec2 m = uMouse * (1. + (2. - p.z) / 9.);
      vec2 d = p.xy - m; float dist = length(d);
      p.xy += normalize(d + 1e-4) * smoothstep(1.8, 0., dist) * .9;
      vA = .35 + smoothstep(1.8, 0., dist) * .65;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_PointSize = uPx * (1. + aSeed * 2.2) * (9. / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uA, uB; varying float vS; varying float vA;
    void main(){
      float d = length(gl_PointCoord - .5); if (d > .5) discard;
      vec3 c = vS > .86 ? uA : (vS > .72 ? uB : vec3(.85));
      gl_FragColor = vec4(c, (1. - d * 2.) * vA * .7);
    }`,
});
const field = new THREE.Points(fieldGeo, fieldMat);
scene.add(field);

/* ───────── layout ───────── */
let W = 1, H = 1, viewW = 1, viewH = 1;
const layout = { hx: 0, hy: 0, hs: 1, cx: 0, cy: 0, cs: 1 };
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  viewH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  viewW = viewH * camera.aspect;
  const px = renderer.getPixelRatio() * (H / 900);
  ringMat.uniforms.uPx.value = px * 1.6;
  fieldMat.uniforms.uPx.value = px * 1.6;
  if (W > 820) {
    layout.hs = Math.min(viewW * .135, viewH * .23);
    layout.hx = viewW / 2 - layout.hs * 1.6 - viewW * .035;
    layout.hy = -viewH * .02;
  } else {
    layout.hs = Math.min(viewW * .3, viewH * .165);
    layout.hx = viewW * .1;
    layout.hy = viewH * .27;
  }
  layout.cs = Math.min(viewW * .26, viewH * .34);
  layout.cy = -viewH * .04;
}
addEventListener('resize', resize);
resize();

/* ───────── input ───────── */
const ndc = new THREE.Vector2(9, 9);
const mouseWorld = new THREE.Vector2(99, 99);
const look = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const sphereHit = new THREE.Sphere();
const hitPoint = new THREE.Vector3();
let hovering = false, dragging = false, downX = 0, downY = 0, lastX = 0, lastY = 0, dragDist = 0;
let velX = 0, velY = 0, pointerType = 'mouse';

function updatePointer(e) {
  ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
  mouseWorld.set(ndc.x * viewW / 2, ndc.y * viewH / 2);
  look.copy(ndc);
}
function hitTest() {
  if (uniforms.uFade.value < .4) return false;
  raycaster.setFromCamera(ndc, camera);
  sphereHit.set(orbGroup.position, orbGroup.scale.x * 1.18);
  return !!raycaster.ray.intersectSphere(sphereHit, hitPoint);
}
const blocked = t => t.closest && t.closest('a, button, input, summary, details, .flow, .sphere, .tilt, .stack, nav, .mobile-menu');

addEventListener('pointermove', e => {
  pointerType = e.pointerType;
  updatePointer(e);
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    velY += dx * .0035; velX += dy * .0035;
    lastX = e.clientX; lastY = e.clientY;
    dragDist = Math.max(dragDist, Math.hypot(e.clientX - downX, e.clientY - downY));
    return;
  }
  const h = e.pointerType === 'mouse' && hitTest() && !blocked(e.target);
  if (h !== hovering) {
    hovering = h;
    window.dispatchEvent(new CustomEvent('orb:hover', { detail: h }));
  }
}, { passive: true });

addEventListener('pointerdown', e => {
  if (blocked(e.target)) return;
  updatePointer(e);
  if (!hitTest()) return;
  downX = lastX = e.clientX; downY = lastY = e.clientY; dragDist = 0;
  if (e.pointerType === 'mouse') { dragging = true; document.body.style.userSelect = 'none'; }
  else { dragging = false; canvas.dataset.tap = '1'; }
});
addEventListener('pointerup', e => {
  if (dragging) {
    dragging = false;
    document.body.style.userSelect = '';
    if (dragDist < 5) fireClick();
  } else if (canvas.dataset.tap) {
    delete canvas.dataset.tap;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) < 10) fireClick();
  }
});
function fireClick() {
  pulse = 1;
  window.dispatchEvent(new CustomEvent('orb:click'));
}
document.documentElement.addEventListener('pointerleave', () => { ndc.set(9, 9); mouseWorld.set(99, 99); look.set(0, 0); });

/* palette transitions */
const targetA = new THREE.Color('#b9a4ff'), targetB = new THREE.Color('#5fd3c0');
window.addEventListener('palette', e => {
  targetA.set(e.detail.a); targetB.set(e.detail.b);
  pulse = Math.max(pulse, .8);
});

/* ───────── loop ───────── */
let pulse = 0, t = 0, last = performance.now();
const contact = document.getElementById('contact');
const smooth = { x: layout.hx, y: layout.hy, s: 0, fade: 1 };
const localDir = new THREE.Vector3();
const inv = new THREE.Matrix4();
const tmp = new THREE.Vector3();

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const dt = Math.max(0, Math.min((now - last) / 1000, .05)); last = Math.max(last, now);
  t += dt * (reduced ? .25 : 1);
  uniforms.uTime.value = t;

  // scroll choreography: hero → fade out, contact → return centred
  const heroK = Math.min(scrollY / H, 1.6);
  const cr = contact.getBoundingClientRect();
  const contactK = THREE.MathUtils.clamp(1 - (cr.top + cr.height * .25) / H, 0, 1);
  const heroFade = 1 - THREE.MathUtils.smoothstep(heroK, .45, 1.05);
  const contactFade = contactOrb ? THREE.MathUtils.smoothstep(contactK, .1, .6) * .5 : 0;
  const useContact = contactFade > heroFade;
  const tx = useContact ? layout.cx : layout.hx + heroK * viewW * .06;
  const ty = useContact ? layout.cy : layout.hy + heroK * viewH * .42;
  const ts = useContact ? layout.cs : layout.hs * (1 - heroK * .25);
  const tf = Math.max(heroFade, contactFade);

  const k = 1 - Math.pow(.001, dt);
  if (Math.abs(smooth.fade - tf) > .5 || smooth.fade < .02) { smooth.x = tx; smooth.y = ty; smooth.s = ts; }
  smooth.x += (tx - smooth.x) * k * 1.4;
  smooth.y += (ty - smooth.y) * k * 1.4;
  smooth.s += (ts - smooth.s) * k * 1.4;
  smooth.fade += (tf - smooth.fade) * Math.min(1, k * 2);
  uniforms.uFade.value = smooth.fade;
  orbGroup.visible = smooth.fade > .01;
  orbGroup.position.set(smooth.x, smooth.y, 0);
  orbGroup.scale.setScalar(smooth.s * (1 + pulse * .06));

  // rotation: idle spin + drag inertia + gentle mouse follow
  velX *= .93; velY *= .93;
  orb.rotation.x += velX + (reduced ? 0 : .0008);
  orb.rotation.y += velY + (reduced ? 0 : .0022);
  const followX = hovering || dragging ? 0 : look.y * .18, followY = hovering || dragging ? 0 : look.x * .25;
  orbGroup.rotation.x += (-followX - orbGroup.rotation.x) * .04;
  orbGroup.rotation.y += (followY - orbGroup.rotation.y) * .04;
  ring.rotation.z += dt * .05;

  // cursor bulge direction in orb-local space
  tmp.set(mouseWorld.x, mouseWorld.y, 1.8).sub(orbGroup.position);
  orb.updateMatrixWorld();
  inv.copy(orb.matrixWorld).invert();
  localDir.copy(tmp).add(orbGroup.position).applyMatrix4(inv).normalize();
  uniforms.uMouseDir.value.lerp(localDir, .15).normalize();
  const near = Math.max(0, 1 - Math.hypot(mouseWorld.x - smooth.x, mouseWorld.y - smooth.y) / (smooth.s * 2.4));
  uniforms.uHover.value += (((dragging ? 1 : near) * (pointerType === 'mouse' ? 1 : 0)) - uniforms.uHover.value) * .08;
  uniforms.uAmp.value = .16 + uniforms.uHover.value * .06 + (dragging ? .05 : 0);

  pulse *= Math.pow(.02, dt);
  uniforms.uPulse.value = pulse;

  uniforms.uA.value.lerp(targetA, .04);
  uniforms.uB.value.lerp(targetB, .04);

  fieldMat.uniforms.uScroll.value = scrollY / H * 2.2;
  fieldMat.uniforms.uMouse.value.lerp(mouseWorld, .12);

  camera.position.x += (look.x * .25 * (hovering ? 0 : 1) - camera.position.x) * .03;
  camera.position.y += (look.y * .18 * (hovering ? 0 : 1) - camera.position.y) * .03;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
