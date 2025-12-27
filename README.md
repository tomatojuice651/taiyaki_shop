# 🐟 鯛魚燒商城 Taiyaki Shop

使用 Discord 機器人累積的鯛魚燒點數來兌換獎品的商城網站。

## 功能

- 📊 查詢鯛魚燒點數
- 🎁 瀏覽可兌換獎品
- 🛒 使用點數兌換獎品
- 🔗 與 Discord 機器人共用 Supabase 資料庫

## 技術

- Next.js 14
- Supabase
- Tailwind CSS
- Vercel 部署

## 環境變數

在 Vercel 設定以下環境變數：

```
NEXT_PUBLIC_SUPABASE_URL=你的Supabase_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase_Key
```

## 開發

```bash
npm install
npm run dev
```

開啟 http://localhost:3000
