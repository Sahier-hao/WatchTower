# 🚀 WatchTower — 免费云端部署指南

> 零元、零信用卡，支持多人独立使用。

---

## 最终效果

```
https://你的域名.pages.dev          ← 首页，创建/加入空间
https://你的域名.pages.dev/w/cupk    ← 你的独立空间
https://你的域名.pages.dev/w/xyz     ← 同学的空间（互不干扰）
```

---

## 准备工作

- GitHub 账号
- Cloudflare 账号（邮箱免费注册，无需信用卡）
- 飞书群的 Webhook URL

---

## 第一步：Turso 数据库

1. 打开 [app.turso.tech](https://app.turso.tech) → 用 GitHub 登录
2. 点 **Create Database** → 起名 `notifier` → 选 `aws-ap-northeast-1`（东京）→ 创建
3. 记下数据库 URL，格式：`libsql://notifier-xxx.aws-ap-northeast-1.turso.io`
4. 点 **Tokens** → **Create Token** → 权限选 **Full Access** → 复制保存（只显示一次）

---

## 第二步：迁移本地数据

把本地 SQLite 中的爬取源配置上传到 Turso。

```powershell
cd "D:\code\Notification Assistant\backend"

$env:TURSO_URL = "libsql://你的数据库.turso.io"    # 第一步拿到的 URL
$env:TURSO_TOKEN = "你的token"                      # 第一步拿到的 Token
$env:WS_ID = "你的空间ID"                            # 自己起，如 cupk
$env:WS_NAME = "我的空间"
python migrate_to_turso.py
```

> 历史通知默认跳过（HTTP 逐条迁移太慢）。源迁完即可，新通知由爬虫自动抓取。

---

## 第三步：Cloudflare Worker（后端 API）

```powershell
npm install -g wrangler
cd worker
wrangler login

# 设置三个密钥
wrangler secret put TURSO_URL     # 粘贴 Turso URL（libsql://...）
wrangler secret put TURSO_TOKEN   # 粘贴 Turso Token
wrangler secret put FEISHU_WEBHOOK # 粘贴飞书 Webhook URL（可选）

wrangler deploy
```

记下输出的 Worker URL：`https://xxx.workers.dev`

---

## 第四步：Cloudflare Pages（前端）

1. 代码推到 GitHub：
```powershell
git init && git add . && git commit -m "init"
git remote add origin https://github.com/你的用户名/WatchTower.git
git push -u origin main
```

2. Cloudflare Dashboard → **Workers & Pages** → **Pages** → **连接到 Git**
3. 选择仓库，构建设置：

| 配置项 | 值 |
|--------|-----|
| 构建命令 | `cd frontend && npm install && npm run build` |
| 输出目录 | `frontend/dist` |

4. 环境变量：`VITE_API_BASE` = `https://你的worker.workers.dev`

---

## 第五步：GitHub Actions（定时爬虫）

GitHub 仓库 → **Settings** → **Secrets** → **Actions**，添加：

| Name | 值 |
|------|-----|
| `TURSO_URL` | libsql://... |
| `TURSO_TOKEN` | 你的 Turso Token |
| `FEISHU_WEBHOOK` | 飞书 Webhook URL |

Actions → **定时爬取** → **Run workflow** 手动触发验证。

---

## 第六步：使用

打开 Pages 域名 → 首页输入你的 workspace ID 加入空间 → 添加爬取源 → 配置飞书 Webhook。

分享给同学：打开同一个网址，点「创建并开始」即可得到独立空间。

---

## 费用

| 服务 | 免费额度 |
|------|----------|
| GitHub Actions | 2000分钟/月 |
| Cloudflare Worker | 10万请求/天 |
| Cloudflare Pages | 无限 |
| Turso | 9GB 存储 |
| **合计** | **¥0 / 月** |

---

## 项目结构

```
WatchTower/
├── .github/workflows/crawl.yml     # 每30分钟自动爬虫
├── backend/
│   ├── standalone_crawl.py         # GA 爬虫脚本
│   ├── migrate_to_turso.py         # 数据迁移工具
│   └── ...                         # FastAPI（本地调试用）
├── worker/
│   ├── worker.js                   # Cloudflare Worker API
│   └── wrangler.toml
├── frontend/                       # React + Tailwind
│   └── src/pages/
│       ├── home.tsx                # 首页
│       ├── sources.tsx             # 爬取源管理
│       ├── notices.tsx             # 通知列表
│       └── settings.tsx            # 设置
└── README.md
```
