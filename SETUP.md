# 🚀 通知助手 — 免费云端部署指南

> 零元、零信用卡，支持多人独立使用。

---

## 最终效果

```
https://你的域名.pages.dev          ← 首页，创建/加入空间
https://你的域名.pages.dev/w/abc    ← 你的独立空间（源管理 + 通知列表）
https://你的域名.pages.dev/w/xyz    ← 同学的空间（互不干扰）
```

---

## 准备工作

- GitHub 账号（必选）
- Cloudflare 账号（免费注册，无需信用卡）
- 飞书群的 Webhook URL

---

## 第一步：Turso 数据库

1. 打开 [turso.tech](https://turso.tech) → 右上角 **Sign In** → 用 GitHub 登录
2. 装 CLI：

```powershell
# Windows
winget install tursodatabase.turso
# 或者直接下载 https://docs.turso.tech/cli/installation
```

3. 创建数据库：

```powershell
turso auth signup             # 浏览器授权 GitHub
turso db create notifier      # 创建数据库
turso db show notifier        # 记下 URL，如 libsql://notifier-xxx.turso.io

#我的：libsql://notifier-sahier-hao.aws-ap-northeast-1.turso.io

turso db tokens create notifier -e never

# ⚠️ 复制输出的 Token，只显示一次，务必保存！
我的：eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODAwNzg3NDYsImlkIjoiMDE5ZTc0ZjUtOWIwMS03NzRmLTk5OGItYTk5M2YyMjc4MTMyIiwicmlkIjoiM2M1ZDllYjQtNDcwYy00MTVkLWFmZTAtNzAzNzU2NzFjZjIxIn0.IWIGSWaBMVXTbR4HXlVzDz6erd3LALlh_qe2seyR8_5LtM0Bwa_t-b0PamshRLyO9jF7axCh3nW1ZW2SmTm6Dg
```

**记下这两个值：**
| 变量 | 值 |
|------|-----|
| `TURSO_URL` | `libsql://notifier-xxx.turso.io` |
| 变量 | 值 |
|------|-----|
| `TURSO_URL` | `libsql://notifier-sahier-hao.aws-ap-northeast-1.turso.io` |
| `TURSO_TOKEN` | 在 [app.turso.tech](https://app.turso.tech) → Tokens 获取 |

---

## 第二步：迁移本地数据

把本地 SQLite 里的爬取源上传到 Turso。

```powershell
cd "D:\code\Notification Assistant\backend"

$env:TURSO_URL = "libsql://notifier-sahier-hao.aws-ap-northeast-1.turso.io"
$env:TURSO_TOKEN = "你的token"       # 从第一步拿到
$env:WS_ID = "cupk"                  # 你的 workspace ID
$env:WS_NAME = "CUPK"
python migrate_to_turso.py
```

输出类似：
```
创建空间: cupk (CUPK)
表创建完成
本地源: 15 个
  ✅ 教务部-教学运行通知
  ✅ 石油学院-学生工作通知
  ...
跳过历史通知迁移
🎉 迁移完成！
```

> 历史通知默认跳过（HTTP 逐条迁移太慢）。源迁完即可，新通知由爬虫自动抓取。

---

## 第三步：Cloudflare Worker（后端 API）

1. 打开 [dash.cloudflare.com](https://dash.cloudflare.com) → 邮箱注册
2. 安装部署工具：

```powershell
npm install -g wrangler
```

3. 部署 Worker：

```powershell
cd worker
wrangler login                # 浏览器授权 Cloudflare

# 设置环境变量
wrangler secret put TURSO_URL
# 粘贴 Turso URL

wrangler secret put TURSO_TOKEN
# 粘贴 Turso Token

wrangler secret put FEISHU_WEBHOOK
# 粘贴飞书 Webhook URL（可选，作为默认通知地址）

wrangler deploy
```

部署成功后会输出 Worker URL，记下来：
```
https://notification-assistant-api.你的名字.workers.dev
```

---

## 第四步：Cloudflare Pages（前端）

1. 把项目代码推送到 GitHub：

```powershell
git init
git add .
git commit -m "通知助手 多人版"
git remote add origin https://github.com/Sahier-hao/WatchTower.git
git push -u origin main
```

2. 在 Cloudflare Dashboard → **Workers & Pages** → **Pages** → **连接到 Git**
3. 选择你的 GitHub 仓库
4. 构建设置：

| 配置项 | 值 |
|--------|-----|
| 构建命令 | `cd frontend && npm install && npm run build` |
| 输出目录 | `frontend/dist` |

5. 点 **环境变量** → 添加：

| 变量名 | 值 |
|--------|-----|
| `VITE_API_BASE` | Worker URL，如 `https://notification-assistant-api.xxx.workers.dev/api` |

6. 点 **保存并部署**

部署成功后会输出 Pages URL：`https://你的项目.pages.dev`

---

## 第五步：GitHub Actions（定时爬虫）

1. 打开 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点 **New repository secret**，添加三个：

| Name | 值 |
|------|-----|
| `TURSO_URL` | 同第一步 |
| `TURSO_TOKEN` | 同第一步 |
| `FEISHU_WEBHOOK` | 飞书 Webhook URL |

3. 回到仓库 → **Actions** → **定时爬取** → **Run workflow** → 手动触发一次，确认能跑通

GitHub Actions 会每 30 分钟自动运行一次爬虫，跨所有 workspace 抓取。

---

## 第六步：使用

### 你自己

1. 打开 `https://你的项目.pages.dev`
2. 如果你迁移了数据，点「加入已有空间」→ 输入你的 workspace ID（如 `sherlock`）
3. 进入后就能看到之前的所有源和通知

### 分享给同学

告诉同学：
1. 打开 `https://你的项目.pages.dev`
2. 点「创建并开始」
3. 得到他的独立空间 → 去设置里填飞书 Webhook → 添加爬取源

每个人的空间完全隔离。也可以创建空间时指定 ID 方便记忆。

---

## 验证清单

- [ ] `https://你的项目.pages.dev` 能打开首页
- [ ] 创建/加入空间成功，进入仪表盘
- [ ] 添加一个测试源 → 点「测试」→ 能解析出数据
- [ ] 点「手动爬取」→ 通知入库
- [ ] 飞书群收到通知卡片
- [ ] GitHub Actions 定时触发成功

---

## 费用

| 服务 | 免费额度 | |
|------|----------|:--:|
| GitHub Actions | 2000分钟/月 | ✅ |
| Cloudflare Worker | 10万请求/天 | ✅ |
| Cloudflare Pages | 无限 | ✅ |
| Turso | 9GB 存储 | ✅ |
| **合计** | **¥0 / 月** | ✅ |

---

## 项目结构

```
notification-assistant/
├── .github/workflows/crawl.yml     # 每30分钟自动爬虫
├── backend/
│   ├── standalone_crawl.py         # GitHub Actions 运行的爬虫
│   ├── migrate_to_turso.py         # 本地 SQLite → Turso
│   └── ...                         # （原 FastAPI 代码保留，本地调试用）
├── worker/
│   ├── worker.js                   # Cloudflare Worker (REST API)
│   └── wrangler.toml
├── frontend/                       # React + Tailwind (部署到 Pages)
│   └── src/
│       ├── pages/home.tsx          # 首页（创建/加入空间）
│       ├── pages/dashboard.tsx
│       ├── pages/sources.tsx
│       ├── pages/notices.tsx
│       └── pages/settings.tsx
└── SETUP.md
```
