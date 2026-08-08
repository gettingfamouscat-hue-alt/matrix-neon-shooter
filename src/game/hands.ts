import * as THREE from 'three'
import type { WeaponId } from './weapons'

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.25,
    roughness: 0.72,
    ...opts,
  })
}

/** First-person arms + tactical gloves gripping the gun. */
export function createViewHands(weaponId: WeaponId): THREE.Group {
  const hands = new THREE.Group()
  hands.name = 'viewHands'

  const sleeve = mat(0x0a100c, { metalness: 0.35, roughness: 0.55, emissive: 0x003311, emissiveIntensity: 0.08 })
  const glove = mat(0x151a16, { metalness: 0.2, roughness: 0.8 })
  const knuckle = mat(0x00ff66, { emissive: 0x00ff66, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.4 })
  const skin = mat(0x3d4f42, { metalness: 0.1, roughness: 0.85 })

  const makeArm = (side: 'left' | 'right') => {
    const arm = new THREE.Group()
    const sign = side === 'right' ? 1 : -1

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 6, 10), sleeve)
    forearm.rotation.x = Math.PI / 2
    forearm.position.set(sign * 0.02, -0.02, 0.12)

    const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), glove)
    wrist.position.set(sign * 0.02, -0.02, 0.0)

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.09), glove)
    palm.position.set(sign * 0.02, -0.03, -0.06)
    palm.rotation.x = -0.35

    // fingers curled around grip
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.045, 4, 6), glove)
      finger.position.set(sign * (-0.02 + i * 0.018), -0.045, -0.1)
      finger.rotation.x = 1.1
      arm.add(finger)
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 4, 6), glove)
    thumb.position.set(sign * 0.05, -0.015, -0.05)
    thumb.rotation.z = sign * -0.9
    thumb.rotation.x = 0.4

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.04), knuckle)
    pad.position.set(sign * 0.02, -0.01, -0.05)

    arm.add(forearm, wrist, palm, thumb, pad)
    return arm
  }

  const right = makeArm('right')
  const left = makeArm('left')

  // pose per weapon
  if (weaponId === 'rifle' || weaponId === 'smg') {
    right.position.set(0.04, -0.14, 0.02)
    right.rotation.set(0.15, 0.1, 0.15)
    left.position.set(-0.05, -0.06, -0.28)
    left.rotation.set(0.35, -0.15, -0.35)
  } else if (weaponId === 'shotgun') {
    right.position.set(0.05, -0.16, 0.04)
    right.rotation.set(0.2, 0.05, 0.2)
    left.position.set(-0.02, -0.08, -0.35)
    left.rotation.set(0.5, 0, -0.2)
  } else {
    // pistol — right hand only, left lower
    right.position.set(0.02, -0.14, 0.02)
    right.rotation.set(0.1, 0.05, 0.1)
    left.position.set(-0.12, -0.22, 0.08)
    left.rotation.set(0.6, 0.2, 0.4)
    left.scale.setScalar(0.85)
    // hide most of left for pistol feel — keep as support near body
    left.visible = true
  }

  // tiny cuff detail
  const cuffR = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.008, 6, 14), knuckle)
  cuffR.rotation.x = Math.PI / 2
  cuffR.position.copy(right.position)
  cuffR.position.z += 0.2
  cuffR.position.y -= 0.02

  hands.add(right, left, cuffR)

  // wrist skin peek under glove (subtle)
  const skinPeek = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.03, 8), skin)
  skinPeek.rotation.x = Math.PI / 2
  skinPeek.position.set(0.06, -0.14, 0.14)
  hands.add(skinPeek)

  hands.traverse((o) => {
    if (o instanceof THREE.Mesh) o.frustumCulled = false
  })
  return hands
}
