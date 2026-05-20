/**
 * 加载 Entangled 渲染（bundle）+ hisxee 多窗口与文案
 */

const BASE = import.meta.env.BASE_URL

function scriptUrl(path: string): string {
  return `${BASE}multipleWindow3dScene/${path}`
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
  window.__hisxeeBase = BASE
  window.__hisxeeMessagesUrl = scriptUrl('messages.json')

  await loadModule(scriptUrl('main-entangled.js'))
}

declare global {
  interface Window {
    __hisxeeBase?: string
    __hisxeeMessagesUrl?: string
    __hisxeeOn?: { getThisWindowData?: () => { metaData?: { instanceIndex?: number } } }
    HisxeeWindowManager?: unknown
    __hisxeeOnEntangledReady?: (payload: { on?: unknown }) => void
  }
}
