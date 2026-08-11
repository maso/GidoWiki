# Gido Gido — 主畫面 Prototype (GidoHome)

PC party game 主畫面 prototype，HTML + CSS + Three.js (v0.160)。

> 用 AI coding agent 開發本專案時，請先讀 [AGENTS.md](./AGENTS.md)
> （含工作流程約定）。

公開頁面（GitHub Pages）：`https://maso.github.io/GidoWiki/_prototypes/GidoHome/`

## 沒有建置步驟

網站直接以原始碼提供服務：`index.html` 內含 import map 與相對路徑，
`src/`（原生 ES modules）與 `vendor/three.module.min.js` 就放在它旁邊，
GitHub Pages 原樣托管即可。**改完程式碼 commit 就會上線，不需要 build。**

唯一需要生成的是版號字串：

```bash
npm run version:stamp   # 由 Git commit 數與 short hash 寫入 src/version.js 與右上角版號
```

## 指令

| 指令 | 用途 |
|---|---|
| `npm run dev` | 本機開發（Vite dev server，有 HMR） |
| `npm test` | 執行 `src/**/*.test.js` 單元測試 |
| `npm run version:stamp` | 更新版號字串（commit 前執行） |
| `npm run build` | 選用：Vite 打包版本，產出 `dist/`（已 gitignore，不用於部署） |

## 結構

- `index.html` — 唯一的頁面進入點，含 import map
- `src/` — 原始碼（scene / character / pedestrian / emote / input / customization / people）
- `vendor/three.module.min.js` — vendored Three.js v0.160.1
- `scripts/stamp-version.mjs` — 零依賴版號生成腳本
