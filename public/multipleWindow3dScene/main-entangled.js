/**
 * hisxee × Entangled：注入 WindowManager，加载链上 bundle（无 fxhash 平台）
 */
import WindowManager from './WindowManager.js'

const BASE = typeof window.__hisxeeBase === 'string' ? window.__hisxeeBase : '/'

function scriptUrl(path) {
  return BASE + 'multipleWindow3dScene/' + path
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const el = document.createElement('script')
    el.src = src
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('Failed to load ' + src))
    document.head.appendChild(el)
  })
}

function loadModuleScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[type="module"][src="${src}"]`)) {
      resolve()
      return
    }
    const el = document.createElement('script')
    el.type = 'module'
    el.src = src
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('Failed to load ' + src))
    document.head.appendChild(el)
  })
}

window.HisxeeWindowManager = WindowManager

/** 本标签注册前 localStorage 里已有窗口 → 第二个球（蓝色 bundle） */
function predictInstanceIndex() {
  try {
    const wins = JSON.parse(localStorage.getItem('windows') || '[]')
    return wins.length >= 1 ? 1 : 0
  } catch {
    return 0
  }
}

function entangledBundleName() {
  return predictInstanceIndex() === 1 ? 'entangled-bundle-blue.js' : 'entangled-bundle-green.js'
}

async function boot() {
  const instanceIndex = predictInstanceIndex()
  window.__hisxeeInstanceIndex = instanceIndex
  await loadScript(scriptUrl('three.r157.min.js'))
  await loadScript(scriptUrl('fxhash-shim.js'))
  await loadScript(scriptUrl('hisxee-ui.js'))
  await loadScript(scriptUrl(entangledBundleName()))
}

boot().catch((err) => console.error('[hisxee] Entangled 启动失败', err))
