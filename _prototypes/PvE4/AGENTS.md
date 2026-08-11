# AGENTS.md — PvE4

給 AI coding agent 的專案說明。開始工作前請先讀完本檔。

## 這是什麼

**最多 4 人合作的 PvE 闖關 prototype**：巨獸們在一條**持續向前捲動**的地圖上前進，
沿路破壞建築物、吃路人、閃避畫面下緣不斷逼近的火線。分數隨前進距離累積，
連續破壞會觸發 COMBO 倍率，時間耗盡即結束。

同一個 `_prototypes/` 底下的 **BattleLand** 是它的姊妹版本（2v2 隊伍佔領對戰）。
兩者共用大量檔名與模組結構，但**內容已大幅分歧，不是複製品**——修改時
不要假設可以把一邊的檔案直接搬到另一邊。

## 怎麼跑

**沒有任何建置步驟、沒有 npm、沒有相依套件。** 純靜態檔案，Three.js 以
`three.min.js` 直接 vendored 在資料夾裡，用傳統 `<script>` 標籤載入全域變數。

```bash
# 用任意靜態伺服器打開即可（直接開 file:// 也能跑）
python3 -m http.server 8080
```

改完檔案存檔、重新整理瀏覽器就看得到結果。

**這個資料夾在 GidoWiki repo 內，commit 後即會公開上線**，不需要 build。

## 架構重點

`index.html` 用 `<script>` 依序載入所有檔案，**載入順序就是相依順序**：

```
three.min.js → constants.js → scene.js → character.js → input.js
→ level.js → buildings.js → mountains.js → patches.js → pedestrians.js
→ items.js → flames.js → game.js → effects.js → hpbar.js → bubble.js
→ collision.js
```

**所有東西都是全域變數，沒有模組系統。** `constants.js` 的常數、`scene.js` 的
`scene`/`camera`/`renderer`、`game.js` 的 `players`/`gameStarted`、`level.js` 的
`scrollOffset`/`gameScore` 等都是全域可見。新增檔案時記得加進 `index.html` 的
載入清單，並放在它依賴的檔案之後。

### 各檔案職責

| 檔案 | 內容 |
|---|---|
| `constants.js` | 所有可調參數（移動、衝刺、攻擊、傷害、火線、Fusion）與共用 easing 函式 |
| `scene.js` | Three.js 場景、相機、光源、地面與格線 |
| `character.js` | 巨獸模型工廠 `createCharacter()`、名牌 sprite |
| `input.js` | 鍵盤／滑鼠／手把輸入與**玩家插槽綁定**（`playerBindings`） |
| `level.js` | ★捲動核心：`scrollOffset`、`totalScrolled`、`gameScore`、`updateScroll()` |
| `game.js` | ★核心：玩家狀態、動畫、攻擊、衝刺、主迴圈 `loop()`、COMBO、Duo/Fusion、開始／暫停／結束流程 |
| `buildings.js` | 建築物：隨捲動生成／回收、擊毀、砲台 |
| `mountains.js` / `patches.js` | 背景山脈與地面色塊，同樣隨捲動生成與回收 |
| `pedestrians.js` | 路人：遊走、逃跑、被吃掉（累積 Duo 值） |
| `items.js` | 三種道具：❤️ 回 25 HP、⏰ +10 秒、🍔 +25 Duo |
| `flames.js` | 畫面下緣的火線特效（2D canvas 疊層，非 Three.js） |
| `effects.js` | 火焰／煙霧等粒子特效（採物件池 pooling） |
| `hpbar.js` | HP 條 DOM、傷害判定、死亡與重生流程 |
| `bubble.js` | 死亡後的泡泡重生：從天而降、可被打破、玩家可在泡泡內掙扎 |
| `collision.js` | 角色與建築物的推擠解算、重生落點搜尋 |

## 遊戲規則

**捲動與分數**：地圖以 `SCROLL_SPEED` 持續向下捲動，前進距離即分數
（`gameScore`）。COMBO 數 ≥ 2 時分數會乘上 COMBO 倍率
（見 `level.js` 的 `updateScroll()`）。畫面上方顯示 Score、COMBO 條與 ULTRA 條。

**火線**：畫面下緣 `DAMAGE_Z = 9` 是危險線，被追上會持續扣血（`FIRE_DAMAGE`）。
玩家的移動下界 `MOVE_Z_MAX = 8.5` 就卡在火線正上方。
開場有 `GRACE_PERIOD = 3` 秒無敵。

**COMBO（計分用）**：破壞建築物時累積 `_comboCount`，`_COMBO_DUR = 3` 秒內沒有
新的破壞就重置，達 2 以上才顯示 COMBO 框並套用倍率。

> ⚠️ 名稱陷阱：`constants.js` 的 `COMBO_MAX` 與玩家身上的 `p.comboCount` 是
> **另一套系統**——那是「連續出拳到第幾拳」（第 3 拳變重拳），跟上面的計分
> COMBO 完全無關。改動時別把兩者搞混。

**Duo / Fusion**：吃路人累積 Duo 值，滿了之後按住 Shift／LB 會出現閃爍光環，
兩名玩家靠近可融合成一顆威力強大的球體，持續 8 秒。

**結束**：計時歸零即 Game Over，顯示最終分數。

## 操作

| | 鍵盤（1P） | 手把 |
|---|---|---|
| 移動 | W/A/S/D | 左類比 + 十字鍵 |
| 攻擊 | 滑鼠左鍵 | A（button 0） |
| 衝刺 | 空白鍵 | A（button 0） |
| Duo | Shift | LB（button 4） |
| 選色 | ←／→ | 十字鍵左右 |

開始畫面按任意鍵／任意手把鍵即可佔用一個玩家插槽（`tryBindKeyboard` /
`tryBindGamepad`），鍵盤只能綁定一個插槽。畫面上的核取方塊可切換建築物 HP 顯示
與下方火線。

## 修改時的注意事項

- **`game.js` 有 1700 行**，是最大的檔案。修改前先用 `grep -n "^function\|^// ──"`
  找到區塊，它以註解分隔成明確的段落（Game state / Players / 動畫 / 攻擊 /
  輸入 / 主迴圈 / COMBO / Duo / Fusion / 開始流程 等）。
- **捲動是全域前提**：`buildings.js`、`mountains.js`、`patches.js`、`items.js`
  都依 `scrollOffset` / `_activeScrollSpeed` 生成與回收物件。新增任何場上物件時
  記得一併處理捲動位移與離場回收，否則會漏出畫面外或無限累積。
- **全域命名衝突**：沒有模組作用域，新增全域變數前先 `grep` 確認名稱沒被用過。
  檔案內部私有的東西慣例上加底線前綴（`_fusionBalls`、`_comboTimer`）。
- **時間單位有兩種**：`dt` 是「以 60fps 為 1 的幀數倍率」（`elapsedMs / 16.67`），
  `dtSec` 才是秒。`constants.js` 裡的速度常數多半是「每幀」單位，改成每秒制時要
  整批換算，不要只改一個。
- **`three.min.js` 是 vendored 檔案**，不要手動編輯（與 BattleLand 的那份完全相同）。
- 沒有自動化測試，改完請實際開瀏覽器操作驗證。畫面右下角有 debug box
  （`#debug-box`）與玩家綁定狀態列。
