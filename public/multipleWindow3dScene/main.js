import WindowManager from './WindowManager.js'

const t = THREE
let camera, scene, renderer, world
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1
let particleGroups = []
let sceneOffsetTarget = { x: 0, y: 0 }
let sceneOffset = { x: 0, y: 0 }

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

/** 球形 + 心形粒子（第 2 个窗口为红色，其余为绿色） */
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
      const r = 0.4 + brightness * 0.6
      colors[i] = r * glow
      colors[i + 1] = 0.06 * glow
      colors[i + 2] = 0.08 * glow
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
      const r = 0.6 + brightness * 0.4
      colors[i] = r * glow
      colors[i + 1] = 0.1 * glow
      colors[i + 2] = 0.12 * glow
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
		.mw3d-toast--red {
			border-color: rgba(255, 90, 90, 0.5);
			box-shadow:
				0 0 24px rgba(255, 60, 60, 0.28),
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
		.mw3d-toast--red.mw3d-toast--out {
			border-color: rgba(255, 90, 90, 0);
			box-shadow:
				0 0 8px rgba(255, 60, 60, 0.05),
				0 4px 16px rgba(0, 0, 0, 0.15);
		}
		.mw3d-toast__line {
			display: block;
			width: 24px;
			height: 1px;
			margin: 8px auto 0;
			background: linear-gradient(90deg, transparent, rgba(120, 255, 150, 0.8), transparent);
		}
		.mw3d-toast--red .mw3d-toast__line {
			background: linear-gradient(90deg, transparent, rgba(255, 120, 120, 0.85), transparent);
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
	toast.className = 'mw3d-toast' + (windowIndex === 1 ? ' mw3d-toast--red' : '')
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

  function updateParticleGroups() {
    const wins = windowManager.getWindows()

    particleGroups.forEach(disposeParticleGroup)
    particleGroups = []

    for (let i = 0; i < wins.length; i++) {
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
