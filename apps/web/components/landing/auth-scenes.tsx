'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import { type AuthSceneMode, authState } from './auth-scene-state';
import { sceneState } from './scene-state';

/*
 * The 3D pictures beside the sign-in forms. Each one shows what its form does, and follows it as
 * it is filled in:
 *
 *   vault    sign in: a vault door. Its three dial rings lock into place for the email, the
 *            password and the submit; then the bolts withdraw and the door opens onto the
 *            documents this person is cleared for. A refused sign-in snaps it shut, in red.
 *   found    create an organization: an empty card catalogue is built drawer by drawer as the
 *            form fills in, under a nameplate with the organization's name and an Owner badge.
 *   join     accept an invitation: the same catalogue, already full, and a Member badge.
 *   refused  an invalid invitation: the vault, locked, with nothing to open.
 */

const C = {
  ink: '#0b0d12',
  soft: '#5b6270',
  rule: '#d6dae1',
  metal: '#b9bfc9',
  blue: '#2f5bff',
  blueSoft: '#e8edff',
  red: '#e5484d',
};
const TAU = Math.PI * 2;

/** A canvas texture that is repainted only when what it shows changes. */
class LiveLabel {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly width: number;
  private readonly height: number;
  private key = '';

  constructor(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    this.width = width;
    this.height = height;
    this.ctx = canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  paint(key: string, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
    if (key === this.key || !this.ctx) return;
    this.key = key;
    this.ctx.clearRect(0, 0, this.width, this.height);
    draw(this.ctx, this.width, this.height);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

/** Labels live in a ref: created after mount, disposed on unmount, painted inside the frame loop. */
function useLabels<K extends string>(sizes: Record<K, [number, number]>) {
  const labels = useRef<Record<K, LiveLabel> | null>(null);
  const spec = useRef(sizes);
  useEffect(() => {
    const created = Object.fromEntries(
      (Object.entries(spec.current) as Array<[K, [number, number]]>).map(([name, [w, h]]) => [
        name,
        new LiveLabel(w, h),
      ]),
    ) as Record<K, LiveLabel>;
    labels.current = created;
    return () => {
      Object.values<LiveLabel>(created).forEach((label) => label.dispose());
      labels.current = null;
    };
  }, []);
  return labels;
}

function useOnDemand() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    sceneState.invalidate = invalidate;
    return () => {
      sceneState.invalidate = null;
    };
  }, [invalidate]);
}

const damp = (value: number, target: number, rate: number, dt: number, snap: boolean) =>
  snap ? target : value + (target - value) * (1 - Math.exp(-rate * dt));

function fitCamera(
  state: { camera: THREE.Camera; size: { width: number; height: number } },
  w: number,
  h: number,
) {
  const camera = state.camera as THREE.PerspectiveCamera;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const aspect = state.size.width / Math.max(state.size.height, 1);
  const z = Math.max(h / 2 / tanHalf, w / 2 / (tanHalf * aspect)) * 1.05;
  camera.position.set(0, 0, z);
  camera.lookAt(0, 0, 0);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function paintCheck(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, on: boolean) {
  ctx.fillStyle = on ? C.blue : '#ffffff';
  ctx.strokeStyle = on ? C.blue : C.rule;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (!on) return;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.42, y + r * 0.02);
  ctx.lineTo(x - r * 0.1, y + r * 0.34);
  ctx.lineTo(x + r * 0.45, y - r * 0.3);
  ctx.stroke();
}

/** A status pill: coloured dot and one line of text. */
function paintPill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dot: string,
  text: string,
  font: string,
) {
  roundRect(ctx, 3, 3, w - 6, h - 6, (h - 6) / 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.rule;
  ctx.stroke();
  ctx.fillStyle = dot;
  ctx.beginPath();
  ctx.arc(h / 2 + 6, h / 2, h * 0.11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.ink;
  let size = Math.round(h * 0.36);
  ctx.font = `600 ${size}px ${font}`;
  while (ctx.measureText(text).width > w - h * 0.85 - 36 && size > 18) {
    size -= 2;
    ctx.font = `600 ${size}px ${font}`;
  }
  ctx.textBaseline = 'middle';
  ctx.fillText(text, h * 0.85, h / 2 + 2);
}

// ── Sign in: the vault door ───────────────────────────────────────────────────────────

const R = 2.05;
const RING_RADII = [1.62, 1.22, 0.82];
const BOLTS = 10;

function ringTicks(radius: number) {
  const points: number[] = [];
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * TAU;
    const long = i % 4 === 0 ? 0.13 : 0.06;
    points.push(Math.sin(a) * radius, Math.cos(a) * radius, 0);
    points.push(Math.sin(a) * (radius - long), Math.cos(a) * (radius - long), 0);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
}

function VaultDoor({ font, refused, lowPower }: { font: string; refused: boolean; lowPower: boolean }) {
  useOnDemand();
  const tilt = useRef<THREE.Group>(null);
  const hinge = useRef<THREE.Group>(null);
  const rings = useRef<Array<THREE.Group | null>>([]);
  const notches = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const bolts = useRef<THREE.Group>(null);
  const handle = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.MeshBasicMaterial>(null);
  const plate = useRef<THREE.SpriteMaterial>(null);
  const motion = useRef({ open: 0, bolt: 1, handle: 0, shake: 0, status: 'idle' as string });
  const labels = useLabels({ plate: [720, 112] });
  const ticks = useMemo(() => RING_RADII.map(ringTicks), []);
  const lampColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const m = motion.current;
    const snap = sceneState.reducedMotion || lowPower;
    const dt = Math.min(delta, 0.05);
    const time = snap ? 0 : state.clock.elapsedTime;
    const status = refused ? 'denied' : authState.status;
    if (status !== m.status) {
      if (status === 'denied') m.shake = 1;
      m.status = status;
    }
    fitCamera(state, 5.6, 6.6);

    // The dial: each ring spins freely until its condition is met, then settles at the mark.
    const wanted = [authState.email, authState.password, status === 'checking'];
    let settled = 0;
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const notch = notches.current[i];
      if (wanted[i] && status !== 'denied' && !refused) {
        const target = Math.round(ring.rotation.z / TAU) * TAU;
        ring.rotation.z = damp(ring.rotation.z, target, 7, dt, snap);
        const done = Math.abs(ring.rotation.z - target) < 0.03;
        if (done) settled += 1;
        notch?.color.set(done ? C.blue : C.metal);
      } else {
        const speed = [0.32, -0.45, 0.6][i]! * (status === 'denied' && m.shake > 0.05 ? 7 : 1);
        if (!snap) ring.rotation.z += speed * dt;
        else if (Math.abs(ring.rotation.z) < 0.01) ring.rotation.z = [0.9, -1.7, 2.6][i]!;
        notch?.color.set(status === 'denied' ? C.red : C.metal);
      }
    });

    const unlocking = status === 'checking' && settled === 3;
    m.bolt = damp(m.bolt, unlocking ? 0 : 1, 6, dt, snap);
    m.handle = damp(m.handle, unlocking ? 1 : 0, 4, dt, snap);
    m.open = damp(m.open, unlocking && m.bolt < 0.08 ? 1 : 0, 2.6, dt, snap);
    m.shake = damp(m.shake, 0, 2.2, dt, snap);

    hinge.current?.rotation.set(0, -m.open * 1.0, 0);
    handle.current?.rotation.set(0, 0, m.handle * (Math.PI / 2));
    bolts.current?.children.forEach((bolt, i) => {
      const a = (i / BOLTS) * TAU;
      const r = R - 0.1 + m.bolt * 0.3;
      bolt.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    });

    const px = sceneState.pointer.active && !snap ? sceneState.pointer.x : 0;
    const py = sceneState.pointer.active && !snap ? sceneState.pointer.y : 0;
    if (tilt.current) {
      tilt.current.rotation.set(0.05 - py * 0.1, -0.3 + px * 0.16 + Math.sin(time * 0.3) * 0.03, 0);
      tilt.current.position.x = Math.sin(time * 45) * 0.07 * m.shake;
    }

    const ready = authState.email && authState.password;
    lamp.current?.color.set(
      lampColor.set(status === 'denied' ? C.red : status === 'checking' || ready ? C.blue : C.metal),
    );

    const label = labels.current?.plate;
    if (label && plate.current) {
      const [dot, text] = refused
        ? [C.red, 'Invitation not valid: nothing to open']
        : status === 'denied'
          ? [C.red, 'Access denied']
          : status === 'checking'
            ? [C.blue, 'Checking your access…']
            : ready
              ? [C.blue, 'Ready: sign in to open']
              : authState.email
                ? [C.metal, 'Locked: waiting for your password']
                : [C.metal, 'Locked: waiting for your email'];
      label.paint(`${text}|${document.fonts.check(`600 40px ${font}`)}`, (ctx, w, h) =>
        paintPill(ctx, w, h, dot, text, font),
      );
      if (plate.current.map !== label.texture) {
        plate.current.map = label.texture;
        plate.current.needsUpdate = true;
      }
    }

    const moving =
      m.shake > 0.01 ||
      Math.abs(m.bolt - (unlocking ? 0 : 1)) > 0.002 ||
      Math.abs(m.open - (unlocking ? 1 : 0)) > 0.002 ||
      (wanted.some(Boolean) && settled < wanted.filter(Boolean).length);
    if (lowPower && moving) state.invalidate();
  });

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 7]} intensity={1.8} />
      <directionalLight position={[-5, -2, 3]} intensity={0.5} />

      <group ref={tilt}>
        {/* What lies behind the door: the documents this person is cleared for. */}
        <group position={[0, 0, -0.35]}>
          <mesh>
            <circleGeometry args={[R - 0.02, 96]} />
            <meshBasicMaterial color={C.blueSoft} toneMapped={false} />
          </mesh>
          {[-0.62, 0, 0.62].map((x, i) => (
            <group
              key={x}
              position={[x, -0.1 + (i === 1 ? 0.12 : 0), 0.05]}
              rotation={[0, 0, (1 - i) * 0.08]}
            >
              <mesh>
                <planeGeometry args={[0.52, 0.7]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
              </mesh>
              <mesh position={[-0.23, 0, 0.001]}>
                <planeGeometry args={[0.05, 0.7]} />
                <meshBasicMaterial color={C.blue} toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Frame and status lamp. */}
        <mesh>
          <torusGeometry args={[R + 0.1, 0.11, 24, 128]} />
          <meshStandardMaterial color="#20242c" metalness={0.4} roughness={0.45} />
        </mesh>
        <mesh position={[0, R + 0.42, 0]}>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshBasicMaterial ref={lamp} color={C.metal} toneMapped={false} />
        </mesh>
        <mesh position={[0.15, -0.22, -0.6]}>
          <circleGeometry args={[R + 0.45, 96]} />
          <meshBasicMaterial color="#0b0d12" transparent opacity={0.06} depthWrite={false} />
        </mesh>

        {/* The door swings on its left edge. */}
        <group ref={hinge} position={[-R, 0, 0]}>
          <group position={[R, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[R, R, 0.34, 128]} />
              <meshStandardMaterial color="#fbfbfc" metalness={0.05} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0, 0.175]}>
              <torusGeometry args={[R - 0.16, 0.025, 12, 128]} />
              <meshStandardMaterial color="#d9dde3" roughness={0.6} />
            </mesh>

            <group ref={bolts}>
              {Array.from({ length: BOLTS }, (_, i) => (
                <mesh key={i} rotation={[0, 0, (i / BOLTS) * TAU - Math.PI / 2]}>
                  <cylinderGeometry args={[0.075, 0.075, 0.5, 16]} />
                  <meshStandardMaterial color="#c3c8d0" metalness={0.6} roughness={0.3} />
                </mesh>
              ))}
            </group>

            {RING_RADII.map((radius, i) => (
              <group
                key={radius}
                ref={(node) => {
                  rings.current[i] = node;
                }}
                position={[0, 0, 0.18]}
              >
                <mesh>
                  <torusGeometry args={[radius, 0.014, 8, 160]} />
                  <meshBasicMaterial color={C.ink} toneMapped={false} />
                </mesh>
                <lineSegments geometry={ticks[i]}>
                  <lineBasicMaterial color={C.soft} toneMapped={false} />
                </lineSegments>
                <mesh position={[0, radius + 0.1, 0.01]}>
                  <boxGeometry args={[0.08, 0.2, 0.03]} />
                  <meshBasicMaterial
                    ref={(node) => {
                      notches.current[i] = node;
                    }}
                    color={C.metal}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            ))}

            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.24]}>
              <cylinderGeometry args={[0.4, 0.4, 0.14, 48]} />
              <meshStandardMaterial color="#20242c" metalness={0.4} roughness={0.4} />
            </mesh>
            <group ref={handle} position={[0, 0, 0.36]}>
              {[0, 1, 2].map((k) => (
                <group key={k} rotation={[0, 0, (k * Math.PI) / 3]}>
                  <mesh>
                    <boxGeometry args={[1.5, 0.08, 0.08]} />
                    <meshStandardMaterial color="#20242c" metalness={0.5} roughness={0.35} />
                  </mesh>
                  {[-0.75, 0.75].map((x) => (
                    <mesh key={x} position={[x, 0, 0]}>
                      <sphereGeometry args={[0.085, 16, 16]} />
                      <meshStandardMaterial color="#20242c" metalness={0.5} roughness={0.35} />
                    </mesh>
                  ))}
                </group>
              ))}
            </group>
          </group>
        </group>

        {/* The fixed mark the rings line up with. */}
        <mesh position={[0, R - 0.05, 0.4]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.08, 0.16, 3]} />
          <meshBasicMaterial color={C.blue} toneMapped={false} />
        </mesh>
      </group>

      <sprite position={[0, -R - 0.75, 0.5]} scale={[3.2, 0.5, 1]}>
        <spriteMaterial ref={plate} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </>
  );
}

// ── Create an organization / join one: the archive and its badge ─────────────────────────

const DRAWER = 1.02;
const BODY = { w: 3.3, h: 3.3, d: 1.8 };

function Catalogue({
  font,
  join,
  organization,
  lowPower,
}: {
  font: string;
  join: boolean;
  organization: string;
  lowPower: boolean;
}) {
  useOnDemand();
  const cabinet = useRef<THREE.Group>(null);
  const drawers = useRef<Array<THREE.Group | null>>([]);
  const edges = useRef<THREE.LineBasicMaterial>(null);
  const lockBody = useRef<THREE.MeshStandardMaterial>(null);
  const shackle = useRef<THREE.Mesh>(null);
  const badge = useRef<THREE.Group>(null);
  const badgeMat = useRef<THREE.MeshBasicMaterial>(null);
  const plateMat = useRef<THREE.MeshBasicMaterial>(null);
  const reveal = useRef<number[]>(Array.from({ length: 9 }, () => 0));
  const motion = useRef({ locked: 0, shake: 0, pulse: 0, status: 'idle' as string });
  const labels = useLabels({ plate: [1040, 220], badge: [760, 480] });

  const bodyEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(BODY.w, BODY.h, BODY.d)), []);
  const frontEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.9, 0.12)), []);
  const blue = useMemo(() => new THREE.Color(C.blue), []);
  const grey = useMemo(() => new THREE.Color(C.metal), []);
  const inkEdge = useMemo(() => new THREE.Color('#8d94a0'), []);

  useFrame((state, delta) => {
    const m = motion.current;
    const snap = sceneState.reducedMotion || lowPower;
    const dt = Math.min(delta, 0.05);
    const time = snap ? 0 : state.clock.elapsedTime;
    const status = authState.status;
    if (status !== m.status) {
      if (status === 'denied') m.shake = 1;
      if (status === 'checking') m.pulse = 1;
      m.status = status;
    }
    fitCamera(state, 8.2, 6.4);

    const name = authState.name.trim();
    const org = join ? organization : authState.organization.trim();
    const filled = [name !== '', authState.email, authState.password, org !== ''].filter(Boolean).length;
    // A new archive is built drawer by drawer as the form fills in; one you join is already whole.
    const built = join || status === 'checking' ? 9 : 1 + filled * 2;

    let moving = m.shake > 0.01 || m.pulse > 0.01;
    drawers.current.forEach((drawer, i) => {
      if (!drawer) return;
      const target = i < built ? 1 : 0;
      const r = damp(reveal.current[i]!, target, 5 - (i % 3) * 0.6, dt, snap);
      reveal.current[i] = r;
      if (Math.abs(r - target) > 0.002) moving = true;
      const col = i % 3;
      const row = Math.floor(i / 3);
      const open = join ? 0.22 + Math.sin(time * 0.6 + i) * 0.02 : 0;
      drawer.position.set((col - 1) * DRAWER, (1 - row) * DRAWER, BODY.d / 2 + 0.06 + open + (1 - r) * 2.4);
      drawer.scale.setScalar(Math.max(r, 0.0001));
      drawer.visible = r > 0.01;
    });

    m.locked = damp(m.locked, authState.password ? 1 : 0, 6, dt, snap);
    m.shake = damp(m.shake, 0, 2.2, dt, snap);
    m.pulse = damp(m.pulse, 0, 1.6, dt, snap);
    lockBody.current?.color.copy(grey).lerp(blue, m.locked);
    shackle.current?.position.set(0, 0.17 + (1 - m.locked) * 0.13, 0);
    edges.current?.color.copy(inkEdge).lerp(blue, status === 'checking' ? 1 : m.pulse);

    const px = sceneState.pointer.active && !snap ? sceneState.pointer.x : 0;
    const py = sceneState.pointer.active && !snap ? sceneState.pointer.y : 0;
    cabinet.current?.rotation.set(0.1 - py * 0.08, 0.48 + px * 0.14 + Math.sin(time * 0.25) * 0.03, 0);
    if (badge.current) {
      badge.current.position.set(
        -2.35 + Math.sin(time * 45) * 0.06 * m.shake,
        -0.7 + Math.sin(time * 0.8) * 0.05,
        1.1,
      );
      badge.current.rotation.set(-py * 0.06, 0.32 + px * 0.1, -0.04);
      badge.current.scale.setScalar(1 + m.pulse * 0.05);
    }

    const ready = document.fonts.check(`700 40px ${font}`);
    const set = labels.current;
    if (set && plateMat.current && badgeMat.current) {
      const plateText = org || 'Your organization';
      set.plate.paint(`${plateText}|${ready}`, (ctx, w, h) => {
        roundRect(ctx, 4, 4, w - 8, h - 8, 28);
        ctx.fillStyle = C.ink;
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 34px ${font}`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(join ? 'Archive of' : 'Private archive of', 48, 78);
        ctx.fillStyle = org ? '#ffffff' : 'rgba(255,255,255,0.4)';
        let size = 84;
        ctx.font = `700 ${size}px ${font}`;
        while (ctx.measureText(plateText).width > w - 96 && size > 40) {
          size -= 4;
          ctx.font = `700 ${size}px ${font}`;
        }
        ctx.fillText(plateText, 46, 172);
      });

      const role = join ? 'Member' : 'Owner';
      const rows: Array<[string, boolean]> = join
        ? [
            ['Invitation accepted', true],
            ['Password chosen', authState.password],
          ]
        : [
            ['Sign-in email', authState.email],
            ['Password set', authState.password],
          ];
      set.badge.paint(
        `${role}|${name}|${rows.map(([, on]) => on).join()}|${status}|${ready}`,
        (ctx, w, h) => {
          roundRect(ctx, 4, 4, w - 8, h - 8, 36);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = C.rule;
          ctx.stroke();
          ctx.fillStyle = status === 'denied' ? C.red : C.blue;
          ctx.fillRect(4, 48, 20, h - 96);
          ctx.fillStyle = C.soft;
          ctx.font = `600 34px ${font}`;
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(`${role} badge`, 66, 86);
          ctx.fillStyle = name ? C.ink : '#a3a9b4';
          let size = 92;
          ctx.font = `700 ${size}px ${font}`;
          while (ctx.measureText(name || 'Your name').width > w - 120 && size > 44) {
            size -= 4;
            ctx.font = `700 ${size}px ${font}`;
          }
          ctx.fillText(name || 'Your name', 62, 196);
          rows.forEach(([text, on], i) => {
            const y = 300 + i * 72;
            paintCheck(ctx, 90, y, 20, on);
            ctx.fillStyle = on ? C.ink : C.soft;
            ctx.font = `500 36px ${font}`;
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 128, y + 2);
          });
        },
      );
      if (plateMat.current.map !== set.plate.texture) {
        plateMat.current.map = set.plate.texture;
        plateMat.current.needsUpdate = true;
      }
      if (badgeMat.current.map !== set.badge.texture) {
        badgeMat.current.map = set.badge.texture;
        badgeMat.current.needsUpdate = true;
      }
    }

    if (lowPower && (moving || Math.abs(m.locked - (authState.password ? 1 : 0)) > 0.002)) state.invalidate();
  });

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 6, 7]} intensity={1.6} />
      <directionalLight position={[-5, -1, 3]} intensity={0.45} />

      <group ref={cabinet} position={[1.15, -0.1, 0]}>
        <mesh>
          <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
          <meshStandardMaterial color="#fbfbfc" roughness={0.7} />
        </mesh>
        <lineSegments geometry={bodyEdges}>
          <lineBasicMaterial ref={edges} color="#8d94a0" toneMapped={false} />
        </lineSegments>
        {/* Empty slots, until a drawer arrives. */}
        {Array.from({ length: 9 }, (_, i) => (
          <mesh
            key={i}
            position={[((i % 3) - 1) * DRAWER, (1 - Math.floor(i / 3)) * DRAWER, BODY.d / 2 + 0.002]}
          >
            <planeGeometry args={[0.9, 0.9]} />
            <meshBasicMaterial color="#e9ecf0" toneMapped={false} />
          </mesh>
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <group
            key={i}
            ref={(node) => {
              drawers.current[i] = node;
            }}
            visible={false}
          >
            <mesh>
              <boxGeometry args={[0.9, 0.9, 0.12]} />
              <meshStandardMaterial color="#ffffff" roughness={0.6} />
            </mesh>
            <lineSegments geometry={frontEdges}>
              <lineBasicMaterial color="#b4bac4" toneMapped={false} />
            </lineSegments>
            <mesh position={[0, 0.24, 0.065]}>
              <planeGeometry args={[0.38, 0.13]} />
              <meshBasicMaterial color="#e3e6eb" toneMapped={false} />
            </mesh>
            <mesh position={[0, -0.12, 0.09]}>
              <boxGeometry args={[0.32, 0.06, 0.06]} />
              <meshStandardMaterial color="#20242c" metalness={0.4} roughness={0.4} />
            </mesh>
            {join
              ? [-0.22, 0, 0.2].map((x, k) => (
                  <mesh key={x} position={[x, 0.5, -0.25 - k * 0.12]} rotation={[0, 0, (k - 1) * 0.05]}>
                    <planeGeometry args={[0.3, 0.4]} />
                    <meshBasicMaterial
                      color={k === 1 ? C.blueSoft : '#ffffff'}
                      toneMapped={false}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                ))
              : null}
          </group>
        ))}

        {/* Nameplate on top, and the padlock that closes once a password is set. */}
        <mesh position={[-0.35, BODY.h / 2 + 0.36, BODY.d / 2 - 0.3]}>
          <planeGeometry args={[2.5, 0.53]} />
          <meshBasicMaterial ref={plateMat} transparent toneMapped={false} />
        </mesh>
        <group position={[1.3, BODY.h / 2 + 0.2, BODY.d / 2 - 0.35]}>
          <mesh>
            <boxGeometry args={[0.42, 0.34, 0.16]} />
            <meshStandardMaterial ref={lockBody} color={C.metal} metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh ref={shackle}>
            <torusGeometry args={[0.13, 0.035, 12, 32, Math.PI]} />
            <meshStandardMaterial color="#9aa1ac" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      </group>

      <group ref={badge}>
        <mesh position={[0.05, -0.06, -0.03]}>
          <planeGeometry args={[2.0, 1.27]} />
          <meshBasicMaterial color="#0b0d12" transparent opacity={0.08} depthWrite={false} />
        </mesh>
        <mesh>
          <planeGeometry args={[2.0, 1.263]} />
          <meshBasicMaterial ref={badgeMat} transparent toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

/**
 * `lowPower` (a software WebGL renderer): native resolution, and frames drawn only when something
 * changes. Real GPUs animate continuously.
 */
export default function AuthScene({
  mode,
  organization,
  lowPower,
  font = 'system-ui, sans-serif',
}: {
  mode: AuthSceneMode;
  organization: string;
  lowPower: boolean;
  font?: string;
}) {
  return (
    <Canvas
      flat
      dpr={lowPower ? 1 : [1, 2]}
      frameloop={lowPower ? 'demand' : 'always'}
      camera={{ position: [0, 0, 12], fov: 34, near: 0.1, far: 80 }}
      gl={{ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' }}
      aria-hidden
    >
      {mode === 'vault' || mode === 'refused' ? (
        <VaultDoor font={font} refused={mode === 'refused'} lowPower={lowPower} />
      ) : (
        <Catalogue font={font} join={mode === 'join'} organization={organization} lowPower={lowPower} />
      )}
    </Canvas>
  );
}
