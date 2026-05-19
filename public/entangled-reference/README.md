# Entangled 链上参考源码（个人学习用）

从 fxhash ONCHFS 拉取并 **格式化（反压缩）** 的 Bjørn Staal *Entangled* 生成器，便于对照与二次修改。

**来源 CID：** `b12f18fcd51a21cc3ace5090fa808c8d4e4552d9e2239a3886b89f8ea12ff685`  
**在线运行示例：** [onchfs 代理页](https://onchfs.fxhash2.xyz/b12f18fcd51a21cc3ace5090fa808c8d4e4552d9e2239a3886b89f8ea12ff685/?fxhash=0xb312ac79170e4b3f80f4b7daa96c09b53076dfbdc543255ad3fa1616c52c6f21&fxiteration=1&fxcontext=standalone&fxchain=ETHEREUM&legacy=false)

> 版权归原作者所有。仅限个人非商用学习；请勿原样对外发布或商用。

## 文件说明

| 文件 | 说明 |
|------|------|
| `bundle.min.js` | 链上原始压缩包 |
| `bundle.js` | **js-beautify 格式化后**（约 2585 行），可编辑 |
| `fxhash.min.js` / `fxhash.js` | fxhash 运行时（已格式化 `fxhash.js`） |
| `three.r157.min.js` | Three.js r157 |
| `index.html` | 链上原始入口（引用 `.min.js`） |
| `index.dev.html` | 本地开发入口（引用 `bundle.js` / `fxhash.js`） |

**说明：** 没有 `.map` source map，因此变量名仍是 `e/n/t` 等缩写，属于「可读排版」而非「还原变量名」。改逻辑时建议配合浏览器断点与 `console.log(ge)` 等。

## 本地运行

1. 启动项目：`npm run dev`
2. 打开（需带 fxhash 参数，否则特征种子不完整）：

```
http://localhost:5173/entangled-reference/index.dev.html?fxhash=0xb312ac79170e4b3f80f4b7daa96c09b53076dfbdc543255ad3fa1616c52c6f21&fxiteration=1&fxcontext=standalone&fxchain=ETHEREUM&legacy=false
```

3. **多窗口：** 再开一个**完全相同**的 URL（同域名 `localhost` 才能 `localStorage` 同步）。拖动两窗靠近即可看到纠缠效果。

4. 调试：URL 可加 `&debug=2` 查看配对等信息（见 `bundle.js` 内 `je.debug`）。

## `bundle.js` 结构速查

| 符号 / 类 | 大致作用 |
|-----------|----------|
| `class l`（约 L34） | GPU 计算 / shader 变量管线（类似 GPUComputationRenderer） |
| `class Re`（约 L750） | 多窗口 `localStorage` 同步（等同 demo 的 WindowManager） |
| `ge` | 由 `$fx.rand()` 生成的作品特征（配色、运动类型等） |
| `On` / `Re` 实例 | 窗口管理器 |
| `Ye` / `ze` | `THREE` 别名 |
| `ta` / `$fx.features` | 输出 metadata 特征表 |

重新格式化：

```bash
npx js-beautify public/entangled-reference/bundle.min.js -o public/entangled-reference/bundle.js
```
