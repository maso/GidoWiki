# Gido Gido — 主畫面 Prototype (GidoHome)

PC party game 主畫面 prototype，HTML + CSS + Three.js (v0.160)。

> 用 AI coding agent 開發本專案時，請先讀 [AGENTS.md](./AGENTS.md)
> （含工作流程約定：每次修改後都要 build + commit）。

公開頁面（GitHub Pages）：`https://<username>.github.io/GidoWiki/_prototypes/GidoHome/dist/`

## 本機開發

```bash
npm install
npm run dev        # Vite dev server
```

## 建置部署用的 dist/

兩種方式擇一，產出都可直接部署在子路徑下（相對路徑資源）：

```bash
npm run build          # Vite 打包（需要 npm 環境，會 minify）
npm run build:static   # 零依賴 Node script（scripts/build.mjs），不需安裝任何套件
```

`build:static` 是為了在無法安裝 npm 套件的環境（如 Cowork sandbox）也能建置：
直接以原生 ES modules 部署 src/，用 import map 把 `three` 對應到
`vendor/three.module.min.js`。**dist/ 需要 commit 進 repo** 才會出現在公開頁面。

## 結構

- `src/` — 原始碼（scene / character / controls / bgPicker / customization）
- `vendor/three.module.min.js` — vendored Three.js（v0.160.1，供 build:static 用）
- `scripts/build.mjs` — 零依賴建置腳本
- `dist/` — 建置產物（有 commit，公開頁面直接指到這裡）
