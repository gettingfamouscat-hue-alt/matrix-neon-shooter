import * as THREE from 'three'

export class MatrixRain {
  private points: THREE.Points
  private velocities: Float32Array

  constructor(scene: THREE.Scene, count = 1400) {
    const positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120
      positions[i * 3 + 1] = Math.random() * 60
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120
      this.velocities[i] = 4 + Math.random() * 10
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0x00ff66,
      size: 0.18,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    this.points = new THREE.Points(geo, mat)
    scene.add(this.points)
  }

  update(dt: number) {
    const pos = this.points.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < this.velocities.length; i++) {
      let y = pos.getY(i) - this.velocities[i] * dt
      if (y < 0) y = 55 + Math.random() * 10
      pos.setY(i, y)
    }
    pos.needsUpdate = true
  }
}
