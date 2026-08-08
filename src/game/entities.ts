import * as THREE from 'three'

export type EnemyKind = 'agent' | 'runner' | 'tank' | 'drone' | 'boss'

export type Enemy = {
  mesh: THREE.Group
  kind: EnemyKind
  hp: number
  maxHp: number
  speed: number
  damage: number
  score: number
  radius: number
  hitCooldown: number
  shootCooldown: number
  phase: number
  name?: string
  alive: boolean
}

export type Pickup = {
  mesh: THREE.Mesh
  kind: 'health' | 'rapid' | 'shield'
  life: number
}

function neonMat(color: number, emissive = color) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.7,
    metalness: 0.2,
    roughness: 0.35,
  })
}

export function createArena(scene: THREE.Scene) {
  const floorGeo = new THREE.PlaneGeometry(100, 100, 40, 40)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x03140a,
    emissive: 0x003311,
    emissiveIntensity: 0.25,
    metalness: 0.6,
    roughness: 0.8,
    wireframe: false,
  })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const grid = new THREE.GridHelper(100, 50, 0x00ff66, 0x004422)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.35
  scene.add(grid)

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x021008,
    emissive: 0x002210,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.85,
  })

  const makeWall = (w: number, h: number, d: number, x: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat)
    mesh.position.set(x, h / 2, z)
    scene.add(mesh)
    return mesh
  }

  makeWall(102, 12, 2, 0, -50)
  makeWall(102, 12, 2, 0, 50)
  makeWall(2, 12, 102, -50, 0)
  makeWall(2, 12, 102, 50, 0)

  // pillars for cover
  const pillarMat = neonMat(0x06351c, 0x00ff66)
  pillarMat.emissiveIntensity = 0.25
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const r = 18 + (i % 2) * 8
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 8, 2.2), pillarMat)
    pillar.position.set(Math.cos(angle) * r, 4, Math.sin(angle) * r)
    scene.add(pillar)
  }

  const hemi = new THREE.HemisphereLight(0x66ff99, 0x020805, 0.55)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0x88ffaa, 0.8)
  key.position.set(20, 40, 10)
  scene.add(key)
  const accent = new THREE.PointLight(0x00ff66, 1.2, 80)
  accent.position.set(0, 10, 0)
  scene.add(accent)
}

function bodyFor(kind: EnemyKind): THREE.Group {
  const g = new THREE.Group()
  if (kind === 'agent') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.1, 4, 8), neonMat(0x111111, 0x00aa44))
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), neonMat(0x222222, 0x00ff66))
    head.position.y = 1.15
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.15), neonMat(0x001100, 0x00ff66))
    glasses.position.set(0, 1.2, 0.28)
    g.add(body, head, glasses)
  } else if (kind === 'runner') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 8), neonMat(0x003322, 0x33ff99))
    body.scale.set(0.85, 1.1, 0.85)
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), neonMat(0x00ffaa, 0x00ffaa))
    core.position.y = 0.6
    g.add(body, core)
  } else if (kind === 'tank') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.1), neonMat(0x1a0000, 0xff2244))
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.8), neonMat(0x330000, 0xff4466))
    shoulder.position.y = 0.7
    g.add(body, shoulder)
  } else if (kind === 'drone') {
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), neonMat(0x002244, 0x33ccff))
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.06, 8, 24),
      neonMat(0x33ccff, 0x33ccff),
    )
    ring.rotation.x = Math.PI / 2
    g.add(body, ring)
  } else {
    // boss shell
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6), neonMat(0x220011, 0xff0033))
    const aura = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.1, 0),
      new THREE.MeshBasicMaterial({
        color: 0xff3355,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      }),
    )
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), neonMat(0xffffff, 0xffcc00))
    g.add(body, aura, core)
  }
  return g
}

export function spawnEnemy(kind: EnemyKind, wave: number, hardMode: boolean): Enemy {
  const scale = 1 + (wave - 1) * 0.08 + (hardMode ? 0.25 : 0)
  const base: Record<EnemyKind, Omit<Enemy, 'mesh' | 'alive' | 'hitCooldown' | 'shootCooldown' | 'phase'>> = {
    agent: { kind, hp: 30 * scale, maxHp: 30 * scale, speed: 4.2, damage: 8, score: 100, radius: 0.7 },
    runner: { kind, hp: 18 * scale, maxHp: 18 * scale, speed: 8.5, damage: 6, score: 140, radius: 0.55 },
    tank: { kind, hp: 90 * scale, maxHp: 90 * scale, speed: 2.4, damage: 16, score: 220, radius: 1.1 },
    drone: { kind, hp: 22 * scale, maxHp: 22 * scale, speed: 5.5, damage: 10, score: 160, radius: 0.7 },
    boss: { kind, hp: 1, maxHp: 1, speed: 3.2, damage: 18, score: 2000, radius: 2.2 },
  }
  const cfg = base[kind]
  const mesh = bodyFor(kind)
  mesh.position.set(0, kind === 'drone' ? 3.2 : kind === 'boss' ? 2.2 : 1.1, 0)
  return {
    ...cfg,
    mesh,
    hitCooldown: 0,
    shootCooldown: 1,
    phase: 0,
    alive: true,
  }
}

export function createBoss(wave: number, hardMode: boolean): Enemy {
  const bosses = [
    { name: 'AGENT SMITH', color: 0x00ff66 },
    { name: 'SENTINEL PRIME', color: 0x33ccff },
    { name: 'THE ARCHITECT', color: 0xff3355 },
  ]
  const pick = bosses[(Math.floor(wave / 5) - 1) % bosses.length]
  const boss = spawnEnemy('boss', wave, hardMode)
  const hp = (380 + wave * 90) * (hardMode ? 1.35 : 1)
  boss.hp = hp
  boss.maxHp = hp
  boss.speed = 2.8 + wave * 0.05
  boss.damage = 18 + wave
  boss.score = 2500 + wave * 400
  boss.name = pick.name
  boss.mesh.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
      if (obj.material.emissive) obj.material.emissive.setHex(pick.color)
    }
  })
  return boss
}

export function createPickup(kind: Pickup['kind'], pos: THREE.Vector3): Pickup {
  const colors = { health: 0x00ff66, rapid: 0xffcc33, shield: 0x33ccff }
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35),
    new THREE.MeshStandardMaterial({
      color: colors[kind],
      emissive: colors[kind],
      emissiveIntensity: 1.2,
    }),
  )
  mesh.position.copy(pos)
  mesh.position.y = 1
  return { mesh, kind, life: 20 }
}

export function randomEdgeSpawn(out: THREE.Vector3) {
  const side = Math.floor(Math.random() * 4)
  const t = (Math.random() - 0.5) * 70
  if (side === 0) out.set(t, 0, -42)
  else if (side === 1) out.set(t, 0, 42)
  else if (side === 2) out.set(-42, 0, t)
  else out.set(42, 0, t)
  return out
}
