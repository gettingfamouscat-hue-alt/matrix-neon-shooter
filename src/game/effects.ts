import * as THREE from 'three'

type Particle = {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  life: number
  max: number
}

export class Effects {
  private particles: Particle[] = []
  private flashes: { light: THREE.PointLight; life: number }[] = []
  private shake = 0
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  getShake() {
    return this.shake
  }

  addShake(amount: number) {
    this.shake = Math.min(1.2, this.shake + amount)
  }

  muzzleFlash(origin: THREE.Vector3) {
    const light = new THREE.PointLight(0x88ffaa, 4, 18)
    light.position.copy(origin)
    this.scene.add(light)
    this.flashes.push({ light, life: 0.05 })
  }

  burst(origin: THREE.Vector3, color: number, count = 18, speed = 8) {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08)
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(origin)
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8,
        (Math.random() - 0.5) * speed,
      )
      this.scene.add(mesh)
      this.particles.push({ mesh, vel, life: 0.5 + Math.random() * 0.4, max: 0.9 })
    }
  }

  codeSpray(origin: THREE.Vector3) {
    this.burst(origin, 0x00ff66, 24, 10)
  }

  bloodCode(origin: THREE.Vector3) {
    this.burst(origin, 0xff3355, 14, 7)
  }

  ring(origin: THREE.Vector3, color = 0x00ff66) {
    const geo = new THREE.RingGeometry(0.2, 0.45, 32)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(origin)
    mesh.rotation.x = -Math.PI / 2
    this.scene.add(mesh)
    this.particles.push({
      mesh,
      vel: new THREE.Vector3(0, 0.2, 0),
      life: 0.45,
      max: 0.45,
    })
  }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    this.shake = Math.max(0, this.shake - dt * 2.2)
    if (this.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * this.shake * 0.25
      camera.position.y += (Math.random() - 0.5) * this.shake * 0.18
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.vel.y -= 6 * dt
      const mat = p.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, p.life / p.max)
      const s = 1 + (1 - p.life / p.max) * 1.5
      if (p.mesh.geometry.type === 'RingGeometry') {
        p.mesh.scale.setScalar(s * 2)
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        mat.dispose()
        this.particles.splice(i, 1)
      }
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]
      f.life -= dt
      f.light.intensity *= 0.5
      if (f.life <= 0) {
        this.scene.remove(f.light)
        this.flashes.splice(i, 1)
      }
    }
  }

  clear() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh)
      ;(p.mesh.material as THREE.Material).dispose()
    }
    this.particles = []
    for (const f of this.flashes) this.scene.remove(f.light)
    this.flashes = []
    this.shake = 0
  }
}
