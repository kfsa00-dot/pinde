# 品德三冠王登記

光復國小學務處「品德三冠王」加扣分登記系統。老師在一頁裡選完評分項目、加/扣分、班級座號和行為，按一次送出就寫進學務處試算表，取代原本要翻 4 頁的 Google 表單。

| | |
|---|---|
| 入口頁 | https://kfsa00-dot.github.io/pinde/ |
| 登記網頁 | Apps Script 網頁應用程式（需校內帳號登入） |
| 資料落點 | 試算表「品德三冠王評分（回覆）」的 `115-1` 分頁 |

## 這個 repo 有什麼

```
index.html              GitHub Pages 入口頁（好記的短網址，導向登記網頁）
manifest.webmanifest    加到手機主畫面用
icons/                  App 圖示
gas/Code.gs             Apps Script 後端：驗證輸入、對應欄位、寫入試算表
gas/Index.html          Apps Script 前端：實際的登記畫面
tools/make_icons.py     重新產生圖示
tools/make_qr.py        產生推廣用 QR code
部署說明.md              部署設定、驗證紀錄、注意事項
```

`gas/` 底下兩個檔案是 Apps Script 專案的內容備份。**改完要貼回 Apps Script 專案並重新部署才會生效**，這個 repo 不會自動同步。

## 常見維護

**換學期**（例如下學期）
1. `gas/Code.gs` 的 `SHEET_NAME` 改成 `'115-2'`
2. 貼回 Apps Script → 存檔 → 部署 → 管理部署作業 → 版本選「新版本」
3. `index.html` 的 `TERM` 改成新學期字樣，推上 GitHub

新的工作表會自動建立，標題列沿用「表單回覆 1」，欄位完全一致。

**改網址**：`index.html` 最上面的 `APP_URL`。沿用同一個部署作業時網址不會變，只有另外「新增部署作業」才需要改。

**表單題目有增刪**：在 Apps Script 執行一次 `diagnose()`，看執行紀錄裡每一題是不是都對到正確欄位。出現 `⚠ 不一致` 或 `✗` 就要更新 `gas/Code.gs` 裡的題目 ID。

## 為什麼不是直接用 Google 表單的預填連結

實測過：預填連結只對表單第一頁有效，第二頁之後（加/扣分、班級座號、行為項目）完全不會帶入；表單又開了草稿自動儲存，舊草稿會蓋掉預填。所以改成自己寫前端 + Apps Script 寫回試算表。
