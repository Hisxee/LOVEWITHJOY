/**
 * 最小 fxhash 垫片：满足 entangled-bundle 对 $fx 的依赖，不连接 fxhash 平台。
 */
;(function () {
  const params = new URLSearchParams(window.location.search)
  const hash =
    params.get('fxhash') ||
    '0xb312ac79170e4b3f80f4b7daa96c09b53076dfbdc543255ad3fa1616c52c6f21'

  window.$fx = {
    _version: '4.0.1-shim',
    hash,
    iteration: Number(params.get('fxiteration')) || 1,
    minter: params.get('fxminter') || '0x0000000000000000000000000000000000000000',
    context: params.get('fxcontext') || 'standalone',
    isPreview: params.get('preview') === '1',
    preview() {},
    features() {},
    rand: () => Math.random,
    params() {},
    getFeature() {},
    getFeatures() {
      return {}
    },
    on() {
      return () => {}
    },
    emit() {},
  }
})()
