/**
 * 加载 public/multipleWindow3dScene 下的原版脚本（与上游仓库一致）
 * @see https://github.com/bgstaal/multipleWindow3dScene
 */

const BASE = import.meta.env.BASE_URL
const THREE_SCRIPT = `${BASE}multipleWindow3dScene/three.r124.min.js`
const MAIN_MODULE = `${BASE}multipleWindow3dScene/main.js`

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const el = document.createElement('script')
    el.src = src
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(el)
  })
}

function loadModule(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[type="module"][src="${src}"]`)) {
      resolve()
      return
    }
    const el = document.createElement('script')
    el.type = 'module'
    el.src = src
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.body.appendChild(el)
  })
}

let started = false

export async function startMultipleWindow3dScene(): Promise<void> {
  if (started) return
  started = true

  document.body.classList.add('mw3d-active')

  const win = window as Window & { THREE?: unknown }
  if (!win.THREE) {
    await loadScript(THREE_SCRIPT)
  }
  await loadModule(MAIN_MODULE)
}
