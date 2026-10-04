'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { sceneState } from './scene-state';

/*
 * The archive, told in five scenes. Every document is a paper card in one instanced draw call
 * (plus a soft shadow pass); the vertex shader blends each card between its places in the story.
 * Three actors carry the meaning — the documents, the person asking, and the AI:
 *
 *   0  catalogue  cards stand in drawers like a library index; near the cursor they slide up
 *   1  index      the drawers open into one flat wall: everything the company keeps
 *   2  clearance  an access badge ("Sam, Support") scans the wall; readable cards turn blue with a
 *                 check, the rest fade to outlines with a red lock — for this person they are gone
 *   3  answer     the AI core appears; only readable cards stream into it (outlines never move),
 *                 and the cited ones come back out, numbered like the answer's sources
 *   4  vault      every card locks into four concentric rings, turning like a combination dial
 *
 * The canvas has its own region of the page (never behind text); every formation fits BOUNDS,
 * and the camera distance is computed from the region's shape each frame.
 */

const CARD = { w: 0.2, h: 0.266 };
const BOUNDS = { w: 6.2, h: 7.6 };
const WALL2 = { scale: 0.8, x: 0.55, y: -0.4 }; // the wall, shifted to make room for the badge
const SCAN = { from: -2.0, to: 3.1 };
const CORE = new THREE.Vector3(1.55, 0.1, 0.35);
const CITED = { x: -1.35, z: 0.9, scale: 2.1, gap: 1.75 };
const BADGE = new THREE.Vector3(-1.2, 3.2, 0.4);
const COLORS = { blue: '#2f5bff', ink: '#0b0d12', muted: '#5b6270', red: '#e5484d' };

const citedPosition = (k: number) => new THREE.Vector3(CITED.x, CITED.gap * (2 - k), CITED.z);

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Builds every formation once, as per-instance attributes. */
function buildArchive(compact: boolean, lowPower: boolean): THREE.InstancedBufferGeometry {
  const thin = (compact ? 1.35 : 1) * (lowPower ? 1.3 : 1);
  const cols = Math.round(24 / thin);
  const rows = Math.round(18 / thin);
  const count = cols * rows;
  const rand = seeded(11);

  const attr = (size: number) => new Float32Array(count * size);
  const catalog = attr(3);
  const wall = attr(3);
  const stream = attr(2);
  const ring = attr(4);
  const scatter = attr(3);
  const seed = attr(1);
  const clearance = attr(2);
  const cited = attr(1);

  // Catalogue: 3 columns x 4 levels of drawers, cards standing front to back in each.
  const drawers = 12;
  const perDrawer = Math.ceil(count / drawers);
  // Vault: four rings, cards shared out by circumference.
  const radii = [0.95, 1.6, 2.25, 2.9];
  const ringTotal = radii.reduce((a, r) => a + r, 0);
  const ringOf = (i: number) => {
    const f = i / count;
    let acc = 0;
    for (let k = 0; k < radii.length; k += 1) {
      acc += radii[k]! / ringTotal;
      if (f < acc) return k;
    }
    return radii.length - 1;
  };

  for (let i = 0; i < count; i += 1) {
    seed[i] = rand();

    const drawer = Math.floor(i / perDrawer);
    const j = i % perDrawer;
    const dx = [-1.15, 0, 1.15][drawer % 3]!;
    const dy = [2.4, 0.8, -0.8, -2.4][Math.floor(drawer / 3)]!;
    catalog.set(
      [dx + (rand() - 0.5) * 0.02, dy + (rand() - 0.5) * 0.03, -1.7 + (j / perDrawer) * 3.4],
      i * 3,
    );

    const c = i % cols;
    const r = Math.floor(i / cols);
    const sx = BOUNDS.w / cols;
    const sy = (BOUNDS.h - 0.4) / rows;
    wall.set([(c - (cols - 1) / 2) * sx, ((rows - 1) / 2 - r) * sy, 0], i * 3);

    stream.set([rand(), rand() * Math.PI * 2], i * 2);

    const k = ringOf(i);
    ring.set([k, rand() * Math.PI * 2, radii[k]!, k % 2 === 0 ? 1 : -1], i * 4);

    const u = rand() * Math.PI * 2;
    const v = Math.acos(2 * rand() - 1);
    const d = 8 + rand() * 6;
    scatter.set(
      [Math.sin(v) * Math.cos(u) * d, Math.cos(v) * d * 0.7, Math.sin(v) * Math.sin(u) * d - 4],
      i * 3,
    );

    // Who may read it: Sam (support) about half, Dana (finance) a superset of Sam.
    const sam = rand() < 0.5 ? 1 : 0;
    clearance.set([sam, sam || rand() < 0.55 ? 1 : 0], i * 2);
  }

  // The answer's three sources: two readable by both people, the third only by Dana. They sit in
  // the left part of the wall so the scan reaches them early.
  const leftColumn = Math.round(cols * 0.18);
  [
    [1, 1],
    [1, 1],
    [0, 1],
  ].forEach(([sam, dana], k) => {
    const index = (Math.round(rows * (0.25 + k * 0.25)) * cols + leftColumn) % count;
    clearance.set([sam!, dana!], index * 2);
    cited[index] = k + 1;
  });

  const plane = new THREE.PlaneGeometry(CARD.w, CARD.h);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute('position', plane.getAttribute('position'));
  geometry.setAttribute('uv', plane.getAttribute('uv'));
  const set = (name: string, data: Float32Array, size: number) =>
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(data, size));
  set('aCatalog', catalog, 3);
  set('aWall', wall, 3);
  set('aStream', stream, 2);
  set('aRing', ring, 4);
  set('aScatter', scatter, 3);
  set('aSeed', seed, 1);
  set('aClear', clearance, 2);
  set('aCited', cited, 1);
  geometry.instanceCount = count;
  return geometry;
}

const f = (n: number) => n.toFixed(3);

const VERTEX = /* glsl */ `
  attribute vec3 aCatalog;
  attribute vec3 aWall;
  attribute vec2 aStream;
  attribute vec4 aRing;
  attribute vec3 aScatter;
  attribute float aSeed;
  attribute vec2 aClear;
  attribute float aCited;

  uniform float uTime;
  uniform float uStage;
  uniform float uIntro;
  uniform float uScanPersona;
  uniform float uScan;
  uniform vec3 uPointer;
  uniform float uLens;
  uniform float uYaw;
  uniform float uShadow;

  varying vec2 vUv;
  varying float vSeed;
  varying float vReadable;
  varying float vLocked;
  varying float vCited;
  varying float vLift;
  varying float vRing;
  varying float vAngle;
  varying float vVault;
  varying float vShade;

  float ease(float t) { return t * t * (3.0 - 2.0 * t); }
  // Each transition starts just after its chapter begins and is complete by the chapter's rest point.
  float phase(float k) { return ease(clamp((uStage - k - 0.1) * 1.7 - aSeed * 0.5, 0.0, 1.0)); }

  vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
  vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }

  void main() {
    vUv = uv;
    vSeed = aSeed;
    float cleared = mix(aClear.x, aClear.y, uScanPersona);
    float isCited = step(0.5, aCited);

    float s1 = phase(0.0);
    float s2 = phase(1.0);
    float s3 = phase(2.0);
    float s4 = phase(3.0);

    // 0 — catalogue, seen from a three-quarter angle; cards near the cursor slide up.
    vec3 catalog = rotX(rotY(aCatalog, uYaw), 0.2);
    float lens = smoothstep(0.9, 0.0, distance(catalog.xy, uPointer.xy)) * uLens * (1.0 - s1);
    catalog.y += lens * 0.32;
    vLift = lens;

    // 2 — the wall makes room for the badge; the scan reveals each card's verdict as it passes.
    vec3 wall2 = aWall * ${f(WALL2.scale)} + vec3(${f(WALL2.x)}, ${f(WALL2.y)}, 0.0);
    float scanX = mix(${f(SCAN.from)}, ${f(SCAN.to)}, uScan);
    float revealed = step(wall2.x, scanX);
    vec3 verdict = wall2 + vec3(0.0, 0.0, revealed * mix(-0.35, 0.12, cleared));

    // 3 — readable, uncited cards stream into the AI core and are absorbed; outlines stay put;
    //     the cited sources come back out, enlarged, toward the answer.
    // Readable cards are absorbed one after another; a few keep trickling in once the rest are in.
    float trickle = step(aStream.x, 0.1);
    float p = mix(clamp(s3 * 1.6 - aStream.x * 0.6, 0.0, 1.0), fract(aStream.y * 0.159 + uTime * 0.12), trickle * step(0.999, s3));
    vec3 core = vec3(${f(CORE.x)}, ${f(CORE.y)}, ${f(CORE.z)});
    vec3 bend = mix(wall2, core, 0.5) + vec3(0.0, 0.9 * sin(aStream.y), 0.6);
    vec3 streamed = mix(mix(wall2, bend, p), mix(bend, core, p), p);
    vec3 citedPos = vec3(${f(CITED.x)}, ${f(CITED.gap)} * (2.0 - aCited), ${f(CITED.z)});
    vec3 answer = mix(verdict, streamed, cleared * (1.0 - isCited));
    answer = mix(answer, citedPos, isCited * cleared);

    // 4 — vault: four rings turning in alternate directions.
    float angle = aRing.y + uTime * 0.07 * aRing.w * (1.0 + aRing.x * 0.25);
    vec3 vault = vec3(cos(angle) * aRing.z, sin(angle) * aRing.z, 0.0);

    vec3 pos = mix(catalog, aWall, s1);
    pos = mix(pos, verdict, s2);
    pos = mix(pos, answer, s3);
    pos = mix(pos, vault, s4);

    float intro = ease(clamp(uIntro * 1.6 - aSeed * 0.6, 0.0, 1.0));
    pos = mix(aScatter, pos, intro);

    // Orientation: catalogue cards follow the cabinet; vault cards lie along their ring.
    vec3 n = normalize(mix(rotX(rotY(vec3(0.0, 0.0, 1.0), uYaw), 0.2), vec3(0.0, 0.0, 1.0), s1));
    float roll = (angle + 1.5708) * s4;
    vec3 up = normalize(vec3(-sin(roll), cos(roll), 0.0));
    vec3 right = normalize(cross(up, n));
    up = normalize(cross(n, right));

    float scale = mix(1.45, 1.0, s1) * mix(0.3, 1.0, intro);
    float inStream = cleared * (1.0 - isCited) * s3 * (1.0 - s4);
    scale *= mix(1.0, 1.0 - p * p, inStream);
    scale *= mix(1.0, ${f(CITED.scale)}, isCited * cleared * s3 * (1.0 - s4));
    scale *= mix(1.0, 1.08, lens);

    vReadable = cleared * revealed * s2 * (1.0 - s4);
    vLocked = (1.0 - cleared) * revealed * s2 * (1.0 - s4);
    vCited = isCited * cleared * s3 * (1.0 - s4);
    vRing = s4 * aRing.x;
    vAngle = angle;
    vVault = s4;
    vShade = s1;

    vec3 world = pos + (right * position.x + up * position.y) * scale * mix(1.0, 1.1, uShadow);
    // The shadow pass: offset down-right and back; ghost outlines cast none.
    world += uShadow * vec3(0.03, -0.045, -0.03) * scale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
    if (uShadow > 0.5 && vLocked > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uShadow;
  varying vec2 vUv;
  varying float vSeed;
  varying float vReadable;
  varying float vLocked;
  varying float vCited;
  varying float vLift;
  varying float vRing;
  varying float vAngle;
  varying float vVault;
  varying float vShade;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float segment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
  }

  void main() {
    // Card space in units of card width (cards are 3:4).
    vec2 q = vec2(vUv.x, vUv.y * 1.333);

    if (uShadow > 0.5) {
      vec2 d = min(vUv, 1.0 - vUv);
      float soft = smoothstep(0.0, 0.18, min(d.x, d.y));
      gl_FragColor = vec4(0.04, 0.06, 0.12, 0.14 * soft * vShade);
      return;
    }

    vec3 white = vec3(1.0);
    vec3 border = vec3(0.84, 0.86, 0.9);
    vec3 grey = vec3(0.62, 0.65, 0.71);
    vec3 ink = vec3(0.043, 0.051, 0.071);
    vec3 blue = vec3(0.184, 0.357, 1.0);
    vec3 red = vec3(0.898, 0.282, 0.302);

    vec2 e = min(vUv, 1.0 - vUv);
    float edge = min(e.x, e.y * 1.333);
    float hairline = 1.0 - step(0.035, edge);

    // Locked: only an outline and a lock remain — the document is gone for this person.
    if (vLocked > 0.5) {
      vec2 c = vec2(0.5, 0.62);
      float body = step(abs(q.x - c.x), 0.17) * step(abs(q.y - c.y), 0.13);
      float shackle = step(abs(length(q - (c + vec2(0.0, 0.13))) - 0.11), 0.035) * step(c.y + 0.13, q.y);
      float lockMark = max(body, shackle);
      if (hairline < 0.5 && lockMark < 0.5) discard;
      gl_FragColor = vec4(mix(border, red, max(lockMark, 0.35)), 1.0);
      return;
    }

    vec3 color = mix(white, vec3(0.86, 0.9, 1.0), vReadable);

    // A document: a dark title line, then grey lines of text.
    float row = floor((1.0 - vUv.y) * 10.0);
    float inRow = fract((1.0 - vUv.y) * 10.0);
    float len = 0.35 + 0.5 * hash(vec2(row, vSeed * 97.0));
    float text = step(0.16, vUv.x) * step(vUv.x, 0.16 + len * 0.7) * step(2.5, row) * step(row, 8.5) * step(0.38, inRow) * step(inRow, 0.6);
    float title = step(0.16, vUv.x) * step(vUv.x, 0.66) * step(0.9, row) * step(row, 1.1) * step(0.15, inRow) * step(inRow, 0.85);
    color = mix(color, grey, text);
    color = mix(color, ink, title);

    // Readable: a blue spine and a check badge.
    float spine = step(vUv.x, 0.08) * step(0.04, vUv.y) * step(vUv.y, 0.96);
    vec2 badge = vec2(0.8, 1.333 - 0.2);
    float badgeDisc = step(length(q - badge), 0.13);
    float check = step(min(segment(q, badge + vec2(-0.06, 0.0), badge + vec2(-0.015, -0.045)),
                          segment(q, badge + vec2(-0.015, -0.045), badge + vec2(0.065, 0.05))), 0.022);
    color = mix(color, blue, vReadable * max(spine, badgeDisc));
    color = mix(color, white, vReadable * badgeDisc * check);

    // Cited: a blue frame.
    float frame = 1.0 - step(0.06, edge);
    color = mix(color, blue, vCited * frame);

    // Lifted from the drawer: a hint of blue.
    color = mix(color, blue, vLift * spine * 0.9);

    // Vault: a band of blue sweeps around each ring in turn.
    float sweep = pow(max(cos(vAngle - uTime * 0.5 - vRing * 1.6), 0.0), 18.0);
    color = mix(color, blue, vVault * sweep * 0.85);

    color = mix(color, border, hairline * (1.0 - vCited));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const RIM_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
    vec3 color = mix(vec3(0.043, 0.051, 0.071), vec3(0.184, 0.357, 1.0), rim);
    gl_FragColor = vec4(color, uOpacity);
  }
`;
const RIM_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalMatrix * normal;
    vView = -world.xyz;
    gl_Position = projectionMatrix * world;
  }
`;

/** Text drawn into a texture (badge, labels, source numbers), in the page's own font. */
function textTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const PEOPLE = [
  { name: 'Sam', role: 'Support' },
  { name: 'Dana', role: 'Finance' },
];

function badgeTexture(person: (typeof PEOPLE)[number], font: string) {
  return textTexture(
    (ctx, w, h) => {
      roundRect(ctx, 4, 4, w - 8, h - 8, 36);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#d6dae1';
      ctx.stroke();
      ctx.fillStyle = COLORS.blue;
      ctx.fillRect(4, 40, 18, h - 80);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `500 34px ${font}`;
      ctx.fillText('Access badge', 64, 82);
      ctx.fillStyle = COLORS.ink;
      ctx.font = `700 86px ${font}`;
      ctx.fillText(person.name, 60, 186);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `500 44px ${font}`;
      ctx.fillText(person.role, 64, 250);
    },
    600,
    300,
  );
}

function labelTexture(text: string, font: string) {
  return textTexture(
    (ctx, w, h) => {
      roundRect(ctx, 3, 3, w - 6, h - 6, (h - 6) / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#d6dae1';
      ctx.stroke();
      ctx.fillStyle = COLORS.blue;
      ctx.beginPath();
      ctx.arc(46, h / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.font = `600 46px ${font}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 74, h / 2 + 2);
    },
    320,
    88,
  );
}

function numberTexture(n: number, font: string) {
  return textTexture(
    (ctx, w, h) => {
      ctx.fillStyle = COLORS.blue;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 76px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), w / 2, h / 2 + 4);
    },
    128,
    128,
  );
}

function Archive({ compact, lowPower, font }: { compact: boolean; lowPower: boolean; font: string }) {
  const geometry = useMemo(() => buildArchive(compact, lowPower), [compact, lowPower]);
  const cards = useRef<THREE.ShaderMaterial>(null);
  const shadows = useRef<THREE.ShaderMaterial>(null);
  const drawerFrames = useRef<THREE.LineSegments>(null);
  const badge = useRef<THREE.Mesh>(null);
  const scanLine = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Group>(null);
  const coreMaterial = useRef<THREE.ShaderMaterial>(null);
  const links = useRef<THREE.LineSegments>(null);
  const markers = useRef<THREE.Group>(null);
  const motion = useRef({
    stage: 0,
    intro: 0,
    lens: 0,
    px: 0,
    py: 0,
    scan: 0,
    scanPersona: 0,
    scanning: false,
  });

  const makeUniforms = (shadow: number) => ({
    uTime: { value: 0 },
    uStage: { value: 0 },
    uIntro: { value: 0 },
    uScanPersona: { value: 0 },
    uScan: { value: 0 },
    uPointer: { value: new THREE.Vector3() },
    uLens: { value: 0 },
    uYaw: { value: -0.55 },
    uShadow: { value: shadow },
  });
  const cardUniforms = useMemo(() => makeUniforms(0), []);
  const shadowUniforms = useMemo(() => makeUniforms(1), []);
  const coreUniforms = useMemo(() => ({ uOpacity: { value: 0 } }), []);

  // The drawers of the catalogue, as hairline boxes.
  const drawerGeometry = useMemo(() => {
    const box = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.42, 0.5, 3.7));
    const merged: number[] = [];
    const positions = box.getAttribute('position');
    for (const dx of [-1.15, 0, 1.15]) {
      for (const dy of [2.4, 0.8, -0.8, -2.4]) {
        for (let i = 0; i < positions.count; i += 1) {
          merged.push(positions.getX(i) + dx, positions.getY(i) + dy - 0.06, positions.getZ(i));
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(merged, 3));
    return geometry;
  }, []);

  // Labels are drawn into textures, so wait for the web font before drawing them.
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let live = true;
    const done = () => live && setFontReady(true);
    document.fonts.load(`700 40px ${font}`).then(done, done);
    return () => {
      live = false;
    };
  }, [font]);
  const textures = useMemo(() => {
    const family = fontReady ? font : 'system-ui, sans-serif';
    return {
      badges: PEOPLE.map((p) => badgeTexture(p, family)),
      coreLabel: labelTexture('AI model', family),
      numbers: [1, 2, 3].map((n) => numberTexture(n, family)),
    };
  }, [font, fontReady]);
  useEffect(
    () => () => {
      [...textures.badges, textures.coreLabel, ...textures.numbers].forEach((t) => t.dispose());
    },
    [textures],
  );
  const linkGeometry = useMemo(() => {
    const points = [1, 2, 3].flatMap((k) => [
      CORE,
      citedPosition(k)
        .clone()
        .add(new THREE.Vector3(0.2, 0, 0)),
    ]);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    sceneState.invalidate = invalidate;
    return () => {
      sceneState.invalidate = null;
    };
  }, [invalidate]);

  useFrame((state, delta) => {
    const { camera, size } = state;
    const m = motion.current;
    const reduced = sceneState.reducedMotion || lowPower;
    const dt = Math.min(delta, 0.05);
    const k = (rate: number) => (reduced ? 1 : 1 - Math.exp(-rate * dt));
    const time = reduced ? 0 : state.clock.elapsedTime;

    m.intro += (1 - m.intro) * (reduced ? 1 : dt * 0.6);
    m.stage += (sceneState.stage - m.stage) * k(5);
    const lensTarget = sceneState.pointer.active && !reduced ? Math.max(0, 1 - m.stage * 1.6) : 0;
    m.lens += (lensTarget - m.lens) * k(6);

    // The scan runs when the clearance chapter arrives, and again for each change of person.
    if (m.stage < 1.35) {
      m.scanning = false;
      m.scan = 0;
    } else if (!m.scanning || m.scanPersona !== sceneState.persona) {
      m.scanning = true;
      m.scanPersona = sceneState.persona;
      m.scan = 0;
    }
    if (m.scanning) m.scan = reduced ? 1 : Math.min(1, m.scan + dt / 1.8);

    // Fit the formations to the canvas region.
    const perspective = camera as THREE.PerspectiveCamera;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
    const aspect = size.width / Math.max(size.height, 1);
    const fitZ = Math.max(BOUNDS.h / 2 / tanHalf, BOUNDS.w / 2 / (tanHalf * aspect)) * 1.04;
    const halfH = tanHalf * fitZ;
    m.px += (sceneState.pointer.x * halfH * aspect - m.px) * k(10);
    m.py += (sceneState.pointer.y * halfH - m.py) * k(10);

    const yaw = -0.55 + Math.sin(time * 0.15) * 0.12;
    for (const material of [cards.current, shadows.current]) {
      if (!material) continue;
      const u = material.uniforms;
      u.uTime!.value = time;
      u.uStage!.value = m.stage;
      u.uIntro!.value = Math.min(1, m.intro * 1.02);
      u.uScanPersona!.value = m.scanPersona;
      u.uScan!.value = m.scan;
      u.uLens!.value = m.lens;
      u.uYaw!.value = yaw;
      (u.uPointer!.value as THREE.Vector3).set(m.px, m.py, 0);
    }

    const between = (from: number, span = 1) => Math.min(1, Math.max(0, (m.stage - from) / span));
    if (drawerFrames.current) {
      drawerFrames.current.rotation.set(0.2, yaw, 0, 'XYZ');
      (drawerFrames.current.material as THREE.LineBasicMaterial).opacity =
        0.55 * (1 - between(0.15, 0.5)) * m.intro;
    }

    // Clearance actors: the badge of the person asking, and the scan line.
    const clearance = between(1.4, 0.4) * (1 - between(3.2, 0.5));
    if (badge.current) {
      badge.current.visible = clearance > 0.01;
      const material = badge.current.material as THREE.MeshBasicMaterial;
      material.map = textures.badges[sceneState.persona === 1 ? 1 : 0]!;
      material.opacity = clearance;
      badge.current.position.set(BADGE.x, BADGE.y + (1 - clearance) * 0.4, BADGE.z);
    }
    if (scanLine.current) {
      const x = SCAN.from + (SCAN.to - SCAN.from) * m.scan;
      scanLine.current.position.x = x;
      scanLine.current.visible = m.scanning && m.scan < 1 && clearance > 0.5;
    }

    // Answer actors: the AI core, links to the cited sources and their numbers.
    const answering = between(2.4, 0.5) * (1 - between(3.2, 0.5));
    if (core.current) {
      core.current.visible = answering > 0.01;
      core.current.scale.setScalar(0.4 + 0.6 * answering);
      core.current.children[1]!.rotation.set(1.1, time * 0.6, 0);
    }
    if (coreMaterial.current) coreMaterial.current.uniforms.uOpacity!.value = answering;
    const daneSees = m.scanPersona === 1 ? 1 : 0;
    if (links.current) {
      links.current.visible = answering > 0.01;
      (links.current.material as THREE.LineBasicMaterial).opacity = 0.55 * answering;
      links.current.geometry.setDrawRange(0, daneSees ? 6 : 4);
    }
    if (markers.current) {
      markers.current.children.forEach((child, index) => {
        child.visible = answering > 0.01 && (index < 2 || daneSees === 1);
        ((child as THREE.Sprite).material as THREE.SpriteMaterial).opacity = answering;
      });
    }

    camera.position.set(
      sceneState.pointer.active && !reduced ? sceneState.pointer.x * 0.25 : 0,
      sceneState.pointer.active && !reduced ? sceneState.pointer.y * 0.15 : 0,
      fitZ,
    );
    camera.lookAt(0, 0, 0);

    const settling = Math.abs(sceneState.stage - m.stage) > 0.001 || (m.scanning && m.scan < 1);
    if (lowPower && settling) state.invalidate();
  });

  return (
    <>
      <mesh geometry={geometry} frustumCulled={false} renderOrder={0}>
        <shaderMaterial
          ref={shadows}
          uniforms={shadowUniforms}
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={geometry} frustumCulled={false} renderOrder={1}>
        <shaderMaterial
          ref={cards}
          uniforms={cardUniforms}
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments ref={drawerFrames} geometry={drawerGeometry}>
        <lineBasicMaterial color="#9aa1ad" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </lineSegments>

      <mesh ref={badge} position={BADGE.toArray()} renderOrder={2}>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={scanLine} position={[SCAN.from, -0.4, 0.3]} renderOrder={2}>
        <planeGeometry args={[0.035, 6.2]} />
        <meshBasicMaterial
          color={COLORS.blue}
          transparent
          opacity={0.85}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <group ref={core} position={CORE.toArray()}>
        <mesh>
          <sphereGeometry args={[0.55, 48, 48]} />
          <shaderMaterial
            ref={coreMaterial}
            uniforms={coreUniforms}
            vertexShader={RIM_VERTEX}
            fragmentShader={RIM_FRAGMENT}
            transparent
          />
        </mesh>
        <mesh>
          <torusGeometry args={[0.82, 0.012, 8, 120]} />
          <meshBasicMaterial color={COLORS.blue} toneMapped={false} />
        </mesh>
        <sprite position={[0, 1.0, 0.2]} scale={[1.1, 0.3, 1]} renderOrder={5}>
          <spriteMaterial
            map={textures.coreLabel}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      </group>
      <lineSegments ref={links} geometry={linkGeometry}>
        <lineBasicMaterial
          color={COLORS.blue}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <group ref={markers}>
        {[1, 2, 3].map((n) => {
          const p = citedPosition(n);
          return (
            <sprite
              key={n}
              position={[p.x - CARD.w * CITED.scale * 0.5, p.y + CARD.h * CITED.scale * 0.5, p.z + 0.05]}
              scale={[0.3, 0.3, 1]}
              renderOrder={3}
            >
              <spriteMaterial
                map={textures.numbers[n - 1]!}
                transparent
                depthTest={false}
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
          );
        })}
      </group>
    </>
  );
}

/**
 * `lowPower` (a CPU/software WebGL renderer): fewer cards, native resolution, frames drawn only
 * when the story moves. Real GPUs get the full experience.
 */
export default function ArchiveScene({
  compact,
  lowPower,
  font = 'system-ui, sans-serif',
}: {
  compact: boolean;
  lowPower: boolean;
  font?: string;
}) {
  return (
    <Canvas
      dpr={lowPower ? 1 : [1, 2]}
      frameloop={lowPower ? 'demand' : 'always'}
      camera={{ position: [0, 0, 11], fov: 38, near: 0.1, far: 80 }}
      gl={{ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' }}
      aria-hidden
    >
      <Archive compact={compact} lowPower={lowPower} font={font} />
    </Canvas>
  );
}
