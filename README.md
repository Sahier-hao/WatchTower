# 🔔 WatchTower — 网站更新监控与推送

多人在线版通知助手。监控任意网页变化，新内容通过飞书即时推送。

## 特性

- 🕷️ **CSS 选择器抓取** — 可视化配置，实时测试预览
- 🔔 **飞书推送** — 新通知通过飞书机器人卡片消息提醒
- 👥 **多人独立** — 每人一个 workspace，URL 即身份，无需注册
- ☁️ **完全免费** — 基于 GitHub Actions + Cloudflare + Turso，零服务器、零信用卡
- 🔌 **可扩展** — 支持任意网站，通知渠道可扩展

## 部署

完整部署指南见 **[SETUP.md](SETUP.md)**，30 分钟搞定，全程免费。

## 本地开发

```bash
# 后端（本地调试用）
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# 前端
cd frontend
npm install
npm run dev

# Worker（本地测试）
cd worker
npx wrangler dev
```

## 架构

```
GitHub Actions (定时爬虫)        Cloudflare Worker (API)
       │                                │
       └────────┬───────────────────────┘
                │
                ▼
          Turso (云 SQLite)
                │
                ▼
      Cloudflare Pages (前端)
```

## 技术栈

| 层 | 技术 |
|----|------|
| 爬虫引擎 | Python + httpx + BeautifulSoup4 |
| 定时调度 | GitHub Actions (每 30 分钟) |
| 后端 API | Cloudflare Worker (JavaScript) |
| 数据库 | Turso (libsql/SQLite) |
| 前端 | React + TypeScript + Tailwind CSS |
| 通知 | 飞书 Webhook 卡片消息 |

## License

MIT
