import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
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
import { WEAPONS, createWeaponModel } from './weapons'
import type { WeaponDef } from './weapons'

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

type Settings = {
  sensitivity: number
  adsSensitivity: number
  fov: number
}

const ADMIN_STORAGE = 'matrix-neon-admin'
const SETTINGS_KEY = 'matrix-neon-settings'
const BASE_SENS = 0.0022

export class Game {
  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(70, 1, 0.08, 220)
  private clock = new THREE.Clock()
  private rain: MatrixRain
  private effects: Effects
  private audio = new AudioBus()
  private weaponModels: THREE.Group[] = []
  private weapon: THREE.Group
  private weaponKick = 0
  private bobPhase = 0
  private weaponIndex = 0
  private ammoPools: number[] = WEAPONS.map((w) => w.magSize)

  private keys = new Set<string>()
  private yaw = 0
  private pitch = 0
  private velocity = new THREE.Vector3()
  private playerPos = new THREE.Vector3(0, 1.7, 8)
  private health = 100
  private maxHealth = 100
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
  private settingsOpen = false
  private pointerLocked = false
  private mouseDown = false
  private aiming = false
  private adsBlend = 0
  private settings: Settings = { sensitivity: 1, adsSensitivity: 0.65, fov: 70 }
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private shootDir = new THREE.Vector3()
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
    settings: document.getElementById('settings')!,
    wave: document.getElementById('wave')!,
    score: document.getElementById('score')!,
    kills: document.getElementById('kills')!,
    healthBar: document.getElementById('health-bar') as HTMLDivElement,
    healthText: document.getElementById('health-text')!,
    ammo: document.getElementById('ammo')!,
    weaponName: document.getElementById('weapon-name')!,
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
    sensSlider: document.getElementById('sens-slider') as HTMLInputElement,
    sensValue: document.getElementById('sens-value')!,
    adsSensSlider: document.getElementById('ads-sens-slider') as HTMLInputElement,
    adsSensValue: document.getElementById('ads-sens-value')!,
    fovSlider: document.getElementById('fov-slider') as HTMLInputElement,
    fovValue: document.getElementById('fov-value')!,
  }

  constructor(canvas: HTMLCanvasElement) {
    this.loadSettings()
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.scene.background = new THREE.Color(0x020805)
    this.scene.fog = new THREE.FogExp2(0x04140a, 0.018)

    createArena(this.scene, this.renderer)
    this.rain = new MatrixRain(this.scene, 900)
    this.effects = new Effects(this.scene)

    for (const def of WEAPONS) {
      const model = createWeaponModel(def.id)
      model.visible = false
      this.camera.add(model)
      this.weaponModels.push(model)
    }
    this.weapon = this.weaponModels[0]
    this.weapon.visible = true
    this.scene.add(this.camera)
    this.camera.fov = this.settings.fov
    this.camera.position.copy(this.playerPos)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.7, 0.35),
    )

    this.bindUi()
    this.bindInput()
    window.addEventListener('resize', () => this.onResize())
    this.onResize()
    this.tick()
  }

  private get currentWeapon(): WeaponDef {
    return WEAPONS[this.weaponIndex]
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<Settings>
      this.settings = {
        sensitivity: parsed.sensitivity ?? 1,
        adsSensitivity: parsed.adsSensitivity ?? 0.65,
        fov: parsed.fov ?? 70,
      }
    } catch {
      /* ignore */
    }
  }

  private saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
  }

  private syncSettingsUi() {
    this.el.sensSlider.value = String(this.settings.sensitivity)
    this.el.sensValue.textContent = this.settings.sensitivity.toFixed(2)
    this.el.adsSensSlider.value = String(this.settings.adsSensitivity)
    this.el.adsSensValue.textContent = this.settings.adsSensitivity.toFixed(2)
    this.el.fovSlider.value = String(this.settings.fov)
    this.el.fovValue.textContent = String(this.settings.fov)
  }

  private bindUi() {
    document.getElementById('start-btn')!.addEventListener('click', () => this.start())
    document.getElementById('resume-btn')!.addEventListener('click', () => this.resume())
    document.getElementById('restart-btn')!.addEventListener('click', () => this.start())
    document.getElementById('admin-open-btn')!.addEventListener('click', () => this.openAdmin())
    document.getElementById('admin-close-btn')!.addEventListener('click', () => this.closeAdmin())
    document.getElementById('admin-unlock-btn')!.addEventListener('click', () => this.tryAdminUnlock())
    document.getElementById('settings-open-btn')!.addEventListener('click', () => this.openSettings())
    document.getElementById('settings-close-btn')!.addEventListener('click', () => this.closeSettings())
    this.el.adminKey.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.tryAdminUnlock()
    })
    document.querySelectorAll<HTMLButtonElement>('[data-admin]').forEach((btn) => {
      btn.addEventListener('click', () => this.runAdmin(btn.dataset.admin!))
    })
    document.querySelectorAll<HTMLButtonElement>('[data-gun]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.gun)
        if (!Number.isNaN(idx)) this.switchWeapon(idx)
      })
    })

    const bindRange = (
      slider: HTMLInputElement,
      label: HTMLElement,
      key: keyof Settings,
      digits: number,
    ) => {
      slider.addEventListener('input', () => {
        const v = Number(slider.value)
        this.settings[key] = v
        label.textContent = digits ? v.toFixed(digits) : String(v)
        if (key === 'fov') {
          if (!this.aiming) {
            this.camera.fov = v
            this.camera.updateProjectionMatrix()
          }
        }
        this.saveSettings()
      })
    }
    bindRange(this.el.sensSlider, this.el.sensValue, 'sensitivity', 2)
    bindRange(this.el.adsSensSlider, this.el.adsSensValue, 'adsSensitivity', 2)
    bindRange(this.el.fovSlider, this.el.fovValue, 'fov', 0)
    this.syncSettingsUi()
  }

  private bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code)
      if (e.code === 'KeyM') {
        e.preventDefault()
        if (this.settingsOpen) this.closeSettings()
        else this.openSettings()
        return
      }
      if (e.code === 'Escape') {
        if (this.settingsOpen) {
          this.closeSettings()
          return
        }
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
      if (e.code === 'Digit1') this.switchWeapon(0)
      if (e.code === 'Digit2') this.switchWeapon(1)
      if (e.code === 'Digit3') this.switchWeapon(2)
      if (e.code === 'Digit4') this.switchWeapon(3)
      if (e.code === 'KeyA' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        this.openAdmin()
      }
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))

    document.addEventListener('contextmenu', (e) => e.preventDefault())

    document.addEventListener('mousedown', (e) => {
      if (!this.running || this.paused || this.settingsOpen) return
      if (!this.pointerLocked) {
        this.renderer.domElement.requestPointerLock()
        return
      }
      if (e.button === 0) {
        this.mouseDown = true
        this.tryShoot()
      }
      if (e.button === 2) this.aiming = true
    })
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false
      if (e.button === 2) this.aiming = false
    })

    document.addEventListener('wheel', (e) => {
      if (!this.running || this.paused || this.settingsOpen) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? 1 : -1
      this.switchWeapon((this.weaponIndex + dir + WEAPONS.length) % WEAPONS.length)
    }, { passive: false })

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked || this.paused || !this.running || this.settingsOpen) return
      const adsMul = THREE.MathUtils.lerp(1, this.settings.adsSensitivity, this.adsBlend)
      const sens = BASE_SENS * this.settings.sensitivity * adsMul
      this.yaw -= e.movementX * sens
      this.pitch -= e.movementY * sens
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch))
    })

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement
      if (!this.pointerLocked) this.aiming = false
    })
  }

  private onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
  }

  openSettings() {
    this.settingsOpen = true
    this.paused = true
    this.aiming = false
    document.exitPointerLock()
    this.el.pause.classList.add('hidden')
    this.el.settings.classList.remove('hidden')
    this.syncSettingsUi()
  }

  closeSettings() {
    this.settingsOpen = false
    this.el.settings.classList.add('hidden')
    if (this.running) {
      this.paused = false
      this.renderer.domElement.requestPointerLock()
    } else if (!this.el.pause.classList.contains('hidden')) {
      /* stay on pause if opened from there somehow */
    }
  }

  start() {
    this.audio.ensure()
    this.clearWorld()
    this.health = 100
    this.maxHealth = 100
    this.ammoPools = WEAPONS.map((w) => w.magSize)
    this.weaponIndex = 0
    this.applyWeaponModel()
    this.reloading = false
    this.score = 0
    this.kills = 0
    this.wave = 1
    this.waveSpawned = false
    this.waveClearTimer = 0
    this.rapidTimer = 0
    this.shieldTimer = 0
    this.aiming = false
    this.adsBlend = 0
    this.playerPos.set(0, 1.7, 8)
    this.velocity.set(0, 0, 0)
    this.yaw = 0
    this.pitch = 0
    this.running = true
    this.paused = false
    this.settingsOpen = false
    this.el.menu.classList.add('hidden')
    this.el.pause.classList.add('hidden')
    this.el.gameover.classList.add('hidden')
    this.el.adminModal.classList.add('hidden')
    this.el.settings.classList.add('hidden')
    this.el.hud.classList.remove('hidden')
    this.el.bossBar.classList.add('hidden')
    this.showBanner(`WAVE ${this.wave}`)
    this.renderer.domElement.requestPointerLock()
    this.updateHud()
  }

  pause() {
    this.paused = true
    this.aiming = false
    document.exitPointerLock()
    this.el.pause.classList.remove('hidden')
  }

  resume() {
    this.paused = false
    this.settingsOpen = false
    this.el.pause.classList.add('hidden')
    this.el.adminModal.classList.add('hidden')
    this.el.settings.classList.add('hidden')
    this.renderer.domElement.requestPointerLock()
  }

  private gameOver() {
    this.running = false
    this.aiming = false
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

  private switchWeapon(index: number) {
    if (!this.running || this.paused || this.settingsOpen) return
    if (index < 0 || index >= WEAPONS.length || index === this.weaponIndex) return
    if (this.reloading) {
      this.reloading = false
      this.reloadTimer = 0
    }
    this.weaponIndex = index
    this.applyWeaponModel()
    this.fireCooldown = 0.15
    this.audio.switchWeapon()
    this.updateHud()
  }

  private applyWeaponModel() {
    for (let i = 0; i < this.weaponModels.length; i++) {
      this.weaponModels[i].visible = i === this.weaponIndex
    }
    this.weapon = this.weaponModels[this.weaponIndex]
    document.querySelectorAll<HTMLButtonElement>('[data-gun]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.gun) === this.weaponIndex)
    })
  }

  private updateHud() {
    const w = this.currentWeapon
    this.el.wave.textContent = String(this.wave)
    this.el.score.textContent = String(this.score)
    this.el.kills.textContent = String(this.kills)
    this.el.weaponName.textContent = w.name
    const hpPct = Math.max(0, (this.health / this.maxHealth) * 100)
    this.el.healthBar.style.width = `${hpPct}%`
    this.el.healthText.textContent = String(Math.ceil(this.health))
    const ammo = this.ammoPools[this.weaponIndex]
    this.el.ammo.textContent = this.admin.infiniteAmmo
      ? '∞ / ∞'
      : this.reloading
        ? 'RELOADING'
        : `${ammo} / ${w.magSize}`
  }

  private reload() {
    const w = this.currentWeapon
    const ammo = this.ammoPools[this.weaponIndex]
    if (this.reloading || this.admin.infiniteAmmo || ammo >= w.magSize) return
    this.reloading = true
    this.reloadTimer = w.reloadTime
    this.audio.reload()
    this.updateHud()
  }

  private tryShoot() {
    const w = this.currentWeapon
    if (this.reloading || this.fireCooldown > 0) return
    if (!w.auto && !this.mouseDown) return
    // semi-auto: only fire once per click — handled by fireCooldown + mouseDown edge
    if (!this.admin.infiniteAmmo && this.ammoPools[this.weaponIndex] <= 0) {
      this.reload()
      return
    }
    if (!this.admin.infiniteAmmo) this.ammoPools[this.weaponIndex]--
    const rate = this.rapidTimer > 0 ? w.fireRate * 0.65 : w.fireRate
    this.fireCooldown = rate
    this.audio.shoot(w.id)
    this.weaponKick = w.kick
    this.el.crosshair.classList.add('firing')
    window.setTimeout(() => this.el.crosshair.classList.remove('firing'), 80)

    const origin = this.camera.getWorldPosition(this.tmp.set(0, 0, 0))
    const baseDir = this.camera.getWorldDirection(this.tmp2)
    this.effects.muzzleFlash(origin.clone().addScaledVector(baseDir, 1.35))

    const spreadScale = THREE.MathUtils.lerp(1, 0.25, this.adsBlend)
    const targets = this.enemies.filter((e) => e.alive).map((e) => e.mesh)

    for (let p = 0; p < w.pellets; p++) {
      this.shootDir.copy(baseDir)
      if (w.spread > 0) {
        this.shootDir.x += (Math.random() - 0.5) * w.spread * spreadScale
        this.shootDir.y += (Math.random() - 0.5) * w.spread * spreadScale
        this.shootDir.z += (Math.random() - 0.5) * w.spread * spreadScale
        this.shootDir.normalize()
      }
      this.raycaster.set(origin, this.shootDir)
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
          const dmg = this.admin.oneShot
            ? 99999
            : w.damage * (this.rapidTimer > 0 ? 1.15 : 1) * (1 + this.adsBlend * 0.15)
          this.damageEnemy(enemy, dmg, hits[0].point)
        }
      } else if (p === 0) {
        this.effects.burst(origin.clone().addScaledVector(this.shootDir, 40), 0x66ff99, 4, 2)
      }
    }

    // semi-auto: consume the click so holding doesn't spray
    if (!w.auto) this.mouseDown = false
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
      boss.mesh.position.set(this.spawnScratch.x, 2, this.spawnScratch.z)
      this.scene.add(boss.mesh)
      this.enemies.push(boss)
      this.audio.boss()
      this.showBanner(`BOSS — ${boss.name}`)
      this.updateBossBar()
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
      kind === 'drone' ? 3 + Math.random() * 2 : kind === 'boss' ? 2 : 0,
      this.spawnScratch.z,
    )
    this.scene.add(e.mesh)
    this.enemies.push(e)
  }

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
      this.aiming = false
      document.exitPointerLock()
      this.el.pause.classList.add('hidden')
      this.el.settings.classList.add('hidden')
      this.settingsOpen = false
    }
  }

  closeAdmin() {
    this.el.adminModal.classList.add('hidden')
    if (this.running) this.resume()
  }

  tryAdminUnlock() {
    const expected = import.meta.env.VITE_ADMIN_PASSWORD
    if (expected && this.el.adminKey.value === expected) {
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
        boss.mesh.position.set(0, 2, -20)
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

    // ADS blend + FOV
    const adsTarget = this.aiming && this.running && !this.paused ? 1 : 0
    this.adsBlend = THREE.MathUtils.lerp(this.adsBlend, adsTarget, 1 - Math.pow(0.0008, rawDt))
    const wpn = this.currentWeapon
    const targetFov = THREE.MathUtils.lerp(this.settings.fov, wpn.adsFov, this.adsBlend)
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov
      this.camera.updateProjectionMatrix()
    }
    this.el.crosshair.classList.toggle('ads', this.adsBlend > 0.5)

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

    this.camera.position.copy(this.playerPos)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = this.yaw
    this.camera.rotation.x = this.pitch

    this.weaponKick = Math.max(0, this.weaponKick - rawDt * 8)
    const moving =
      this.running &&
      !this.paused &&
      (this.keys.has('KeyW') ||
        this.keys.has('KeyA') ||
        this.keys.has('KeyS') ||
        this.keys.has('KeyD'))
    if (moving) this.bobPhase += rawDt * (this.aiming ? 6 : 10)
    const bobAmp = THREE.MathUtils.lerp(1, 0.25, this.adsBlend)
    const bobY = moving ? Math.sin(this.bobPhase) * 0.015 * bobAmp : 0
    const bobX = moving ? Math.cos(this.bobPhase * 0.5) * 0.01 * bobAmp : 0

    // hip vs ADS weapon pose
    const hip = { x: 0.26, y: -0.26, z: -0.42 }
    const ads = { x: 0.0, y: -0.16, z: -0.28 }
    const px = THREE.MathUtils.lerp(hip.x, ads.x, this.adsBlend) + bobX
    const py =
      THREE.MathUtils.lerp(hip.y, ads.y, this.adsBlend) + bobY - this.weaponKick * 0.04
    const pz =
      THREE.MathUtils.lerp(hip.z, ads.z, this.adsBlend) - this.weaponKick * 0.08
    // keep each model's local offset, then blend root
    this.weapon.position.set(px, py, pz)
    this.weapon.rotation.x = THREE.MathUtils.lerp(0.03, 0, this.adsBlend) + this.weaponKick * 0.1
    this.weapon.rotation.y = THREE.MathUtils.lerp(-0.03, 0, this.adsBlend)

    this.effects.update(rawDt, this.camera)
    this.composer.render()
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
        this.ammoPools[this.weaponIndex] = this.currentWeapon.magSize
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

    let speed = this.aiming ? 5.5 : 9
    if (this.keys.has('ShiftLeft') && this.dashCooldown <= 0 && wish.lengthSq() > 0 && !this.aiming) {
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

    if (this.mouseDown && this.currentWeapon.auto) this.tryShoot()
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
        const aura = e.mesh.getObjectByName('bossAura')
        if (aura) {
          aura.rotation.x += dt * 2
          aura.rotation.y += dt * 1.4
        }
        if (e.shootCooldown <= 0) {
          e.shootCooldown = Math.max(0.55, 1.2 - this.wave * 0.02)
          for (let i = -2; i <= 2; i++) {
            const dir = toPlayer.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.18)
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
