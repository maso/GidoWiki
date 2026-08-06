# AGENTS.md — GidoHome

給 AI coding agent 的專案說明。開始工作前請先讀完本檔。

## 這是什麼

Gido Gido 派對遊戲的**主畫面 prototype**：Three.js 打造的 3D 角色待機畫面，
角色可點擊互動、會自己走動與表演動作，並有換背景、換角色造型／配件的功能。

**工作目錄：`GidoWiki/_prototypes/GidoHome/`**
（舊的 `~/Documents/GidoHomePrototype` 已停用，請勿在該處修改。）

這個資料夾位於 GidoWiki repo 內，會透過 GitHub Pages 公開分享：
`https://maso.github.io/GidoWiki/_prototypes/GidoHome/dist/`

## 每次修改後必做（重要）

改完程式碼後，**一律執行 build 與 commit**，不需另外詢問：

```bash
npm run build:static   # 重建 dist/
git add -A && git commit -m "<描述這次改動>"
```

- **`dist/` 必須 commit 進 repo**，公開頁面直接讀取它。只改 `src/` 而沒重新 build，
  線上看到的仍是舊版。
- **`git push` 不要自動執行**，由使用者自行決定何時上線。

## 建置方式

| 指令 | 用途 |
|---|---|
| `npm run dev` | 本機開發（Vite dev server） |
| `npm run build:static` | **預設建置方式**，零依賴，只用 Node 標準庫 |
| `npm run build` | Vite 打包版本（需完整 npm 環境） |
| `npm test` | 執行 `src/**/*.test.js` 單元測試 |

`build:static`（`scripts/build.mjs`）存在的原因：某些環境無法安裝 npm 套件。
它不打包，直接以原生 ES modules 部署 `src/`，並用 import map 把 `three`
對應到 `vendor/three.module.min.js`（v0.160.1），同時處理兩個 Vite 專屬語法
（`import './style.css'`、裸模組名）。兩種 build 產出的 `dist/` 都可正常運作。

## 專案結構

```
src/
  main.js          進入點：串接 scene / characters / controls / bgPicker / skinPicker，跑 render loop
  config.js        角色定義（顏色、位置、呼吸速度與振幅、移動速度、眼睛風格）與動畫參數
  character.js     ★最大檔案：3D 角色工廠、配件模型、待機／走路／表演動作、造型模式
  scene.js         場景、相機、燈光、陰影
  materials.js     Toon 與純色材質封裝
  raycaster.js     滑鼠 hover／click 命中角色
  controls.js      鍵盤與手把選單導覽
  bgPicker.js      背景主題選擇器
  customization/   角色造型系統（狀態邏輯、資料、UI、手把導覽，含單元測試）
vendor/            vendored Three.js（build:static 用，勿手動改動）
scripts/build.mjs  零依賴建置腳本
dist/              建置產物（有 commit）
```

## 修改時的注意事項

- **角色參數優先改 `config.js`**：呼吸速度 `speed`、呼吸振幅 `breathAmp`、
  移動速度 `moveSpeedMin/Max`（min≠max 表示忽快忽慢）都在那裡，不用動 character.js。
- **角色階層**：`grp`（整體，走路轉向與腳板掛這裡）→ `upperGrp`（上半身樞紐，
  待機轉頭／鞠躬用，腳不會跟著動）→ `bodyMesh`（身體，配件掛在它下面，
  所以會自動跟隨呼吸與擠壓）。
- **表演動作（STUNTS）**：在 `character.js` 的 STUNTS 陣列，每個動作是進度 p(0→1)
  的純函數，**起點與終點都必須是中立姿勢**（旋轉需為 2π 的整數倍），
  這樣結束時的還原才會精確。新增動作請遵守此約定。
- **Slobu 的眼睛是半圓**（`thetaStart/thetaLength` 裁切），瞳孔共用同一裁切範圍，
  因此瞳孔**不可做垂直位移**，否則會突出眼皮線外。
- **`vite.config.js` 的 `base: './'` 不要改**，改成絕對路徑會導致子路徑部署失效。
- 走路動畫的手臂是**對側擺動**（左手配右腳），且是前後（z 軸）擺動；
  若新增會改動 `hand*.position.z` 的動畫，記得在動作結束時歸位。
