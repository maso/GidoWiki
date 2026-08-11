# AGENTS.md — BattleLand

給 AI coding agent 的專案說明。開始工作前請先讀完本檔。

## 這是什麼

**2v2 團隊佔領對戰 prototype**：四隻巨獸分成 Team A 與 Team B，在固定的方形戰場上
互相攻擊、破壞對方顏色的建築物。建築物被打掉後會以攻擊方的隊色重建，
畫面頂端的領地條即時顯示雙方佔領百分比，時間到時佔比高的一隊獲勝。

同一個 `_prototypes/` 底下的 **PvE4** 是它的姊妹版本（合作制、捲動關卡）。
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
→ buildings.js → mountains.js → patches.js → pedestrians.js → items.js
→ game.js → effects.js → hpbar.js → bubble.js → collision.js
```

**所有東西都是全域變數，沒有模組系統。** `constants.js` 的常數、`scene.js` 的
`scene`/`camera`/`renderer`、`game.js` 的 `players`/`gameStarted` 等都是全域可見。
新增檔案時記得加進 `index.html` 的載入清單，並放在它依賴的檔案之後。

`index.html` 結尾的 inline script 呼叫 `loop()` 啟動遊戲主迴圈。

### 各檔案職責

| 檔案 | 內容 |
|---|---|
| `constants.js` | 所有可調參數（移動、衝刺、攻擊、傷害、Fusion、隊伍建築色）與共用 easing 函式 |
| `scene.js` | Three.js 場景、相機、光源、地面與格線 |
| `character.js` | 巨獸模型工廠 `createCharacter()`、名牌 sprite |
| `input.js` | 鍵盤／滑鼠／手把輸入與**玩家插槽綁定**（`playerBindings`） |
| `game.js` | ★核心：玩家狀態、動畫、攻擊、衝刺、主迴圈 `loop()`、領地計算、Duo/Fusion、開始／暫停／結束流程 |
| `buildings.js` | 建築物生成、隊伍歸屬、擊毀與重建動畫、領地分母 |
| `mountains.js` / `patches.js` | 背景山脈與地面色塊裝飾 |
| `pedestrians.js` | 路人：遊走、逃跑、被吃掉（累積 Duo 值） |
| `items.js` | 三種道具：❤️ 回 25 HP、⏰ +10 秒、🍔 +25 Duo |
| `effects.js` | 火焰／煙霧等粒子特效（採物件池 pooling） |
| `hpbar.js` | HP 條 DOM、傷害判定、死亡與重生流程、玩家間攻擊命中判定 |
| `bubble.js` | 死亡後的泡泡重生：從天而降、可被打破、玩家可在泡泡內掙扎 |
| `collision.js` | 角色與建築物的推擠解算、重生落點搜尋 |
| `level.js` / `flames.js` | **已停用的空檔**（捲動與火焰是 PvE4 的機制，這裡移除了） |

## 遊戲規則

**隊伍與角色**：`PLAYER_INIT` 定義四個插槽——A1/B1 是 **Killer**（對玩家傷害 ×2），
A2/B2 是 **Builder**（重建的建築物高度 h=2）。開始畫面用左右方向鍵／十字鍵
切換深淺色即切換角色（深＝Killer、淺＝Builder）。

**勝負**：計時結束時比較 `territoryA` / `territoryB`，高者獲勝、相同為 DRAW。
領地由建築物的佔地面積（`w × d`）比例算出，分母是開場時所有建築物的總佔地
（`_totalFootprint`，全場固定不變）。

**建築物**：打掉敵方或中立建築後，會以攻擊方隊色重建（先扁平再 Out Elastic 長高）。
重建動畫期間免疫傷害。**不能攻擊自己隊伍的建築物**。

**Duo / Fusion**：吃路人累積 Duo 值，滿了之後按住 Shift／LB 會出現閃爍光環，
兩名隊友靠近可融合成一顆威力強大的球體，持續 8 秒。

## 操作

| | 鍵盤（1P） | 手把 |
|---|---|---|
| 移動 | W/A/S/D | 左類比 + 十字鍵 |
| 攻擊 | 滑鼠左鍵 | A（button 0） |
| 衝刺 | 空白鍵 | A（button 0） |
| Duo | Shift | LB（button 4） |
| 選色／角色 | ←／→ | 十字鍵左右（button 14/15） |

開始畫面按任意鍵／任意手把鍵即可佔用一個玩家插槽（`tryBindKeyboard` /
`tryBindGamepad`），鍵盤只能綁定一個插槽。

## 修改時的注意事項

- **`game.js` 有 1700 行**，是最大的檔案。修改前先用 `grep -n "^function\|^// ──"`
  找到區塊，它以註解分隔成明確的段落（Game state / Players / 動畫 / 攻擊 /
  輸入 / 主迴圈 / Duo / Fusion / 開始流程 等）。
- **全域命名衝突**：沒有模組作用域，新增全域變數前先 `grep` 確認名稱沒被用過。
  檔案內部私有的東西慣例上加底線前綴（`_fusionBalls`、`_slotDark`）。
- **時間單位有兩種**：`dt` 是「以 60fps 為 1 的幀數倍率」（`elapsedMs / 16.67`），
  `dtSec` 才是秒。`constants.js` 裡的速度常數多半是「每幀」單位，改成每秒制時要
  整批換算，不要只改一個。
- **`three.min.js` 是 vendored 檔案**，不要手動編輯（與 PvE4 的那份完全相同）。
- **名稱陷阱**：`constants.js` 的 `COMBO_MAX` 指的是「連續出拳到第幾拳」
  （第 3 拳變重拳），不是計分用的連擊數。
- 沒有自動化測試，改完請實際開瀏覽器操作驗證。畫面右下角有 debug box
  （`#debug-box`），`game.js` 開頭有全域錯誤攔截會把例外顯示在上面。
