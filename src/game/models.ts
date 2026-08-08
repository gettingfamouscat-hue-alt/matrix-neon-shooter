import * as THREE from 'three'
import type { EnemyKind } from './entities'

function mat(opts: {
  color: number
  emissive?: number
  emissiveIntensity?: number
  metalness?: number
  roughness?: number
}) {
  return new THREE.MeshStandardMaterial({
    color: opts.color,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.4,
  })
}

function addShadow(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
}

function capsule(r: number, len: number, m: THREE.Material, seg = 10) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, seg, 16), m)
}

function lathe(points: [number, number][], m: THREE.Material, seg = 24) {
  return new THREE.Mesh(
    new THREE.LatheGeometry(
      points.map(([x, y]) => new THREE.Vector2(x, y)),
      seg,
    ),
    m,
  )
}

/** More organic humanoid / machine silhouettes — not plain boxes. */
export function createEnemyModel(kind: EnemyKind): THREE.Group {
  const g = new THREE.Group()

  if (kind === 'agent') {
    const suit = mat({ color: 0x0e1210, metalness: 0.7, roughness: 0.32, emissive: 0x00ff66, emissiveIntensity: 0.04 })
    const skin = mat({ color: 0x3a4a3e, metalness: 0.15, roughness: 0.75 })
    const shirt = mat({ color: 0xf2f2f0, metalness: 0.05, roughness: 0.85 })

    const hips = capsule(0.28, 0.2, suit, 8)
    hips.position.y = 0.95
    const torso = lathe(
      [
        [0.22, 0],
        [0.34, 0.15],
        [0.38, 0.45],
        [0.32, 0.75],
        [0.2, 0.95],
      ],
      suit,
    )
    torso.position.y = 1.05

    const head = lathe(
      [
        [0.02, 0],
        [0.16, 0.05],
        [0.22, 0.18],
        [0.2, 0.35],
        [0.12, 0.48],
        [0.02, 0.52],
      ],
      skin,
      28,
    )
    head.position.y = 2.05

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 20), shirt)
    collar.rotation.x = Math.PI / 2
    collar.position.y = 2.0

    const glasses = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.018, 8, 20),
      mat({ color: 0x050805, metalness: 0.95, roughness: 0.1, emissive: 0x00ff66, emissiveIntensity: 0.65 }),
    )
    glasses.position.set(-0.12, 2.28, 0.16)
    const glasses2 = glasses.clone()
    glasses2.position.x = 0.12
    const bridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6),
      mat({ color: 0x111111, metalness: 0.9, roughness: 0.2 }),
    )
    bridge.rotation.z = Math.PI / 2
    bridge.position.set(0, 2.28, 0.18)

    const tie = lathe(
      [
        [0.01, 0],
        [0.04, 0.05],
        [0.03, 0.35],
        [0.05, 0.55],
        [0.01, 0.6],
      ],
      mat({ color: 0x111111, emissive: 0x00aa44, emissiveIntensity: 0.3, metalness: 0.4, roughness: 0.5 }),
    )
    tie.position.set(0, 1.35, 0.32)

    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), suit)
    shoulderL.position.set(-0.42, 1.85, 0)
    const shoulderR = shoulderL.clone()
    shoulderR.position.x = 0.42

    const makeArm = (sign: number) => {
      const arm = new THREE.Group()
      const upper = capsule(0.085, 0.32, suit, 8)
      upper.position.set(sign * 0.42, 1.7, 0)
      upper.rotation.z = sign * 0.15
      const fore = capsule(0.07, 0.28, suit, 8)
      fore.position.set(sign * 0.5, 1.28, 0.08)
      fore.rotation.z = sign * 0.25
      fore.rotation.x = -0.35
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.09), skin)
      palm.position.set(sign * 0.54, 1.02, 0.18)
      palm.rotation.x = -0.5
      palm.rotation.z = sign * 0.1
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.05, 3, 5), skin)
        f.position.set(sign * (0.5 + i * 0.015), 0.97, 0.24)
        f.rotation.x = 0.9
        arm.add(f)
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 3, 5), skin)
      thumb.position.set(sign * 0.48, 1.04, 0.2)
      thumb.rotation.z = sign * -0.8
      arm.add(upper, fore, palm, thumb)
      return arm
    }
    const armL = makeArm(-1)
    const armR = makeArm(1)

    const legL = capsule(0.11, 0.7, suit, 8)
    legL.position.set(-0.16, 0.45, 0)
    const legR = capsule(0.11, 0.7, suit, 8)
    legR.position.set(0.16, 0.45, 0)
    const shoeL = lathe(
      [
        [0.02, 0],
        [0.1, 0.02],
        [0.11, 0.08],
        [0.08, 0.12],
        [0.02, 0.14],
      ],
      mat({ color: 0x080a08, metalness: 0.4, roughness: 0.6 }),
    )
    shoeL.rotation.x = Math.PI / 2
    shoeL.position.set(-0.16, 0.07, 0.06)
    const shoeR = shoeL.clone()
    shoeR.position.x = 0.16

    g.add(
      hips,
      torso,
      head,
      collar,
      glasses,
      glasses2,
      bridge,
      tie,
      shoulderL,
      shoulderR,
      armL,
      armR,
      legL,
      legR,
      shoeL,
      shoeR,
    )
  } else if (kind === 'runner') {
    const neon = mat({
      color: 0x0a2418,
      emissive: 0x33ff99,
      emissiveIntensity: 0.5,
      metalness: 0.75,
      roughness: 0.22,
    })
    const body = lathe(
      [
        [0.05, 0],
        [0.18, 0.2],
        [0.22, 0.7],
        [0.16, 1.2],
        [0.1, 1.45],
        [0.04, 1.55],
      ],
      neon,
    )
    body.position.y = 0.35
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), neon)
    head.position.y = 1.95
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
      mat({ color: 0x66ffcc, emissive: 0x33ff99, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.15 }),
    )
    visor.position.set(0, 1.95, 0.1)
    const bladeL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7, 6), neon)
    bladeL.position.set(-0.35, 1.2, 0)
    bladeL.rotation.z = 0.5
    const bladeR = bladeL.clone()
    bladeR.position.x = 0.35
    bladeR.rotation.z = -0.5
    g.add(body, head, visor, bladeL, bladeR)
  } else if (kind === 'tank') {
    const armor = mat({
      color: 0x2a1212,
      emissive: 0xff2244,
      emissiveIntensity: 0.3,
      metalness: 0.9,
      roughness: 0.28,
    })
    const chassis = lathe(
      [
        [0.2, 0],
        [0.7, 0.2],
        [0.85, 0.7],
        [0.75, 1.3],
        [0.45, 1.7],
        [0.2, 1.9],
      ],
      armor,
      20,
    )
    chassis.position.y = 0.3
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), armor)
    dome.position.y = 2.15
    const visor = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.04, 8, 20),
      mat({ color: 0xff6688, emissive: 0xff3355, emissiveIntensity: 1.3 }),
    )
    visor.position.set(0, 2.15, 0.2)
    const pauldronL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10, 0, Math.PI, 0, Math.PI), armor)
    pauldronL.position.set(-0.75, 1.7, 0)
    pauldronL.rotation.z = Math.PI / 2
    const pauldronR = pauldronL.clone()
    pauldronR.position.x = 0.75
    pauldronR.rotation.z = -Math.PI / 2
    const legL = capsule(0.2, 0.55, armor, 8)
    legL.position.set(-0.35, 0.4, 0)
    const legR = capsule(0.2, 0.55, armor, 8)
    legR.position.set(0.35, 0.4, 0)
    g.add(chassis, dome, visor, pauldronL, pauldronR, legL, legR)
  } else if (kind === 'drone') {
    const shell = mat({
      color: 0x102030,
      emissive: 0x33ccff,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.18,
    })
    const body = lathe(
      [
        [0.02, -0.35],
        [0.25, -0.2],
        [0.4, 0],
        [0.35, 0.25],
        [0.15, 0.4],
        [0.02, 0.45],
      ],
      shell,
      28,
    )
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 10, 36),
      mat({ color: 0x33ccff, emissive: 0x33ccff, emissiveIntensity: 1.15, metalness: 0.85, roughness: 0.2 }),
    )
    ring.rotation.x = Math.PI / 2
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      mat({ color: 0xffffff, emissive: 0x66eeff, emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.1 }),
    )
    lens.position.z = 0.32
    const wingL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 8), shell)
    wingL.rotation.z = Math.PI / 2
    wingL.position.set(-0.55, 0, 0)
    const wingR = wingL.clone()
    wingR.position.x = 0.55
    wingR.rotation.z = -Math.PI / 2
    g.add(body, ring, lens, wingL, wingR)
  } else {
    const shell = mat({
      color: 0x2a0810,
      emissive: 0xff0033,
      emissiveIntensity: 0.5,
      metalness: 0.88,
      roughness: 0.22,
    })
    const body = lathe(
      [
        [0.1, -1.2],
        [0.9, -0.6],
        [1.3, 0],
        [1.1, 0.8],
        [0.6, 1.3],
        [0.15, 1.55],
      ],
      shell,
      28,
    )
    body.position.y = 0.4
    const aura = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.9, 1),
      new THREE.MeshBasicMaterial({
        color: 0xff3355,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
      }),
    )
    aura.name = 'bossAura'
    aura.position.y = 0.4
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 24, 24),
      mat({ color: 0xffeecc, emissive: 0xffcc00, emissiveIntensity: 1.7, metalness: 0.25, roughness: 0.15 }),
    )
    core.position.y = 0.4
    g.add(body, aura, core)
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 7), shell)
    for (let i = 0; i < 6; i++) {
      const s = spike.clone()
      const a = (i / 6) * Math.PI * 2
      s.position.set(Math.cos(a) * 1.1, 0.5, Math.sin(a) * 1.1)
      s.lookAt(0, 0.5, 0)
      g.add(s)
    }
  }

  addShadow(g)
  return g
}
