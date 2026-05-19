# Hisxee

Vue 3 + TypeScript + Vite 静态 H5 站点。

## 环境

- Node.js **23.10.0**（见 `.nvmrc`）

```bash
nvm use
npm install
npm run dev      # http://localhost:5173
npm run build    # 输出 dist/
npm run preview
```

## H5 适配

- `index.html` 已配置移动端 viewport 与安全区域
- 样式按 **375px** 写 `px`，构建时自动转 `vw`
- 不转换的元素加 `.ignore-vw`
- 路由为 Hash 模式，适合任意静态托管
