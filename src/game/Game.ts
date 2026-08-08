import * as THREE from 'three'
import { AudioBus } from './audio'
import { Effects } from './effects'
import { MatrixRain } from './matrixRain'
import {
  createArena,
  createBoss,
  createPickup,
  randomEdgeSpawn,
  spawnEnemy,
} from './entities'
import type { Enemy, EnemyKind, Pickup } from './entities'

export type AdminFlags = {
  god: boolean
  infiniteAmmo: boolean
  oneShot: boolean
  slowMo: boolean
  hardMode: boolean
}

type Projectile = {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  life: number
  damage: number
  fromEnemy: boolean
}

const ADMIN_STORAGE = 'matrix-neon-admin'

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200)
  private clock = new THREE.Clock()
  private rain: MatrixRain
  private effects: Effects
  private audio = new AudioBus()

  private keys = new Set<string>()
  private yaw = 0
  private pitch = 0
  private velocity = new THREE.Vector3()
  private playerPos = new THREE.Vector3(0, 1.7, 8)
  private health = 100
  private maxHealth = 100
  private ammo = 30
  private magSize = 30
  private reloading = false
  private reloadTimer = 0
  private fireCooldown = 0
  private dashCooldown = 0
  private score = 0
  private kills = 0
  private wave = 1
  private waveSpawned = false
  private waveClearTimer = 0
  private enemies: Enemy[] = []
  private pickups: Pickup[] = []
  private projectiles: Projectile[] = []
  private rapidTimer = 0
  private shieldTimer = 0
  private running = false
  private paused = false
  private pointerLocked = false
  private mouseDown = false
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private raycaster = new THREE.Raycaster()
  private spawnScratch = new THREE.Vector3()

  admin: AdminFlags = {
    god: false,
    infiniteAmmo: false,
    oneShot: false,
    slowMo: false,
    hardMode: false,
  }

  private el = {
    hud: document.getElementById('hud')!,
    menu: document.getElementById('menu')!,
    pause: document.getElementById('pause')!,
    gameover: document.getElementById('gameover')!,
    wave: document.getElementById('wave')!,
    score: document.getElementById('score')!,
    kills: document.getElementById('kills')!,
    healthBar: document.getElementById('health-bar') as HTMLDivElement,
    healthText: document.getElementById('health-text')!,
    ammo: document.getElementById('ammo')!,
    bossBar: document.getElementById('boss-bar')!,
    bossName: document.getElementById('boss-name')!,
    bossHealth: document.getElementById('boss-health') as HTMLDivElement,
    waveBanner: document.getElementById('wave-banner')!,
    hitMarker: document.getElementById('hit-marker')!,
    vignette: document.getElementById('damage-vignette')!,
    crosshair: document.getElementById('crosshair')!,
    finalStats: document.getElementById('final-stats')!,
    adminModal: document.getElementById('admin-modal')!,
    adminLogin: document.getElementById('admin-login')!,
    adminControls: document.getElementById('admin-controls')!,
    adminKey: document.getElementById('admin-key') as HTMLInputElement,
    adminError: document.getElementById('admin-error')!,
    adminStatus: document.getElementById('admin-status')!,
  }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color(0x020805)
    this.scene.fog = new THREE.FogExp2(0x020805, 0.028)

    createArena(this.scene)
    this.rain = new MatrixRain(this.scene)
    this.effects = new Effects(this.scene)
    this.camera.position.copy(this.playerPos)

    this.bindUi()
    this.bindInput()
    window.addEventListener('resize', () => this.onResize())
    this.onResize()
    this.tick()
  }

  private bindUi() {
    document.getElementById('start-btn')!.addEventListener('click', () => this.start())
    document.getElementById('resume-btn')!.addEventListener('click', () => this.resume())
    document.getElementById('restart-btn')!.addEventListener('click', () => this.start())
    document.getElementById('admin-open-btn')!.addEventListener('click', () => this.openAdmin())
    document.getElementById('admin-close-btn')!.addEventListener('click', () => this.closeAdmin())
    document.getElementById('admin-unlock-btn')!.addEventListener('click', () => this.tryAdminUnlock())
    this.el.adminKey.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.tryAdminUnlock()
    })
    document.querySelectorAll<HTMLButtonElement>('[data-admin]').forEach((btn) => {
      btn.addEventListener('click', () => this.runAdmin(btn.dataset.admin!))
    })
  }

  private bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code)
      if (e.code === 'Escape') {
        if (!this.el.adminModal.classList.contains('hidden')) {
          this.closeAdmin()
          return
        }
        if (this.running && !this.el.gameover.classList.contains('hidden')) return
        if (this.running) {
          if (this.paused) this.resume()
          else this.pause()
        }
      }
      if (e.code === 'KeyR' && this.running && !this.paused) this.reload()
      // secret chord: Ctrl+Shift+A opens admin login when paused or on menu
      if (e.code === 'KeyA' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        this.openAdmin()
      }
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))

    document.addEventListener('mousedown', (e) => {
      if (!this.running || this.paused) return
      if (!this.pointerLocked) {
        this.renderer.domElement.requestPointerLock()
        return
      }
      if (e.button === 0) {
        this.mouseDown = true
        this.tryShoot()
      }
    })
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false
    })

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked || this.paused || !this.running) return
      this.yaw -= e.movementX * 0.0022
      this.pitch -= e.movementY * 0.0022
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch))
    })

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement
    })
  }

  private onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  start() {
    this.audio.ensure()
    this.clearWorld()
    this.health = 100
    this.maxHealth = 100
    this.ammo = this.magSize
    this.reloading = false
    this.score = 0
    this.kills = 0
    this.wave = 1
    this.waveSpawned = false
    this.waveClearTimer = 0
    this.rapidTimer = 0
    this.shieldTimer = 0
    this.playerPos.set(0, 1.7, 8)
    this.velocity.set(0, 0, 0)
    this.yaw = 0
    this.pitch = 0
    this.running = true
    this.paused = false
    this.el.menu.classList.add('hidden')
    this.el.pause.classList.add('hidden')
    this.el.gameover.classList.add('hidden')
    this.el.adminModal.classList.add('hidden')
    this.el.hud.classList.remove('hidden')
    this.el.bossBar.classList.add('hidden')
    this.showBanner(`WAVE ${this.wave}`)
    this.renderer.domElement.requestPointerLock()
    this.updateHud()
  }

  pause() {
    this.paused = true
    document.exitPointerLock()
    this.el.pause.classList.remove('hidden')
  }

  resume() {
    this.paused = false
    this.el.pause.classList.add('hidden')
    this.el.adminModal.classList.add('hidden')
    this.renderer.domElement.requestPointerLock()
  }

  private gameOver() {
    this.running = false
    document.exitPointerLock()
    this.el.gameover.classList.remove('hidden')
    this.el.finalStats.textContent = `Wave ${this.wave} · Score ${this.score} · Kills ${this.kills}`
  }

  private clearWorld() {
    for (const e of this.enemies) this.scene.remove(e.mesh)
    for (const p of this.pickups) this.scene.remove(p.mesh)
    for (const p of this.projectiles) this.scene.remove(p.mesh)
    this.enemies = []
    this.pickups = []
    this.projectiles = []
    this.effects.clear()
  }

  private showBanner(text: string) {
    this.el.waveBanner.textContent = text
    this.el.waveBanner.classList.remove('hidden')
    window.setTimeout(() => this.el.waveBanner.classList.add('hidden'), 1600)
  }

  private updateHud() {
    this.el.wave.textContent = String(this.wave)
    this.el.score.textContent = String(this.score)
    this.el.kills.textContent = String(this.kills)
    const hpPct = Math.max(0, (this.health / this.maxHealth) * 100)
    this.el.healthBar.style.width = `${hpPct}%`
    this.el.healthText.textContent = String(Math.ceil(this.health))
    this.el.ammo.textContent = this.admin.infiniteAmmo
      ? '∞ / ∞'
      : this.reloading
        ? 'RELOADING'
        : `${this.ammo} / ∞`
  }

  private reload() {
    if (this.reloading || this.admin.infiniteAmmo || this.ammo >= this.magSize) return
    this.reloading = true
    this.reloadTimer = 1.1
    this.audio.reload()
  }

  private tryShoot() {
    if (this.reloading || this.fireCooldown > 0) return
    if (!this.admin.infiniteAmmo && this.ammo <= 0) {
      this.reload()
      return
    }
    if (!this.admin.infiniteAmmo) this.ammo--
    this.fireCooldown = this.rapidTimer > 0 ? 0.07 : 0.14
    this.audio.shoot()
    this.el.crosshair.classList.add('firing')
    window.setTimeout(() => this.el.crosshair.classList.remove('firing'), 80)

    const origin = this.camera.getWorldPosition(this.tmp.set(0, 0, 0))
    const dir = this.camera.getWorldDirection(this.tmp2)
    this.effects.muzzleFlash(origin.clone().addScaledVector(dir, 1.2))

    this.raycaster.set(origin, dir)
    const targets = this.enemies.filter((e) => e.alive).map((e) => e.mesh)
    const hits = this.raycaster.intersectObjects(targets, true)
    if (hits.length) {
      let obj: THREE.Object3D | null = hits[0].object
      let enemy: Enemy | undefined
      while (obj) {
        enemy = this.enemies.find((e) => e.mesh === obj)
        if (enemy) break
        obj = obj.parent
      }
      if (enemy && enemy.alive) {
        const dmg = this.admin.oneShot ? 99999 : this.rapidTimer > 0 ? 18 : 24
        this.damageEnemy(enemy, dmg, hits[0].point)
      }
    } else {
      // tracer miss spark in distance
      this.effects.burst(origin.clone().addScaledVector(dir, 40), 0x66ff99, 4, 2)
    }
    this.updateHud()
  }

  private damageEnemy(enemy: Enemy, amount: number, point: THREE.Vector3) {
    enemy.hp -= amount
    this.audio.hit()
    this.el.hitMarker.classList.remove('hidden')
    window.setTimeout(() => this.el.hitMarker.classList.add('hidden'), 120)
    this.effects.codeSpray(point)
    this.effects.addShake(enemy.kind === 'boss' ? 0.15 : 0.06)
    if (enemy.hp <= 0) this.killEnemy(enemy)
    this.updateBossBar()
  }

  private killEnemy(enemy: Enemy) {
    enemy.alive = false
    this.kills++
    this.score += enemy.score
    this.audio.explode()
    this.effects.burst(enemy.mesh.position.clone(), enemy.kind === 'boss' ? 0xff3355 : 0x00ff66, 40, 14)
    this.effects.ring(enemy.mesh.position.clone().setY(0.1), enemy.kind === 'boss' ? 0xff3355 : 0x00ff66)
    this.effects.addShake(enemy.kind === 'boss' ? 0.7 : 0.2)
    this.scene.remove(enemy.mesh)

    if (Math.random() < (enemy.kind === 'boss' ? 1 : 0.22)) {
      const kinds: Pickup['kind'][] = ['health', 'rapid', 'shield']
      const pickup = createPickup(kinds[Math.floor(Math.random() * kinds.length)], enemy.mesh.position)
      this.scene.add(pickup.mesh)
      this.pickups.push(pickup)
    }

    this.enemies = this.enemies.filter((e) => e.alive)
    this.updateHud()
    this.updateBossBar()
  }

  private updateBossBar() {
    const boss = this.enemies.find((e) => e.kind === 'boss' && e.alive)
    if (!boss) {
      this.el.bossBar.classList.add('hidden')
      return
    }
    this.el.bossBar.classList.remove('hidden')
    this.el.bossName.textContent = boss.name ?? 'BOSS'
    this.el.bossHealth.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`
  }

  private hurtPlayer(amount: number) {
    if (this.admin.god || this.shieldTimer > 0) return
    this.health -= amount
    this.audio.hurt()
    this.effects.addShake(0.35)
    this.el.vignette.classList.add('active')
    window.setTimeout(() => this.el.vignette.classList.remove('active'), 180)
    this.updateHud()
    if (this.health <= 0) this.gameOver()
  }

  private beginWave() {
    this.waveSpawned = true
    const isBoss = this.wave % 5 === 0
    if (isBoss) {
      const boss = createBoss(this.wave, this.admin.hardMode)
      randomEdgeSpawn(this.spawnScratch)
      boss.mesh.position.set(this.spawnScratch.x, 2.2, this.spawnScratch.z)
      this.scene.add(boss.mesh)
      this.enemies.push(boss)
      this.audio.boss()
      this.showBanner(`BOSS — ${boss.name}`)
      this.updateBossBar()
      // adds
      const adds = 2 + Math.floor(this.wave / 5)
      for (let i = 0; i < adds; i++) this.spawnWaveEnemy('agent')
      return
    }

    const count = 4 + this.wave * 2 + (this.admin.hardMode ? 3 : 0)
    for (let i = 0; i < count; i++) {
      const roll = Math.random()
      let kind: EnemyKind = 'agent'
      if (this.wave >= 2 && roll < 0.28) kind = 'runner'
      if (this.wave >= 3 && roll < 0.18) kind = 'tank'
      if (this.wave >= 4 && roll < 0.22) kind = 'drone'
      if (this.wave >= 7 && roll < 0.12) kind = 'tank'
      this.spawnWaveEnemy(kind)
    }
    this.showBanner(`WAVE ${this.wave}`)
  }

  private spawnWaveEnemy(kind: EnemyKind) {
    const e = spawnEnemy(kind, this.wave, this.admin.hardMode)
    randomEdgeSpawn(this.spawnScratch)
    e.mesh.position.set(
      this.spawnScratch.x,
      kind === 'drone' ? 3 + Math.random() * 2 : 1.1,
      this.spawnScratch.z,
    )
    this.scene.add(e.mesh)
    this.enemies.push(e)
  }

  // —— Admin ——
  openAdmin() {
    this.el.adminModal.classList.remove('hidden')
    this.el.adminError.classList.add('hidden')
    const unlocked = sessionStorage.getItem(ADMIN_STORAGE) === '1'
    this.el.adminLogin.classList.toggle('hidden', unlocked)
    this.el.adminControls.classList.toggle('hidden', !unlocked)
    if (!unlocked) {
      this.el.adminKey.value = ''
      this.el.adminKey.focus()
    }
    if (this.running) {
      this.paused = true
      document.exitPointerLock()
      this.el.pause.classList.add('hidden')
    }
  }

  closeAdmin() {
    this.el.adminModal.classList.add('hidden')
    if (this.running) this.resume()
  }

  tryAdminUnlock() {
    const expected = import.meta.env.VITE_ADMIN_PASSWORD || 'wake-up-neo'
    if (this.el.adminKey.value === expected) {
      sessionStorage.setItem(ADMIN_STORAGE, '1')
      this.el.adminLogin.classList.add('hidden')
      this.el.adminControls.classList.remove('hidden')
      this.el.adminError.classList.add('hidden')
      this.el.adminStatus.textContent = 'Root access granted'
    } else {
      this.el.adminError.classList.remove('hidden')
    }
  }

  runAdmin(cmd: string) {
    if (sessionStorage.getItem(ADMIN_STORAGE) !== '1') return
    switch (cmd) {
      case 'god':
        this.admin.god = !this.admin.god
        this.el.adminStatus.textContent = `God mode ${this.admin.god ? 'ON' : 'OFF'}`
        break
      case 'ammo':
        this.admin.infiniteAmmo = !this.admin.infiniteAmmo
        this.el.adminStatus.textContent = `Infinite ammo ${this.admin.infiniteAmmo ? 'ON' : 'OFF'}`
        this.updateHud()
        break
      case 'heal':
        this.health = this.maxHealth
        this.el.adminStatus.textContent = 'Integrity restored'
        this.updateHud()
        break
      case 'oneshot':
        this.admin.oneShot = !this.admin.oneShot
        this.el.adminStatus.textContent = `One-shot ${this.admin.oneShot ? 'ON' : 'OFF'}`
        break
      case 'boss': {
        if (!this.running) {
          this.el.adminStatus.textContent = 'Start a run first'
          break
        }
        const boss = createBoss(Math.max(5, this.wave), this.admin.hardMode)
        boss.mesh.position.set(0, 2.2, -20)
        this.scene.add(boss.mesh)
        this.enemies.push(boss)
        this.audio.boss()
        this.showBanner(`BOSS — ${boss.name}`)
        this.updateBossBar()
        this.el.adminStatus.textContent = `Spawned ${boss.name}`
        break
      }
      case 'skip':
        if (!this.running) break
        for (const e of [...this.enemies]) this.killEnemy(e)
        this.el.adminStatus.textContent = 'Wave cleared'
        break
      case 'slowmo':
        this.admin.slowMo = !this.admin.slowMo
        this.el.adminStatus.textContent = `Slow-mo ${this.admin.slowMo ? 'ON' : 'OFF'}`
        break
      case 'nuke':
        if (!this.running) break
        for (const e of [...this.enemies]) this.killEnemy(e)
        this.effects.addShake(1)
        this.audio.explode()
        this.el.adminStatus.textContent = 'Arena nuked'
        break
      case 'score':
        this.score += 5000
        this.updateHud()
        this.el.adminStatus.textContent = '+5000 score'
        break
      case 'hard':
        this.admin.hardMode = !this.admin.hardMode
        this.el.adminStatus.textContent = `Hard mode ${this.admin.hardMode ? 'ON' : 'OFF'}`
        break
    }
  }

  private tick = () => {
    requestAnimationFrame(this.tick)
    const rawDt = Math.min(0.05, this.clock.getDelta())
    const dt = this.admin.slowMo ? rawDt * 0.35 : rawDt

    this.rain.update(rawDt)

    if (this.running && !this.paused) {
      this.updatePlayer(dt)
      this.updateEnemies(dt)
      this.updateProjectiles(dt)
      this.updatePickups(dt)
      if (!this.waveSpawned) this.beginWave()
      if (this.waveSpawned && this.enemies.length === 0) {
        this.waveClearTimer += dt
        if (this.waveClearTimer > 1.4) {
          this.wave++
          this.waveSpawned = false
          this.waveClearTimer = 0
          this.score += 250 * this.wave
          this.updateHud()
        }
      }
    }

    // camera from player
    this.camera.position.copy(this.playerPos)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = this.yaw
    this.camera.rotation.x = this.pitch
    this.effects.update(rawDt, this.camera)
    this.renderer.render(this.scene, this.camera)
  }

  private updatePlayer(dt: number) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    this.rapidTimer = Math.max(0, this.rapidTimer - dt)
    this.shieldTimer = Math.max(0, this.shieldTimer - dt)

    if (this.reloading) {
      this.reloadTimer -= dt
      if (this.reloadTimer <= 0) {
        this.reloading = false
        this.ammo = this.magSize
        this.updateHud()
      }
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const wish = new THREE.Vector3()
    if (this.keys.has('KeyW')) wish.add(forward)
    if (this.keys.has('KeyS')) wish.sub(forward)
    if (this.keys.has('KeyD')) wish.add(right)
    if (this.keys.has('KeyA')) wish.sub(right)
    if (wish.lengthSq() > 0) wish.normalize()

    let speed = 9
    if (this.keys.has('ShiftLeft') && this.dashCooldown <= 0 && wish.lengthSq() > 0) {
      speed = 22
      this.dashCooldown = 1.1
      this.effects.ring(this.playerPos.clone().setY(0.15))
    }

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, wish.x * speed, 1 - Math.pow(0.001, dt))
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, wish.z * speed, 1 - Math.pow(0.001, dt))
    this.playerPos.x += this.velocity.x * dt
    this.playerPos.z += this.velocity.z * dt
    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -46, 46)
    this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -46, 46)
    this.playerPos.y = 1.7

    if (this.mouseDown) this.tryShoot()
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue
      e.hitCooldown = Math.max(0, e.hitCooldown - dt)
      e.shootCooldown = Math.max(0, e.shootCooldown - dt)
      e.phase += dt

      const target = this.playerPos
      const pos = e.mesh.position
      const toPlayer = this.tmp.copy(target).sub(pos)
      toPlayer.y = 0
      const dist = toPlayer.length()
      if (dist > 0.001) toPlayer.normalize()

      if (e.kind === 'drone') {
        pos.y = 3 + Math.sin(e.phase * 3) * 0.6
        pos.addScaledVector(toPlayer, e.speed * dt)
        e.mesh.rotation.y += dt * 3
        if (e.shootCooldown <= 0 && dist < 35) {
          e.shootCooldown = 1.4
          this.spawnEnemyShot(pos, toPlayer, 12, e.damage * 0.7)
        }
      } else if (e.kind === 'boss') {
        const orbit = Math.sin(e.phase * 1.2) * 0.5
        pos.addScaledVector(toPlayer, (e.speed + orbit) * dt)
        e.mesh.rotation.y += dt
        e.mesh.children[1].rotation.x += dt * 2
        e.mesh.children[1].rotation.y += dt * 1.4
        if (e.shootCooldown <= 0) {
          e.shootCooldown = Math.max(0.55, 1.2 - this.wave * 0.02)
          for (let i = -2; i <= 2; i++) {
            const dir = toPlayer
              .clone()
              .applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.18)
            this.spawnEnemyShot(pos, dir, 14, e.damage * 0.55)
          }
          if (e.hp < e.maxHp * 0.4) {
            this.effects.burst(pos.clone(), 0xff3355, 10, 6)
          }
        }
        if (dist < e.radius + 0.8 && e.hitCooldown <= 0) {
          e.hitCooldown = 0.7
          this.hurtPlayer(e.damage)
        }
      } else if (e.kind === 'runner') {
        pos.addScaledVector(toPlayer, e.speed * dt)
        e.mesh.lookAt(target.x, pos.y, target.z)
        if (dist < e.radius + 0.7 && e.hitCooldown <= 0) {
          e.hitCooldown = 0.45
          this.hurtPlayer(e.damage)
        }
      } else if (e.kind === 'tank') {
        pos.addScaledVector(toPlayer, e.speed * dt)
        e.mesh.lookAt(target.x, pos.y, target.z)
        if (e.shootCooldown <= 0 && dist < 28) {
          e.shootCooldown = 1.8
          this.spawnEnemyShot(pos, toPlayer, 10, e.damage)
        }
        if (dist < e.radius + 0.8 && e.hitCooldown <= 0) {
          e.hitCooldown = 0.8
          this.hurtPlayer(e.damage)
        }
      } else {
        pos.addScaledVector(toPlayer, e.speed * dt)
        e.mesh.lookAt(target.x, pos.y, target.z)
        if (dist < e.radius + 0.75 && e.hitCooldown <= 0) {
          e.hitCooldown = 0.6
          this.hurtPlayer(e.damage)
        }
      }

      pos.x = THREE.MathUtils.clamp(pos.x, -46, 46)
      pos.z = THREE.MathUtils.clamp(pos.z, -46, 46)
    }
  }

  private spawnEnemyShot(from: THREE.Vector3, dir: THREE.Vector3, speed: number, damage: number) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff3355 }),
    )
    mesh.position.copy(from)
    mesh.position.y += 0.6
    const vel = dir.clone().normalize().multiplyScalar(speed)
    this.scene.add(mesh)
    this.projectiles.push({ mesh, vel, life: 3, damage, fromEnemy: true })
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.life -= dt
      p.mesh.position.addScaledVector(p.vel, dt)
      if (p.fromEnemy) {
        const d = p.mesh.position.distanceTo(this.playerPos)
        if (d < 0.9) {
          this.hurtPlayer(p.damage)
          this.effects.bloodCode(p.mesh.position.clone())
          this.scene.remove(p.mesh)
          this.projectiles.splice(i, 1)
          continue
        }
      }
      if (p.life <= 0 || Math.abs(p.mesh.position.x) > 55 || Math.abs(p.mesh.position.z) > 55) {
        this.scene.remove(p.mesh)
        this.projectiles.splice(i, 1)
      }
    }
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]
      p.life -= dt
      p.mesh.rotation.y += dt * 2
      p.mesh.position.y = 1 + Math.sin(performance.now() * 0.005 + i) * 0.2
      if (p.mesh.position.distanceTo(this.playerPos) < 1.4) {
        if (p.kind === 'health') {
          this.health = Math.min(this.maxHealth, this.health + 35)
        } else if (p.kind === 'rapid') {
          this.rapidTimer = 8
        } else {
          this.shieldTimer = 6
        }
        this.audio.powerup()
        this.effects.ring(p.mesh.position.clone().setY(0.2), 0xffcc33)
        this.scene.remove(p.mesh)
        this.pickups.splice(i, 1)
        this.updateHud()
        continue
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        this.pickups.splice(i, 1)
      }
    }
  }
}
