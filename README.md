# Hisxee

Vue 3 + TypeScript + Vite 静态 H5 站点。

## 环境

- Node.js **23.10.0**（见 `.nvmrc`）

```bash
nvm use
npm install
npm run dev
npm run build
```

## multipleWindow3dScene（完整搬运）

来自 [bgstaal/multipleWindow3dScene](https://github.com/bgstaal/multipleWindow3dScene)，文件位于 `public/multipleWindow3dScene/`：

| 文件 | 说明 |
|------|------|
| `index.html` | 独立入口（与上游一致） |
| `main.js` | Three.js 场景与渲染 |
| `WindowManager.js` | 多窗口 localStorage 同步 |
| `three.r124.min.js` | Three.js r124 |
| `three-LICENSE` | 许可证 |

**两种访问方式**

1. **Vue 首页** `http://localhost:5173/#/` — 自动加载原版脚本（`src/multipleWindow3dScene/loadDemo.ts`）
2. **独立页** `http://localhost:5173/multipleWindow3dScene/index.html` — 与克隆仓库打开 `index.html` 相同

**多窗口**：新开多个相同 URL 的标签/窗口，拖动即可看到线框立方体对齐。

清空：`?clear=1`（如 `http://localhost:5173/?clear=1` 或独立页加参数）

## H5 适配

- 375 设计稿 px → vw（浮层 UI 使用 `.ignore-vw`）
- Hash 路由，适合静态托管
