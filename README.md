# kenli0515.github.io

小工具入口網站：用 grid 列出我最近做的 GitHub Pages 工具，每張卡片有簡介、標籤、最後更新時間和版本號。

## 結構

- `index.html` / `assets/` — 靜態入口網站，無框架、無 build step。
- `projects.json` — 手寫 manifest，也是唯一需要改的檔案：標題、簡介、標籤、網址、repo、版本覆寫。
- `data/projects.json` — 由 GitHub API 自動生成，頁面實際讀這個檔案。
- `tools/build-data.mjs` — 讀 manifest，抓 repo 的 `pushed_at`、語言、版本，寫出 `data/projects.json`。
- `.github/workflows/update-projects.yml` — 每日 08:00（HKT）自動更新資料並 commit。

## 新增一個工具

1. 在 `projects.json` 的 `projects` 陣列加一筆：

   ```json
   {
     "id": "my-tool",
     "title": "工具名稱",
     "emoji": "🧰",
     "description": "一句話介紹。",
     "tags": ["標籤"],
     "url": "https://kenli0515.github.io/my-tool/",
     "repo": "kenli0515/my-tool"
   }
   ```

2. 本機重建資料：`GITHUB_TOKEN=$(gh auth token) node tools/build-data.mjs`
3. Commit 並 push，Action 之後會自己保持更新。

## 版本號是怎樣來的

優先次序：manifest 的 `version` → repo 的 `version.json` → repo 的 `package.json` →
最新的 git tag → 最後更新日期（CalVer，例如 `2026.09.19`，卡片上會用灰色標示）。

想給某個工具固定的版本號，就在 manifest 那筆加 `"version": "1.2.3"`。
