import * as THREE from 'three'

export type WeaponId = 'rifle' | 'smg' | 'shotgun' | 'rail'

export type WeaponDef = {
  id: WeaponId
  name: string
  magSize: number
  fireRate: number
  reloadTime: number
  damage: number
  pellets: number
  spread: number
  adsFov: number
  kick: number
  auto: boolean
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'rifle',
    name: 'PULSE RIFLE',
    magSize: 30,
    fireRate: 0.11,
    reloadTime: 1.35,
    damage: 26,
    pellets: 1,
    spread: 0.012,
    adsFov: 42,
    kick: 1,
    auto: true,
  },
  {
    id: 'smg',
    name: 'VECTOR SMG',
    magSize: 40,
    fireRate: 0.055,
    reloadTime: 1.1,
    damage: 14,
    pellets: 1,
    spread: 0.028,
    adsFov: 48,
    kick: 0.55,
    auto: true,
  },
  {
    id: 'shotgun',
    name: 'BREACHER',
    magSize: 8,
    fireRate: 0.7,
    reloadTime: 2.1,
    damage: 16,
    pellets: 8,
    spread: 0.085,
    adsFov: 50,
    kick: 1.6,
    auto: false,
  },
  {
    id: 'rail',
    name: 'RAIL PISTOL',
    magSize: 12,
    fireRate: 0.32,
    reloadTime: 1.5,
    damage: 55,
    pellets: 1,
    spread: 0.004,
    adsFov: 36,
    kick: 1.25,
    auto: false,
  },
]

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
    metalness: opts.metalness ?? 0.85,
    roughness: opts.roughness ?? 0.28,
  })
}

function metalDark() {
  return mat({ color: 0x1c2220, metalness: 0.92, roughness: 0.22, emissive: 0x00ff66, emissiveIntensity: 0.04 })
}

function metalMid() {
  return mat({ color: 0x2a332e, metalness: 0.8, roughness: 0.35 })
}

function polymer() {
  return mat({ color: 0x121816, metalness: 0.25, roughness: 0.7 })
}

function neon() {
  return mat({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 1.1, metalness: 0.4, roughness: 0.25 })
}

function latheBody(points: [number, number][], colorMat: THREE.Material) {
  const v2 = points.map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.Mesh(new THREE.LatheGeometry(v2, 20), colorMat)
}

export function createWeaponModel(id: WeaponId): THREE.Group {
  const root = new THREE.Group()
  const dark = metalDark()
  const mid = metalMid()
  const poly = polymer()
  const glow = neon()

  if (id === 'rifle') {
    // curved receiver via lathe
    const receiver = latheBody(
      [
        [0.01, -0.18],
        [0.07, -0.12],
        [0.09, 0.05],
        [0.08, 0.22],
        [0.05, 0.32],
        [0.02, 0.38],
      ],
      dark,
    )
    receiver.rotation.z = Math.PI / 2
    receiver.position.set(0, -0.02, -0.2)

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.72, 16), mid)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.02, -0.78)

    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.38, 10, 1, true), poly)
    shroud.rotation.x = Math.PI / 2
    shroud.position.set(0, 0.02, -0.55)

    const stock = latheBody(
      [
        [0.01, 0],
        [0.06, 0.02],
        [0.07, 0.12],
        [0.05, 0.22],
        [0.02, 0.28],
      ],
      poly,
    )
    stock.rotation.z = -Math.PI / 2
    stock.position.set(0, -0.04, 0.18)

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 12), poly)
    grip.position.set(0, -0.16, -0.02)
    grip.rotation.x = 0.35

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.1), mid)
    mag.position.set(0, -0.2, -0.18)
    mag.rotation.x = 0.08

    const optic = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 14), dark)
    optic.rotation.x = Math.PI / 2
    optic.position.set(0, 0.1, -0.28)
    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(0.022, 16),
      mat({ color: 0x66ffaa, emissive: 0x00ff66, emissiveIntensity: 0.8, metalness: 0.1, roughness: 0.1 }),
    )
    glass.position.set(0, 0.1, -0.21)

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.35), glow)
    rail.position.set(0, 0.08, -0.35)

    root.add(receiver, barrel, shroud, stock, grip, mag, optic, glass, rail)
    root.position.set(0.26, -0.26, -0.42)
  } else if (id === 'smg') {
    const body = latheBody(
      [
        [0.01, -0.1],
        [0.055, -0.05],
        [0.07, 0.08],
        [0.06, 0.2],
        [0.03, 0.28],
      ],
      dark,
    )
    body.rotation.z = Math.PI / 2
    body.position.set(0, 0, -0.15)

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.38, 14), mid)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.01, -0.48)

    const compensator = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.08, 10), glow)
    compensator.rotation.x = Math.PI / 2
    compensator.position.set(0, 0.01, -0.7)

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.12), poly)
    grip.position.set(0, -0.14, 0.02)
    grip.rotation.x = 0.2

    const stockFold = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), mid)
    stockFold.rotation.z = Math.PI / 2
    stockFold.position.set(0.08, 0.02, 0.12)

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.08), mid)
    mag.position.set(0, -0.22, -0.12)

    const light = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.08), glow)
    light.position.set(0, 0.07, -0.22)

    root.add(body, barrel, compensator, grip, stockFold, mag, light)
    root.position.set(0.24, -0.24, -0.38)
    root.scale.setScalar(0.95)
  } else if (id === 'shotgun') {
    const receiver = latheBody(
      [
        [0.015, -0.15],
        [0.08, -0.08],
        [0.1, 0.05],
        [0.09, 0.18],
        [0.05, 0.28],
      ],
      dark,
    )
    receiver.rotation.z = Math.PI / 2
    receiver.position.set(0, -0.01, -0.12)

    const barrelTop = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.62, 14), mid)
    barrelTop.rotation.x = Math.PI / 2
    barrelTop.position.set(0, 0.04, -0.62)
    const barrelBot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.55, 14), mid)
    barrelBot.rotation.x = Math.PI / 2
    barrelBot.position.set(0, -0.02, -0.58)

    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.2, 12), poly)
    pump.rotation.x = Math.PI / 2
    pump.position.set(0, -0.02, -0.42)

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.32), poly)
    stock.position.set(0, -0.02, 0.22)
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.05), glow)
    pad.position.set(0, -0.02, 0.4)

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, 0.18, 12), poly)
    grip.position.set(0, -0.14, 0.02)
    grip.rotation.x = 0.4

    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 10), glow)
    bead.position.set(0, 0.08, -0.9)

    root.add(receiver, barrelTop, barrelBot, pump, stock, pad, grip, bead)
    root.position.set(0.28, -0.28, -0.4)
  } else {
    // rail pistol
    const slide = latheBody(
      [
        [0.01, -0.08],
        [0.045, -0.04],
        [0.05, 0.06],
        [0.04, 0.14],
        [0.02, 0.18],
      ],
      dark,
    )
    slide.rotation.z = Math.PI / 2
    slide.position.set(0, 0.02, -0.12)

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.28, 14), mid)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.03, -0.35)

    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 20), glow)
    coil.position.set(0, 0.03, -0.28)

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.22), poly)
    frame.position.set(0, -0.04, -0.02)

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.1), poly)
    grip.position.set(0, -0.16, 0.04)
    grip.rotation.x = 0.15

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), mid)
    mag.position.set(0, -0.18, 0.02)

    const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.02), glow)
    sightF.position.set(0, 0.08, -0.28)
    const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), glow)
    sightR.position.set(0, 0.08, 0.02)

    root.add(slide, barrel, coil, frame, grip, mag, sightF, sightR)
    root.position.set(0.22, -0.22, -0.35)
    root.scale.setScalar(1.05)
  }

  root.rotation.y = -0.03
  root.rotation.x = 0.03
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
    }
  })
  return root
}
