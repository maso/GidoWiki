See @AGENTS.md for full project instructions.

重點摘要：

- **2v2 團隊佔領對戰**：打掉敵方建築改成自己的隊色，時間到時領地佔比高的一隊獲勝
- **沒有建置步驟、沒有 npm**：純靜態檔案 + vendored `three.min.js`，改完存檔重整就好
- **全域變數架構**：`index.html` 的 `<script>` 載入順序就是相依順序，新增檔案要加進去
- **姊妹專案 `../PvE4/` 內容已大幅分歧**，同名檔案不可互相搬用
- 沒有自動化測試，改完請實際開瀏覽器驗證
