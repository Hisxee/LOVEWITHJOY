/**
 * hisxee 交互：点击粒子显示文案（Entangled 画布 #scene）
 */
;(function () {
  const CAPTION_FADE_MS = 3000
  const CAPTION_HOLD_MS = 450
  const MESSAGES_URL =
    (typeof window.__hisxeeMessagesUrl === 'string' && window.__hisxeeMessagesUrl) ||
    'messages.json'

  let captionMessages = { green: [''], red: [''] }

  async function loadCaptionMessages() {
    try {
      const res = await fetch(MESSAGES_URL)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      if (Array.isArray(data.green) && data.green.length > 0) captionMessages.green = data.green
      if (Array.isArray(data.red) && data.red.length > 0) captionMessages.red = data.red
    } catch (err) {
      console.warn('[hisxee] messages.json', err)
    }
  }

  function pickCaptionMessage(windowIndex) {
    const list = windowIndex === 1 ? captionMessages.red : captionMessages.green
    if (!list.length) return '…'
    return list[Math.floor(Math.random() * list.length)]
  }

  function ensureCaptionStyles() {
    if (document.getElementById('mw3d-caption-styles')) return
    const style = document.createElement('style')
    style.id = 'mw3d-caption-styles'
    style.textContent = `
		#mw3d-caption-layer { position: fixed; inset: 0; z-index: 10000; pointer-events: none; }
		.mw3d-toast {
			position: fixed; left: 0; top: 0; padding: 14px 22px;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 15px; font-weight: 600; letter-spacing: 0.06em;
			color: rgba(255,255,255,0.96); max-width: min(320px, 86vw);
			line-height: 1.55; text-align: center; white-space: normal; word-break: break-word;
			background: rgba(8,12,8,0.72); border: 1px solid rgba(80,255,120,0.45);
			border-radius: 999px;
			box-shadow: 0 0 24px rgba(60,255,100,0.25), 0 8px 32px rgba(0,0,0,0.45);
			backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
			transform: translate(-50%, -100%) scale(0.88); opacity: 0;
			transition: opacity 0.35s cubic-bezier(0.22,1,0.36,1), transform 0.35s cubic-bezier(0.22,1,0.36,1);
		}
		.mw3d-toast--violet,
		.mw3d-toast--blue {
			border-color: rgba(100,160,255,0.55);
			box-shadow: 0 0 24px rgba(60,140,255,0.32), 0 8px 32px rgba(0,0,0,0.45);
		}
		.mw3d-toast--visible { opacity: 1; transform: translate(-50%, calc(-100% - 12px)) scale(1); }
		.mw3d-toast--out {
			opacity: 0; transform: translate(-50%, calc(-100% - 28px)) scale(0.94);
			border-color: rgba(80,255,120,0);
			transition: opacity 3s ease-out, transform 3s ease-out, border-color 3s ease-out;
		}
		.mw3d-toast--violet.mw3d-toast--out,
		.mw3d-toast--blue.mw3d-toast--out { border-color: rgba(100,160,255,0); }
		.mw3d-toast__line {
			display: block; width: 24px; height: 1px; margin: 8px auto 0;
			background: linear-gradient(90deg, transparent, rgba(120,255,150,0.8), transparent);
		}
		.mw3d-toast--violet .mw3d-toast__line,
		.mw3d-toast--blue .mw3d-toast__line {
			background: linear-gradient(90deg, transparent, rgba(140,190,255,0.9), transparent);
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
    if (!toast?.isConnected) return
    toast.classList.remove('mw3d-toast--visible')
    toast.classList.add('mw3d-toast--out')
    setTimeout(() => toast.isConnected && toast.remove(), CAPTION_FADE_MS + 80)
  }

  function showClickCaption(clientX, clientY, windowIndex) {
    ensureCaptionLayer()
    const layer = document.getElementById('mw3d-caption-layer')
    const toast = document.createElement('motionless' === 'never' ? 'span' : 'div')
    toast.className = 'mw3d-toast' + (windowIndex === 1 ? ' mw3d-toast--blue' : '')
    toast.innerHTML = `${pickCaptionMessage(windowIndex)}<span class="mw3d-toast__line"></span>`
    toast.style.left = `${clientX}px`
    toast.style.top = `${clientY}px`
    layer.appendChild(toast)
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('mw3d-toast--visible')))
    setTimeout(() => hideCaptionToast(toast), CAPTION_HOLD_MS)
  }

  function pickParticleAt(clientX, clientY) {
    const pick = window.__hisxeePick
    if (pick && typeof pick.pickAt === 'function') return pick.pickAt(clientX, clientY)
    return null
  }

  function hoverParticleAt(clientX, clientY) {
    const pick = window.__hisxeePick
    if (pick && typeof pick.hoverAt === 'function') return pick.hoverAt(clientX, clientY)
    return pickParticleAt(clientX, clientY)
  }

  function bindCanvasPointer() {
    const canvas = document.getElementById('scene')
    if (!canvas) {
      requestAnimationFrame(bindCanvasPointer)
      return
    }
    if (canvas.dataset.hisxeePointer) return
    canvas.dataset.hisxeePointer = '1'
    canvas.style.touchAction = 'none'

    canvas.addEventListener('click', (event) => {
      const hit = pickParticleAt(event.clientX, event.clientY)
      if (!hit) return
      showClickCaption(hit.clientX, hit.clientY, hit.windowIndex)
    })

    canvas.addEventListener('pointermove', (event) => {
      const hit = hoverParticleAt(event.clientX, event.clientY)
      canvas.style.cursor = hit ? 'pointer' : 'default'
    })
  }

  window.__hisxeeOnEntangledReady = function (payload) {
    window.__hisxeeOn = payload?.on || window.__hisxeeOn
    bindCanvasPointer()
  }

  if (new URLSearchParams(window.location.search).get('clear')) {
    localStorage.clear()
  }

  loadCaptionMessages().then(bindCanvasPointer)
})()
