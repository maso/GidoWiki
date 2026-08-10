# AGENTS.md — GidoHome

給 AI coding agent 的專案說明。開始工作前請先讀完本檔。

## 這是什麼

Gido Gido 派對遊戲的**主畫面 prototype**：Three.js 打造的 3D 角色待機畫面，
角色可點擊互動、會自己走動與表演動作，並有換背景、換角色造型／配件、人類圖鑑與 3D 路人遊走系統。

**工作目錄：`GidoWiki/_prototypes/GidoHome/`**
（舊的 `~/Documents/GidoHomePrototype` 已停用，請勿在該處修改。）

這個資料夾位於 GidoWiki repo 內，會透過 GitHub Pages 公開分享：
`https://maso.github.io/GidoWiki/_prototypes/GidoHome/`

## 每次修改後必做（重要）

改完程式碼與測試後，**一律執行 build 與 commit**，不需另外詢問：

```bash
npm test && npm run build:static   # 執行測試並重建 dist/
git add -A && git commit -m "<描述這次改動>"
```

- **`dist/` 必須 commit 進 repo**，公開頁面直接讀取它。只改 `src/` 而沒重新 build，線上看到的仍是舊版。
- **`git push` 不要自動執行**，由使用者自行決定何時上線。

## 建置與測試方式

| 指令 | 用途 |
|---|---|
| `npm run dev` | 本機開發（Vite dev server） |
| `npm run build:static` | **預設建置方式**，零依賴，只用 Node 標準庫 (`scripts/build.mjs`) |
| `npm run build` | Vite 打包版本 |
| `npm test` | 執行 `src/**/*.test.js` 單元測試 |

`build:static`（`scripts/build.mjs`）會自動計算 Git Commit 次數與 Short Hash 並寫入 `src/version.js` 與右上角常駐版號 (`#version-badge`)。

## 專案結構

```
src/
  main.js                  進入點：串接 scene / characters / pedestrians / controls / bgPicker / skinPicker / peoplePicker
  config.js                角色定義（顏色、位置、呼吸速度與振幅、移動速度、眼睛風格）與動畫參數
  scene.js                 場景、相機 (0.5, 5.5, 11.5)、燈光、陰影
  materials.js             Toon 與純色材質封裝
  raycaster.js             滑鼠 hover／click 命中角色
  controls.js              主選單鍵盤與手把導覽
  bgPicker.js              背景主題選擇器
  version.js               自動生成的版本號字串 (v1.0.X)
  character/               3D 怪獸角色系統
    factories.js           3D 角色體型與恐龍蛋 Lathe 模型建構器
    accessories.js         8 種 3D 飾品網格產生器
    stunts.js              20 種純函式待機特技動作庫
  pedestrian/              3D 都市路人系統
    pedestrianFactory.js   樂高風格 3D 路人模型工廠（具備 SHARED_GEOMETRIES 共享幾何體與 2 Pass 陰影優化）
    pedestrianManager.js   路人群聚管理：10 隻多彩路人，1.5 倍廣闊巡邏範圍，接近怪獸時觸發雙手高舉慌張逃跑 AI
  customization/           角色造型／Accessory 選擇器（狀態機、資料、UI、手把導覽，含單元測試）
  people/                  人類圖鑑視窗（4 大類別 Tab、4 欄卡片 Grid、收集進度頁尾、手把 L/R 切換）
vendor/                    vendored Three.js（build:static 用）
scripts/build.mjs          零依賴自動建置腳本
dist/                      部署產物（有 commit）
```

## 修改時的注意事項

- **角色與路人邊界**：
  - 怪獸 roaming 範圍：`x: [-3.2, 4.0], z: [-2.5, 2.8]`
  - 路人 roaming 範圍：`x: [-9.8, 9.8], z: [-6.3, 6.8]`（1.5 倍畫面空間）
- **路人逃跑 AI**：當路人與非恐龍蛋怪獸距離 `< 2.2` 時，會觸發 Panic 逃跑模式，以 `2.5` 單位/秒的速度背對怪獸逃跑，雙手高高舉起晃動；距離 `> 3.4` 後恢復平靜散步。
- **UI 焦點框規約**：選取框統一使用 `#f5288a` 熱粉紅（未解鎖為 `3.5px dashed`，已選取為 `3.5px solid`），不疊加多重 box-shadow 框線。
- **輸入裝置提示**：`src/input/inputMode.js` 追蹤玩家最後使用的裝置，
  換 Skin 面板與人類圖鑑的肩鍵提示會跟著切換（鍵鼠 `Q`/`E`、手把 `LB`/`RB`）。
  新增肩鍵提示 UI 時請訂閱 `inputMode.subscribe()` 並使用 `getShoulderLabels()`，
  兩字提示需加上 `.wide-label` class 以縮小字級避免撐破圓形徽章。
- **測試規範**：任何修改都需確認 `npm test` 通過 25 項單元測試。

