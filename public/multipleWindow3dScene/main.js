import WindowManager from './WindowManager.js'

const t = THREE
let camera, scene, renderer, world
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1
let particleGroups = []
let gravityBridge = null
let gravityState = null
let lastRenderTime = 0
let sceneOffsetTarget = { x: 0, y: 0 }
let sceneOffset = { x: 0, y: 0 }

const GRAVITY_BRIDGE_COUNT = 1100
const GRAVITY_SEPARATE_START = 48

let fogParticleTexture = null

function getFogParticleTexture() {
	if (fogParticleTexture) return fogParticleTexture
	const size = 64
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext('2d')
	const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
	g.addColorStop(0, 'rgba(255,255,255,0.95)')
	g.addColorStop(0.4, 'rgba(255,255,255,0.35)')
	g.addColorStop(1, 'rgba(255,255,255,0)')
	ctx.fillStyle = g
	ctx.fillRect(0, 0, size, size)
	fogParticleTexture = new t.CanvasTexture(canvas)
	return fogParticleTexture
}

/** 桥截面半径系数：两端粗、中间细（与参考图一致） */
function bridgeThicknessAt(tAlong) {
	const end = Math.abs(tAlong - 0.5) * 2
	return 0.1 + 0.34 * Math.pow(end, 0.82)
}

let today = new Date()
today.setHours(0)
today.setMinutes(0)
today.setSeconds(0)
today.setMilliseconds(0)
today = today.getTime()

let windowManager
let initialized = false
let raycaster
let pointerNdc = new t.Vector2()

function getTime() {
  return (new Date().getTime() - today) / 1000.0
}

/** 3D 心形隐式曲面内一点 */
function isInsideHeart(x, y, z) {
  const a = x * x + 2.25 * y * y + z * z - 1
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z <= 0
}

/** 心形表面薄壳（轮廓更清晰） */
function isOnHeartSurface(x, y, z, thickness) {
  if (!isInsideHeart(x, y, z)) return false
  const s = 1 - thickness
  return !isInsideHeart(x * s, y * s, z * s)
}

/** 在 3D 心形体内采样（尖朝下） */
function sampleHeartPoint(heartScale, jitterAmt, surfaceOnly) {
  for (let attempt = 0; attempt < 64; attempt++) {
    const x = (Math.random() * 2 - 1) * 1.55
    const y = (Math.random() * 2 - 1) * 1.55
    const z = (Math.random() * 2 - 1) * 1.15
    const inside = isInsideHeart(x, y, z)
    if (!inside) continue
    if (surfaceOnly && !isOnHeartSurface(x, y, z, 0.1)) continue
    return {
      x: x * heartScale + (Math.random() - 0.5) * jitterAmt,
      y: y * heartScale + (Math.random() - 0.5) * jitterAmt,
      z: z * heartScale + (Math.random() - 0.5) * jitterAmt
    }
  }
  return null
}

function isInsideHeartAt(px, py, pz, heartScale) {
  return isInsideHeart(px / heartScale, py / heartScale, pz / heartScale)
}

/** 球形 + 心形粒子（第 2 个窗口为蓝紫色，其余为绿色） */
function createGreenSphereParticles(radius, windowIndex) {
  const maxCount = 5800
  const positions = new Float32Array(maxCount * 3)
  const colors = new Float32Array(maxCount * 3)
  let count = 0
  const heartScale = radius * 0.48
  const isSecondWindow = windowIndex === 1

  function pushParticle(x, y, z, brightness) {
    if (count >= maxCount) return
    const i = count * 3
    positions[i] = x
    positions[i + 1] = y
    positions[i + 2] = z
    const glow = 0.15 + brightness * 0.85
    if (isSecondWindow) {
      colors[i] = (0.32 + brightness * 0.28) * glow
      colors[i + 1] = (0.12 + brightness * 0.22) * glow
      colors[i + 2] = (0.55 + brightness * 0.45) * glow
    } else {
      const g = 0.35 + brightness * 0.65
      colors[i] = 0.05 * glow
      colors[i + 1] = g * glow
      colors[i + 2] = 0.12 * glow
    }
    count++
  }

  /** 心形专用：更亮，便于从球壳中区分 */
  function pushHeartParticle(x, y, z, brightness) {
    if (count >= maxCount) return
    const i = count * 3
    positions[i] = x
    positions[i + 1] = y
    positions[i + 2] = z
    const glow = 0.55 + brightness * 0.45
    if (isSecondWindow) {
      colors[i] = (0.4 + brightness * 0.35) * glow
      colors[i + 1] = (0.18 + brightness * 0.3) * glow
      colors[i + 2] = (0.7 + brightness * 0.3) * glow
    } else {
      colors[i] = 0.12 * glow
      colors[i + 1] = (0.55 + brightness * 0.45) * glow
      colors[i + 2] = 0.2 * glow
    }
    count++
  }

  function jitter(scale) {
    return (Math.random() - 0.5) * scale
  }

  // 球壳与体积雾状粒子（跳过心形区域，避免盖住轮廓）
  const shellCount = Math.floor(maxCount * 0.38)
  for (let n = 0; n < shellCount; n++) {
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const r = radius * (0.52 + Math.random() * 0.46)
    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = r * Math.sin(phi) * Math.sin(theta)
    const z = r * Math.cos(phi)
    if (isInsideHeartAt(x, y, z, heartScale)) continue
    const edge = r / radius
    pushParticle(x, y, z, 0.32 + edge * 0.42)
  }

  // 内部 3D 心形：实体填充 + 表面轮廓层（粒子 size 仍为 2.4）
  const heartJitter = radius * 0.008
  const heartFillTarget = 2600
  const heartSurfaceTarget = 1700
  let heartPlaced = 0
  let heartGuard = 0
  while (heartPlaced < heartFillTarget && heartGuard < heartFillTarget * 14) {
    heartGuard++
    const p = sampleHeartPoint(heartScale, heartJitter, false)
    if (p) {
      pushHeartParticle(p.x, p.y, p.z, 0.82 + Math.random() * 0.18)
      heartPlaced++
    }
  }
  heartPlaced = 0
  heartGuard = 0
  while (heartPlaced < heartSurfaceTarget && heartGuard < heartSurfaceTarget * 14) {
    heartGuard++
    const p = sampleHeartPoint(heartScale, heartJitter * 0.6, true)
    if (p) {
      pushHeartParticle(p.x, p.y, p.z, 0.95 + Math.random() * 0.05)
      heartPlaced++
    }
  }

  // 外层稀疏发光点
  const haloCount = Math.floor(maxCount * 0.08)
  for (let n = 0; n < haloCount; n++) {
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const r = radius * (0.92 + Math.random() * 0.12)
    pushParticle(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi), 0.25 + Math.random() * 0.2)
  }

  const geometry = new t.BufferGeometry()
  geometry.setAttribute('position', new t.BufferAttribute(positions.slice(0, count * 3), 3))
  geometry.setAttribute('color', new t.BufferAttribute(colors.slice(0, count * 3), 3))

  const material = new t.PointsMaterial({
    size: 2.4,
    vertexColors: t.VertexColors,
    transparent: true,
    opacity: 0.88,
    blending: t.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true
  })

  const points = new t.Points(geometry, material)
  points.userData = { radius, windowIndex, spinPhase: windowIndex * 1.7 }
  return points
}

function disposeParticleGroup(group) {
	if (!group) return
	world.remove(group)
	group.geometry.dispose()
	group.material.dispose()
}

function disposeGravityBridge() {
	if (!gravityBridge) return
	world.remove(gravityBridge)
	gravityBridge.geometry.dispose()
	gravityBridge.material.dispose()
	gravityBridge = null
	gravityState = null
}

function ensureGravityBridge() {
	if (gravityBridge) return

	const positions = new Float32Array(GRAVITY_BRIDGE_COUNT * 3)
	const colors = new Float32Array(GRAVITY_BRIDGE_COUNT * 3)
	const geometry = new t.BufferGeometry()
	geometry.setAttribute('position', new t.BufferAttribute(positions, 3))
	geometry.setAttribute('color', new t.BufferAttribute(colors, 3))

	const material = new t.PointsMaterial({
		map: getFogParticleTexture(),
		size: 5.5,
		vertexColors: t.VertexColors,
		transparent: true,
		opacity: 0.48,
		blending: t.AdditiveBlending,
		depthWrite: false,
		sizeAttenuation: true,
	})

	gravityBridge = new t.Points(geometry, material)
	gravityBridge.visible = false
	world.add(gravityBridge)

	gravityState = {
		positions,
		velocities: new Float32Array(GRAVITY_BRIDGE_COUNT * 3),
		phase: new Float32Array(GRAVITY_BRIDGE_COUNT),
		life: new Float32Array(GRAVITY_BRIDGE_COUNT),
		seed: new Float32Array(GRAVITY_BRIDGE_COUNT),
		restDist: null,
	}
}

function projectOnBridge(px, py, x0, y0, x1, y1, dist) {
	const dx = x1 - x0
	const dy = y1 - y0
	const len2 = dx * dx + dy * dy
	if (len2 < 1) return { t: 0, cx: x0, cy: y0, perp: 0 }
	let t = ((px - x0) * dx + (py - y0) * dy) / len2
	t = Math.max(0, Math.min(1, t))
	const cx = x0 + dx * t
	const cy = y0 + dy * t
	return { t, cx, cy, perp: Math.hypot(px - cx, py - cy) }
}

/** 沿两球连线出生：两端粗的雾桥，初速沿轴向微漂 */
function spawnGravityParticle(i, x0, y0, x1, y1, dist) {
	const nx = -(y1 - y0) / dist
	const ny = (x1 - x0) / dist

	const tAlong = Math.random()
	const maxPerp = bridgeThicknessAt(tAlong) * dist
	const perp = (Math.random() - 0.5) * 2 * maxPerp * Math.sqrt(Math.random())

	const px = x0 + (x1 - x0) * tAlong + nx * perp
	const py = y0 + (y1 - y0) * tAlong + ny * perp
	const pz = (Math.random() - 0.5) * maxPerp * 0.35

	const ax = (x1 - x0) / dist
	const ay = (y1 - y0) / dist
	const drift = (Math.random() - 0.5) * 6
	gravityState.velocities[i * 3] = ax * drift
	gravityState.velocities[i * 3 + 1] = ay * drift
	gravityState.velocities[i * 3 + 2] = (Math.random() - 0.5) * 2

	gravityState.positions[i * 3] = px
	gravityState.positions[i * 3 + 1] = py
	gravityState.positions[i * 3 + 2] = pz
	gravityState.phase[i] = tAlong
	gravityState.seed[i] = Math.random() * 200
	gravityState.life[i] = 0.8 + Math.random() * 1.2
}

function setGravityParticleColor(i, tAlong, perpNorm, alpha) {
	const a = Math.min(1, Math.max(0, alpha))
	const g = [0.15, 0.95, 0.32]
	const v = [0.58, 0.28, 0.98]
	const topBias = Math.max(0, perpNorm) * 0.12
	const botBias = Math.max(0, -perpNorm) * 0.12
	const tr = Math.min(1, tAlong + topBias - botBias * 0.35)
	gravityState.colors[i * 3] = (g[0] + (v[0] - g[0]) * tr) * a
	gravityState.colors[i * 3 + 1] = (g[1] + (v[1] - g[1]) * tr) * a
	gravityState.colors[i * 3 + 2] = (g[2] + (v[2] - g[2]) * tr) * a
}

function updateGravityBridge(time, dt) {
	if (!gravityBridge || !gravityState) return

	if (particleGroups.length < 2) {
		gravityBridge.visible = false
		gravityState.restDist = null
		return
	}

	const g0 = particleGroups[0]
	const g1 = particleGroups[1]
	const x0 = g0.position.x
	const y0 = g0.position.y
	const x1 = g1.position.x
	const y1 = g1.position.y
	const dx = x1 - x0
	const dy = y1 - y0
	const dist = Math.sqrt(dx * dx + dy * dy) || 1

	if (gravityState.restDist == null) gravityState.restDist = dist
	if (dist < gravityState.restDist) gravityState.restDist = dist * 0.92 + dist * 0.08

	const separate = dist - gravityState.restDist
	const minSpan = (g0.userData.radius || 80) + (g1.userData.radius || 80)
	const strength = Math.min(1, Math.max(0, (separate - GRAVITY_SEPARATE_START) / (minSpan * 0.55 + 120)))

	if (strength < 0.04) {
		gravityBridge.visible = false
		gravityState.restDist = gravityState.restDist * 0.985 + dist * 0.015
		return
	}

	gravityBridge.visible = true
	const activeCount = Math.max(24, Math.floor(GRAVITY_BRIDGE_COUNT * strength))
	gravityBridge.material.opacity = 0.38 + strength * 0.22

	if (!gravityState.colors) {
		gravityState.colors = new Float32Array(GRAVITY_BRIDGE_COUNT * 3)
		gravityBridge.geometry.setAttribute('color', new t.BufferAttribute(gravityState.colors, 3))
	}

	const ax = dx / dist
	const ay = dy / dist

	for (let i = 0; i < GRAVITY_BRIDGE_COUNT; i++) {
		if (i >= activeCount) {
			gravityState.positions[i * 3 + 2] = -9999
			gravityState.life[i] = 0
			continue
		}

		if (gravityState.life[i] <= 0) {
			spawnGravityParticle(i, x0, y0, x1, y1, dist)
		}

		let px = gravityState.positions[i * 3]
		let py = gravityState.positions[i * 3 + 1]
		let pz = gravityState.positions[i * 3 + 2]

		const d0x = x0 - px
		const d0y = y0 - py
		const d1x = x1 - px
		const d1y = y1 - py
		const d0 = Math.hypot(d0x, d0y) + 55
		const d1 = Math.hypot(d1x, d1y) + 55

		const pull = 72 * strength * dt
		const f0 = pull / (d0 * 0.022 + 1)
		const f1 = pull / (d1 * 0.022 + 1)
		let vx = gravityState.velocities[i * 3] + (d0x / d0) * f0 + (d1x / d1) * f1
		let vy = gravityState.velocities[i * 3 + 1] + (d0y / d0) * f0 + (d1y / d1) * f1
		let vz = gravityState.velocities[i * 3 + 2]

		const proj = projectOnBridge(px, py, x0, y0, x1, y1, dist)
		const maxPerp = bridgeThicknessAt(proj.t) * dist
		if (proj.perp > maxPerp * 1.02) {
			const push = (proj.perp - maxPerp * 0.92) * 28 * dt
			const inv = 1 / (proj.perp || 1)
			vx += (proj.cx - px) * inv * push
			vy += (proj.cy - py) * inv * push
		}

		const seed = gravityState.seed[i]
		const mist = 5 * strength * dt
		vx += ax * Math.sin(time * 0.35 + seed) * mist
		vy += ay * Math.cos(time * 0.32 + seed * 1.1) * mist
		vz += Math.sin(time * 0.25 + seed * 0.7) * mist * 0.4

		const damp = 0.96
		vx *= damp
		vy *= damp
		vz *= damp

		px += vx
		py += vy
		pz += vz

		let proj2 = projectOnBridge(px, py, x0, y0, x1, y1, dist)
		const limit = bridgeThicknessAt(proj2.t) * dist * 1.15 + 18
		if (proj2.perp > limit || proj2.t < -0.06 || proj2.t > 1.06) {
			spawnGravityParticle(i, x0, y0, x1, y1, dist)
			px = gravityState.positions[i * 3]
			py = gravityState.positions[i * 3 + 1]
			pz = gravityState.positions[i * 3 + 2]
			proj2 = projectOnBridge(px, py, x0, y0, x1, y1, dist)
		}
		gravityState.phase[i] = proj2.t

		gravityState.positions[i * 3] = px
		gravityState.positions[i * 3 + 1] = py
		gravityState.positions[i * 3 + 2] = pz
		gravityState.velocities[i * 3] = vx
		gravityState.velocities[i * 3 + 1] = vy
		gravityState.velocities[i * 3 + 2] = vz

		gravityState.life[i] -= dt * (0.14 + strength * 0.08)

		const core = 1 - Math.min(1, proj2.perp / (limit || 1))
		const hubGlow = 0.35 + 0.65 * (Math.abs(proj2.t - 0.5) * 2)
		const twinkle = 0.88 + 0.12 * Math.sin(time * 1.6 + seed * 0.3)
		const pnx = -(y1 - y0) / dist
		const pny = (x1 - x0) / dist
		const perpSign = proj2.perp > 0.5 ? ((px - proj2.cx) * pnx + (py - proj2.cy) * pny) / proj2.perp : 0
		setGravityParticleColor(i, gravityState.phase[i], perpSign, strength * twinkle * (0.5 + core * 0.45 + hubGlow * 0.25))
	}

	gravityBridge.geometry.attributes.position.needsUpdate = true
	gravityBridge.geometry.attributes.color.needsUpdate = true
}

function getPointerNdc(event) {
	const rect = renderer.domElement.getBoundingClientRect()
	pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
	pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
	return pointerNdc
}

function pickParticleGroup(event) {
	if (!raycaster || !camera || particleGroups.length === 0) return null
	raycaster.setFromCamera(getPointerNdc(event), camera)
	raycaster.params.Points.threshold = 28
	const hits = raycaster.intersectObjects(particleGroups, false)
	return hits.length > 0 ? hits[0] : null
}

const CAPTION_FADE_MS = 3000
const CAPTION_HOLD_MS = 450
const MESSAGES_URL = new URL('messages.json', import.meta.url)

let captionMessages = {
	green: [''],
	red: [''],
}

async function loadCaptionMessages() {
	try {
		const res = await fetch(MESSAGES_URL)
		if (!res.ok) throw new Error(String(res.status))
		const data = await res.json()
		if (Array.isArray(data.green) && data.green.length > 0) captionMessages.green = data.green
		if (Array.isArray(data.red) && data.red.length > 0) captionMessages.red = data.red
	} catch (err) {
		console.warn('[mw3d] 无法加载 messages.json，使用默认文案', err)
	}
}

function pickCaptionMessage(windowIndex) {
	const list = windowIndex === 1 ? captionMessages.red : captionMessages.green
	if (!list.length) return 'TDYLWG'
	return list[Math.floor(Math.random() * list.length)]
}

function ensureCaptionStyles() {
	if (document.getElementById('mw3d-caption-styles')) return
	const style = document.createElement('style')
	style.id = 'mw3d-caption-styles'
	style.textContent = `
		#mw3d-caption-layer {
			position: fixed;
			inset: 0;
			z-index: 10000;
			pointer-events: none;
		}
		.mw3d-toast {
			position: fixed;
			left: 0;
			top: 0;
			padding: 14px 22px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 15px;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-indent: 0;
			text-transform: none;
			color: rgba(255, 255, 255, 0.96);
			max-width: min(320px, 86vw);
			line-height: 1.55;
			text-align: center;
			white-space: normal;
			word-break: break-word;
			background: rgba(8, 12, 8, 0.72);
			border: 1px solid rgba(80, 255, 120, 0.45);
			border-radius: 999px;
			box-shadow:
				0 0 24px rgba(60, 255, 100, 0.25),
				0 8px 32px rgba(0, 0, 0, 0.45);
			backdrop-filter: blur(12px);
			-webkit-backdrop-filter: blur(12px);
			transform: translate(-50%, -100%) scale(0.88);
			opacity: 0;
			transition:
				opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1),
				transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
		}
		.mw3d-toast--violet {
			border-color: rgba(160, 110, 255, 0.55);
			box-shadow:
				0 0 24px rgba(120, 80, 255, 0.32),
				0 8px 32px rgba(0, 0, 0, 0.45);
		}
		.mw3d-toast--visible {
			opacity: 1;
			transform: translate(-50%, calc(-100% - 12px)) scale(1);
		}
		.mw3d-toast--out {
			opacity: 0;
			transform: translate(-50%, calc(-100% - 28px)) scale(0.94);
			border-color: rgba(80, 255, 120, 0);
			box-shadow:
				0 0 8px rgba(60, 255, 100, 0.05),
				0 4px 16px rgba(0, 0, 0, 0.15);
			transition:
				opacity 3s ease-out,
				transform 3s ease-out,
				border-color 3s ease-out,
				box-shadow 3s ease-out;
		}
		.mw3d-toast--violet.mw3d-toast--out {
			border-color: rgba(160, 110, 255, 0);
			box-shadow:
				0 0 8px rgba(120, 80, 255, 0.05),
				0 4px 16px rgba(0, 0, 0, 0.15);
		}
		.mw3d-toast__line {
			display: block;
			width: 24px;
			height: 1px;
			margin: 8px auto 0;
			background: linear-gradient(90deg, transparent, rgba(120, 255, 150, 0.8), transparent);
		}
		.mw3d-toast--violet .mw3d-toast__line {
			background: linear-gradient(90deg, transparent, rgba(180, 140, 255, 0.9), transparent);
		}
	`
	document.head.appendChild(style)
}

function ensureCaptionLayer() {
	ensureCaptionStyles()
	if (document.getElementById('mw3d-caption-layer')) return
	const layer = document.createElement('div')
	layer.id = 'mw3d-caption-layer'
	document.body.appendChild(layer)
}

function hideCaptionToast(toast) {
	if (!toast || !toast.isConnected) return
	toast.classList.remove('mw3d-toast--visible')
	toast.classList.add('mw3d-toast--out')
	setTimeout(() => {
		if (toast.isConnected) toast.remove()
	}, CAPTION_FADE_MS + 80)
}

function showClickCaption(event, windowIndex) {
	ensureCaptionLayer()
	const layer = document.getElementById('mw3d-caption-layer')

	const toast = document.createElement('div')
	toast.className = 'mw3d-toast' + (windowIndex === 1 ? ' mw3d-toast--violet' : '')
	toast.innerHTML = `${pickCaptionMessage(windowIndex)}<span class="mw3d-toast__line"></span>`
	toast.style.left = `${event.clientX}px`
	toast.style.top = `${event.clientY}px`

	layer.appendChild(toast)
	requestAnimationFrame(() => {
		requestAnimationFrame(() => toast.classList.add('mw3d-toast--visible'))
	})

	setTimeout(() => hideCaptionToast(toast), CAPTION_HOLD_MS)
}

function onParticleGroupClick(hit, event) {
	const group = hit.object
	group.userData.clickPulseUntil = getTime() + 0.55
	showClickCaption(event, group.userData.windowIndex ?? 0)
}

function setupPointerEvents() {
	raycaster = new t.Raycaster()
	const canvas = renderer.domElement
	canvas.style.touchAction = 'none'

	canvas.addEventListener('click', (event) => {
		const hit = pickParticleGroup(event)
		if (hit) onParticleGroupClick(hit, event)
	})

	canvas.addEventListener('pointermove', (event) => {
		const hit = pickParticleGroup(event)
		canvas.style.cursor = hit ? 'pointer' : 'default'
	})
}

if (new URLSearchParams(window.location.search).get('clear')) {
  localStorage.clear()
} else {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState != 'hidden' && !initialized) {
      init()
    }
  })

  window.onload = () => {
    if (document.visibilityState != 'hidden') {
      init()
    }
  }

  function init() {
    initialized = true

		setTimeout(async () => {
			await loadCaptionMessages()
			setupScene()
			setupWindowManager()
			setupPointerEvents()
			resize()
			updateWindowShape(false)
			render()
			window.addEventListener('resize', resize)
		}, 500)
  }

  function setupScene() {
    camera = new t.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, -10000, 10000)
    camera.position.z = 2.5

    scene = new t.Scene()
    scene.background = new t.Color(0x000000)
    scene.add(camera)

    renderer = new t.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(pixR)

    world = new t.Object3D()
    scene.add(world)
    ensureGravityBridge()

    renderer.domElement.setAttribute('id', 'scene')
    document.body.appendChild(renderer.domElement)
  }

  function setupWindowManager() {
    windowManager = new WindowManager()
    windowManager.setWinShapeChangeCallback(updateWindowShape)
    windowManager.setWinChangeCallback(windowsUpdated)

    windowManager.init({ type: 'green-sphere-particles' })
    windowsUpdated()
  }

  function windowsUpdated() {
    updateParticleGroups()
  }

  const MAX_SCENE_WINDOWS = 2

  function updateParticleGroups() {
    const wins = windowManager.getWindows().slice(0, MAX_SCENE_WINDOWS)

    particleGroups.forEach(disposeParticleGroup)
    particleGroups = []
    if (gravityState) gravityState.restDist = null

    for (let i = 0; i < wins.length && i < MAX_SCENE_WINDOWS; i++) {
      const win = wins[i]
      if (!win || !win.shape) continue
      const radius = Math.min(win.shape.w, win.shape.h) * 0.22 + 40
      const group = createGreenSphereParticles(radius, i)
      group.position.x = win.shape.x + win.shape.w * 0.5
      group.position.y = win.shape.y + win.shape.h * 0.5
      world.add(group)
      particleGroups.push(group)
    }
  }

  function updateWindowShape(easing = true) {
    sceneOffsetTarget = { x: -window.screenX, y: -window.screenY }
    if (!easing) sceneOffset = sceneOffsetTarget
  }

  function render() {
    const time = getTime()
    const dt = Math.min(0.05, Math.max(0.001, time - lastRenderTime || 0.016))
    lastRenderTime = time

    windowManager.update()

    const falloff = 0.05
    sceneOffset.x = sceneOffset.x + (sceneOffsetTarget.x - sceneOffset.x) * falloff
    sceneOffset.y = sceneOffset.y + (sceneOffsetTarget.y - sceneOffset.y) * falloff

    world.position.x = sceneOffset.x
    world.position.y = sceneOffset.y

    const wins = windowManager.getWindows()

    for (let i = 0; i < particleGroups.length; i++) {
      const group = particleGroups[i]
      const win = wins[i]
      if (!win) continue

      const posTarget = {
        x: win.shape.x + win.shape.w * 0.5,
        y: win.shape.y + win.shape.h * 0.5
      }

      group.position.x = group.position.x + (posTarget.x - group.position.x) * falloff
      group.position.y = group.position.y + (posTarget.y - group.position.y) * falloff

			const phase = group.userData.spinPhase || 0
			group.rotation.y = time * 0.35 + phase
			group.rotation.x = Math.sin(time * 0.2 + phase) * 0.15
			group.rotation.z = time * 0.12 + phase * 0.5

			const pulseUntil = group.userData.clickPulseUntil || 0
			if (time < pulseUntil) {
				const k = (pulseUntil - time) / 0.55
				const s = 1 + 0.1 * k * k
				group.scale.set(s, s, s)
			} else {
				group.scale.set(1, 1, 1)
			}
		}

    updateGravityBridge(time, dt)

    renderer.render(scene, camera)
    requestAnimationFrame(render)
  }

  function resize() {
    const width = window.innerWidth
    const height = window.innerHeight

    camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000)
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }
}
