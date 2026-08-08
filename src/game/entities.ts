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

function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 512,
) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  draw(ctx, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function floorTexture() {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#06150c'
    ctx.fillRect(0, 0, size, size)
    const step = 32
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const g = 18 + ((x * 13 + y * 7) % 22)
        ctx.fillStyle = `rgb(${g * 0.35}, ${g}, ${g * 0.45})`
        ctx.fillRect(x + 1, y + 1, step - 2, step - 2)
        ctx.strokeStyle = 'rgba(0,255,102,0.12)'
        ctx.strokeRect(x + 0.5, y + 0.5, step - 1, step - 1)
        if ((x + y) % 96 === 0) {
          ctx.fillStyle = 'rgba(0,255,120,0.18)'
          ctx.font = '14px monospace'
          ctx.fillText(String.fromCharCode(0x30a0 + ((x + y) % 90)), x + 8, y + 20)
        }
      }
    }
  })
}

function wallTexture() {
  return makeCanvasTexture((ctx, size) => {
    const grad = ctx.createLinearGradient(0, 0, 0, size)
    grad.addColorStop(0, '#04160c')
    grad.addColorStop(1, '#010805')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * size
      ctx.strokeStyle = `rgba(0,255,102,${0.04 + Math.random() * 0.1})`
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, size)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(0,255,102,0.2)'
    ctx.lineWidth = 2
    ctx.strokeRect(8, 8, size - 16, size - 16)
  })
}

function mat(opts: {
  color: number
  emissive?: number
  emissiveIntensity?: number
  metalness?: number
  roughness?: number
  map?: THREE.Texture
}) {
  return new THREE.MeshStandardMaterial({
    color: opts.color,
    map: opts.map,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.4,
  })
}

export function createArena(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const floorMap = floorTexture()
  floorMap.repeat.set(12, 12)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    mat({
      color: 0xffffff,
      map: floorMap,
      metalness: 0.72,
      roughness: 0.28,
      emissive: 0x003311,
      emissiveIntensity: 0.15,
    }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const grid = new THREE.GridHelper(100, 50, 0x33ff88, 0x0a3a1c)
  const gridMat = grid.material as THREE.Material
  gridMat.transparent = true
  gridMat.opacity = 0.22
  scene.add(grid)

  const wallMap = wallTexture()
  wallMap.repeat.set(4, 1)
  const wallMat = mat({
    color: 0xffffff,
    map: wallMap,
    metalness: 0.35,
    roughness: 0.65,
    emissive: 0x002210,
    emissiveIntensity: 0.25,
  })

  const makeWall = (w: number, h: number, d: number, x: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat)
    mesh.position.set(x, h / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  makeWall(102, 14, 1.5, 0, -50)
  makeWall(102, 14, 1.5, 0, 50)
  makeWall(1.5, 14, 102, -50, 0)
  makeWall(1.5, 14, 102, 50, 0)

  // ceiling with light strips
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    mat({ color: 0x020805, metalness: 0.8, roughness: 0.5, emissive: 0x001508, emissiveIntensity: 0.2 }),
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = 14
  scene.add(ceiling)

  for (let i = -3; i <= 3; i++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(90, 0.08, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0x00ff66,
        emissive: 0x00ff66,
        emissiveIntensity: 1.4,
        metalness: 0.2,
        roughness: 0.3,
      }),
    )
    strip.position.set(0, 13.7, i * 12)
    scene.add(strip)
    const light = new THREE.PointLight(0x66ff99, 0.55, 28, 2)
    light.position.set(0, 12.5, i * 12)
    scene.add(light)
  }

  // cover clusters
  const concrete = mat({
    color: 0x1a2a20,
    metalness: 0.45,
    roughness: 0.55,
    emissive: 0x00ff66,
    emissiveIntensity: 0.08,
  })
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2
    const r = 16 + (i % 3) * 7
    const group = new THREE.Group()
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 7.5, 12), concrete)
    pillar.position.y = 3.75
    pillar.castShadow = true
    pillar.receiveShadow = true
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.4), concrete)
    crate.position.set(1.6, 0.7, 0.4)
    crate.castShadow = true
    crate.receiveShadow = true
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.05, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0x00ff66,
        emissive: 0x00ff66,
        emissiveIntensity: 0.9,
      }),
    )
    rim.rotation.x = Math.PI / 2
    rim.position.y = 7.2
    group.add(pillar, crate, rim)
    group.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r)
    scene.add(group)
  }

  // ambient + key light with shadows
  scene.add(new THREE.AmbientLight(0x143322, 0.35))
  scene.add(new THREE.HemisphereLight(0x88ffbb, 0x020805, 0.55))

  const key = new THREE.DirectionalLight(0xc8ffe0, 1.15)
  key.position.set(18, 32, 12)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 1
  key.shadow.camera.far = 90
  key.shadow.camera.left = -45
  key.shadow.camera.right = 45
  key.shadow.camera.top = 45
  key.shadow.camera.bottom = -45
  key.shadow.bias = -0.0002
  scene.add(key)

  const fill = new THREE.DirectionalLight(0x224433, 0.45)
  fill.position.set(-20, 10, -15)
  scene.add(fill)

  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
}

function addShadow(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
}

function limb(
  w: number,
  h: number,
  d: number,
  color: number,
  emissive = 0x003311,
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat({ color, emissive, emissiveIntensity: 0.2, metalness: 0.4, roughness: 0.45 }),
  )
}

function bodyFor(kind: EnemyKind): THREE.Group {
  const g = new THREE.Group()

  if (kind === 'agent') {
    const suit = mat({ color: 0x101410, metalness: 0.65, roughness: 0.35, emissive: 0x00ff66, emissiveIntensity: 0.05 })
    const skin = mat({ color: 0x2a3a2e, metalness: 0.2, roughness: 0.7 })
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.85, 6, 12), suit)
    torso.position.y = 1.35
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), skin)
    head.position.y = 2.15
    const glasses = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.1, 0.08),
      mat({ color: 0x050805, metalness: 0.9, roughness: 0.15, emissive: 0x00ff66, emissiveIntensity: 0.7 }),
    )
    glasses.position.set(0, 2.18, 0.24)
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.55, 0.04),
      mat({ color: 0x111111, emissive: 0x00aa44, emissiveIntensity: 0.35 }),
    )
    tie.position.set(0, 1.35, 0.34)
    const armL = limb(0.16, 0.7, 0.16, 0x101410)
    armL.position.set(-0.52, 1.35, 0)
    const armR = limb(0.16, 0.7, 0.16, 0x101410)
    armR.position.set(0.52, 1.35, 0)
    const legL = limb(0.2, 0.85, 0.22, 0x0c100c)
    legL.position.set(-0.2, 0.45, 0)
    const legR = limb(0.2, 0.85, 0.22, 0x0c100c)
    legR.position.set(0.2, 0.45, 0)
    g.add(torso, head, glasses, tie, armL, armR, legL, legR)
  } else if (kind === 'runner') {
    const neon = mat({
      color: 0x0a2a1a,
      emissive: 0x33ff99,
      emissiveIntensity: 0.55,
      metalness: 0.7,
      roughness: 0.25,
    })
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 12), neon)
    torso.position.y = 1.15
    torso.scale.set(0.85, 1.15, 0.85)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), neon)
    head.position.y = 1.85
    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.7, 8),
      new THREE.MeshStandardMaterial({
        color: 0x33ff99,
        emissive: 0x33ff99,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.65,
      }),
    )
    trail.position.set(0, 0.9, 0.35)
    trail.rotation.x = Math.PI / 2
    g.add(torso, head, trail)
  } else if (kind === 'tank') {
    const armor = mat({
      color: 0x2a1010,
      emissive: 0xff2244,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.3,
    })
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.2), armor)
    body.position.y = 1.2
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 0.9), armor)
    shoulder.position.y = 1.85
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), armor)
    head.position.y = 2.25
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.08),
      mat({ color: 0xff6688, emissive: 0xff3355, emissiveIntensity: 1.2 }),
    )
    visor.position.set(0, 2.28, 0.3)
    const legL = limb(0.35, 0.9, 0.4, 0x220808, 0xff2244)
    legL.position.set(-0.4, 0.45, 0)
    const legR = limb(0.35, 0.9, 0.4, 0x220808, 0xff2244)
    legR.position.set(0.4, 0.45, 0)
    g.add(body, shoulder, head, visor, legL, legR)
  } else if (kind === 'drone') {
    const shell = mat({
      color: 0x102030,
      emissive: 0x33ccff,
      emissiveIntensity: 0.55,
      metalness: 0.9,
      roughness: 0.2,
    })
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), shell)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.05, 10, 32),
      mat({ color: 0x33ccff, emissive: 0x33ccff, emissiveIntensity: 1.1, metalness: 0.8, roughness: 0.2 }),
    )
    ring.rotation.x = Math.PI / 2
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 12),
      mat({ color: 0xffffff, emissive: 0x66eeff, emissiveIntensity: 1.5 }),
    )
    lens.position.z = 0.38
    g.add(body, ring, lens)
  } else {
    const body = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.5, 0),
      mat({
        color: 0x2a0810,
        emissive: 0xff0033,
        emissiveIntensity: 0.55,
        metalness: 0.85,
        roughness: 0.25,
      }),
    )
    body.position.y = 0.2
    const aura = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.05, 1),
      new THREE.MeshBasicMaterial({
        color: 0xff3355,
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      }),
    )
    aura.position.y = 0.2
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 20, 20),
      mat({ color: 0xffeecc, emissive: 0xffcc00, emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.2 }),
    )
    core.position.y = 0.2
    g.add(body, aura, core)
  }

  addShadow(g)
  return g
}

export function spawnEnemy(kind: EnemyKind, wave: number, hardMode: boolean): Enemy {
  const scale = 1 + (wave - 1) * 0.08 + (hardMode ? 0.25 : 0)
  const base: Record<
    EnemyKind,
    Omit<Enemy, 'mesh' | 'alive' | 'hitCooldown' | 'shootCooldown' | 'phase'>
  > = {
    agent: { kind, hp: 30 * scale, maxHp: 30 * scale, speed: 4.2, damage: 8, score: 100, radius: 0.7 },
    runner: { kind, hp: 18 * scale, maxHp: 18 * scale, speed: 8.5, damage: 6, score: 140, radius: 0.55 },
    tank: { kind, hp: 90 * scale, maxHp: 90 * scale, speed: 2.4, damage: 16, score: 220, radius: 1.1 },
    drone: { kind, hp: 22 * scale, maxHp: 22 * scale, speed: 5.5, damage: 10, score: 160, radius: 0.7 },
    boss: { kind, hp: 1, maxHp: 1, speed: 3.2, damage: 18, score: 2000, radius: 2.2 },
  }
  const cfg = base[kind]
  const mesh = bodyFor(kind)
  mesh.position.set(0, kind === 'drone' ? 3.2 : kind === 'boss' ? 2.0 : 0, 0)
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
    mat({
      color: colors[kind],
      emissive: colors[kind],
      emissiveIntensity: 1.3,
      metalness: 0.6,
      roughness: 0.25,
    }),
  )
  mesh.position.copy(pos)
  mesh.position.y = 1
  mesh.castShadow = true
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

export function createWeapon(): THREE.Group {
  const gun = new THREE.Group()
  const metal = mat({ color: 0x1a221c, metalness: 0.9, roughness: 0.25, emissive: 0x00ff66, emissiveIntensity: 0.08 })
  const accent = mat({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3 })

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.7), metal)
  body.position.set(0, -0.05, -0.25)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.55, 12), metal)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0, -0.02, -0.75)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.16), metal)
  grip.position.set(0, -0.22, -0.05)
  grip.rotation.x = 0.25
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.14), metal)
  mag.position.set(0, -0.28, -0.2)
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.12), accent)
  sight.position.set(0, 0.1, -0.35)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.4), accent)
  rail.position.set(0, 0.07, -0.3)

  gun.add(body, barrel, grip, mag, sight, rail)
  gun.position.set(0.28, -0.28, -0.45)
  gun.rotation.y = -0.04
  gun.rotation.x = 0.04
  return gun
}
