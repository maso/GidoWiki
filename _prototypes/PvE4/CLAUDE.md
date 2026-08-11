See @AGENTS.md for full project instructions.

重點摘要：

- **最多 4 人合作 PvE 闖關**：地圖持續捲動，破壞建築累積分數與 COMBO，閃避下方火線
- **沒有建置步驟、沒有 npm**：純靜態檔案 + vendored `three.min.js`，改完存檔重整就好
- **全域變數架構**：`index.html` 的 `<script>` 載入順序就是相依順序，新增檔案要加進去
- **捲動是全域前提**：新增場上物件時必須一併處理 `scrollOffset` 位移與離場回收
- **姊妹專案 `../BattleLand/` 內容已大幅分歧**，同名檔案不可互相搬用
- 沒有自動化測試，改完請實際開瀏覽器驗證
