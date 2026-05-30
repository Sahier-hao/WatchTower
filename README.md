# 🔔 WatchTower — 网站更新监控与推送

多人在线通知助手。监控任意网页变化，新内容通过飞书卡片即时推送。

## 特性

- 🕷️ **CSS 选择器抓取** — 可视化配置，实时测试预览，支持 3 种页面模板
- 🔔 **飞书推送** — 新通知通过飞书机器人卡片消息提醒，支持多 Webhook
- 👥 **多人独立** — 每人一个 workspace，URL 即身份，无需注册登录
- 🔒 **权限管理** — 管理员可编辑源，普通成员只读 + 各自管理自己的通知地址
- 📱 **移动端适配** — 底部导航栏，响应式布局
- ⚡ **骨架屏加载** — 数据加载时灰色占位块，体验流畅
- 📊 **爬取日志** — 每次自动运行的记录可追溯
- ☁️ **完全免费** — GitHub Actions + Cloudflare Pages + Turso，零服务器零信用卡

## 快速开始

### 生产部署

[SETUP.md](SETUP.md) — 6 步部署指南，30 分钟上线。

### 本地开发

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload        # http://localhost:8000/docs

# 前端
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

## 架构

```
用户浏览器 ──→ Cloudflare Pages (React 前端 + Functions API)
                     │
                     ├── /api/* → Turso HTTP API (东京节点)
                     │
                GitHub Actions (每 1 小时爬取)
                     │
                     ├── Turso (读写通知数据)
                     └── 飞书 Webhook (推送卡片)
```

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 爬虫引擎 | Python + httpx + BeautifulSoup4 + lxml | 异步 HTTP + CSS 选择器解析 |
| 定时调度 | GitHub Actions | 北京 6:00-23:00 每小时执行 |
| 后端 API | Cloudflare Pages Functions (JS) | 同域名部署，免跨域 |
| 数据库 | Turso (libsql/SQLite) | 免费 9GB，东京节点 |
| 前端 | React 18 + TypeScript + Tailwind CSS + Vite | 响应式，骨架屏 |
| 通知 | 飞书 Webhook 卡片消息 | 群机器人，支持多人 |

## 项目结构

```
WatchTower/
├── .github/workflows/crawl.yml     # 定时爬虫配置
├── backend/
│   ├── standalone_crawl.py         # GitHub Actions 独立爬虫
│   ├── migrate_to_turso.py         # 本地数据 → Turso 迁移
│   ├── services/crawler.py         # 爬虫引擎（本地版）
│   └── main.py                     # FastAPI 入口（本地调试）
├── worker/
│   ├── worker.js                   # Worker 源码
│   └── wrangler.toml               # 部署配置
├── frontend/
│   ├── functions/api/              # Pages Functions（同域 API）
│   ├── src/
│   │   ├── pages/
│   │   │   ├── home.tsx            # 首页（创建/加入空间）
│   │   │   ├── dashboard.tsx       # 仪表盘
│   │   │   ├── sources.tsx         # 爬取源管理（展开查看通知）
│   │   │   ├── notices.tsx         # 通知列表
│   │   │   ├── runs.tsx            # 爬取日志
│   │   │   └── settings.tsx        # 个人 Webhook 设置
│   │   ├── components/
│   │   │   ├── layout.tsx          # 布局（侧边栏 + 底部导航）
│   │   │   ├── skeleton.tsx        # 骨架屏组件
│   │   │   └── toast.tsx           # Toast 通知
│   │   ├── api/client.ts           # API 客户端
│   │   ├── lib/cache.ts            # 内存缓存
│   │   └── types/index.ts          # TypeScript 类型
│   └── vite.config.ts
├── docs/                           # 项目文档（本地保留）
│   ├── DEPLOY.md                   # 部署完全手册
│   ├── REPORT.md                   # 项目全记录
│   ├── CLOUDFLARE.md               # Cloudflare 深度解析
│   ├── TURSO.md                    # Turso 详解
│   ├── GITHUB_ACTIONS.md           # GitHub Actions 详解
│   └── TECH_STACK.md               # 技术栈全景
├── CREDENTIALS.md                  # 私密凭证（不上传）
└── DESIGN.md                       # 原始设计方案
```

## 部署更新

```bash
# Worker 代码
cd worker && wrangler deploy

# 前端（含 Pages Functions API）
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=watchtower --commit-dirty=true

# 提交代码
git add . && git commit -m "描述改动" && git push
```

## License

MIT
