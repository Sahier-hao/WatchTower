# 通知助手 (Notification Assistant) — 设计方案

> 一个网站通知监控与推送系统，自动爬取指定网页的新通知，通过飞书/钉钉/邮件等渠道推送提醒。

---

## 一、核心需求

| # | 需求 | 说明 |
|---|------|------|
| 1 | 网站爬取 | 爬取学校各部门官网的通知公告（静态 HTML 列表页为主） |
| 2 | 新通知推送 | 检测到新通知时，通过飞书 Webhook 机器人推送卡片消息 |
| 3 | 管理界面 | Web 管理面板，可视化增删改查爬取源，支持手动测试爬取 |
| 4 | 可扩展 | 架构支持接入任意网站、任意通知渠道 |

---

## 二、技术选型

| 层 | 技术 | 说明 |
|---|---|---|
| **后端框架** | FastAPI (Python 3.10+) | 异步高性能，自带 Swagger 文档 |
| **爬虫引擎** | httpx + BeautifulSoup4 + lxml | 轻量 HTTP 客户端 + 快速 HTML 解析 |
| **ORM** | SQLAlchemy 2.0 (async) | 支持异步操作，配合 SQLite |
| **数据库** | SQLite | 轻量零配置，单机部署无额外依赖 |
| **定时任务** | APScheduler | 类 cron 定时调度，支持动态增删任务 |
| **去重** | hashlib sha256 | 标题+链接生成哈希值，快速检测新增 |
| **前端框架** | React 18 + Vite + TypeScript | 现代化开发体验 |
| **UI 组件** | shadcn/ui (Tailwind CSS) | 高质量可定制组件库 |
| **通知渠道** | 飞书 Webhook 机器人 | 卡片消息，搭建最简单 |

---

## 三、系统架构

```
┌─────────────────────────────────────────────────────┐
│                React 管理界面 (Vite)                  │
│      仪表盘 │ 爬取源管理 │ 通知列表 │ 系统设置        │
└────────────────────┬────────────────────────────────┘
                     │ REST API (JSON)
┌────────────────────▼────────────────────────────────┐
│                  FastAPI 后端                         │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 爬虫引擎  │  │   定时调度    │  │  通知分发器   │   │
│  │ Crawler  │  │  Scheduler   │  │  Notifier    │   │
│  │          │  │              │  │              │   │
│  │ httpx    │  │ APScheduler  │  │ Feishu       │   │
│  │ BS4+lxml │  │ 动态任务管理  │  │ DingTalk     │   │
│  └────┬─────┘  └──────┬───────┘  │ Email ...    │   │
│       │               │           └──────┬───────┘   │
│       │               │                  │           │
│  ┌────▼───────────────▼──────────────────▼───────┐    │
│  │              SQLite 数据库                      │    │
│  │  ┌──────────┐ ┌─────────┐ ┌─────────────────┐ │    │
│  │  │ sources  │ │ notices │ │notification_logs│ │    │
│  │  └──────────┘ └─────────┘ └─────────────────┘ │    │
│  └───────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
    ┌──────────┐        ┌──────────┐
    │ 飞书群    │        │ 其他渠道  │
    └──────────┘        └──────────┘
```

---

## 四、数据库设计

### `sources` — 爬取源配置

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | UUID | ✓ | 主键 |
| `name` | String | ✓ | 来源名称，如"教务处通知" |
| `url` | String | ✓ | 目标列表页 URL |
| `list_selector` | String | ✓ | CSS 选择器，定位通知列表项容器 |
| `title_selector` | String | ✓ | CSS 选择器，提取标题文本 |
| `link_selector` | String | ✓ | CSS 选择器，提取链接 href |
| `time_selector` | String | | CSS 选择器，提取发布时间（可选） |
| `crawl_interval` | Integer | ✓ | 爬取间隔（分钟），默认 30 |
| `is_active` | Boolean | ✓ | 是否启用，默认 true |
| `last_crawled_at` | DateTime | | 上次成功爬取时间 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 最后更新时间 |

### `notices` — 已爬取通知

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | UUID | ✓ | 主键 |
| `source_id` | FK | ✓ | 外键 → sources.id |
| `title` | String | ✓ | 通知标题 |
| `url` | String | ✓ | 通知详情链接 |
| `content_hash` | String | ✓ | SHA256(title+url) 去重索引 |
| `published_at` | DateTime | | 通知发布时间（从页面提取） |
| `first_seen_at` | DateTime | ✓ | 首次抓取到的时间 |
| `raw_data` | JSON | | 原始抓取的完整数据 |

### `notification_logs` — 推送记录

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | UUID | ✓ | 主键 |
| `notice_id` | FK | ✓ | 外键 → notices.id |
| `channel` | String | ✓ | 推送渠道（feishu/dingtalk/email） |
| `status` | String | ✓ | success / failed |
| `error_msg` | String | | 失败原因 |
| `sent_at` | DateTime | ✓ | 推送时间 |

---

## 五、API 设计

```
基础路径: /api

GET    /sources                获取爬取源列表 (支持分页)
POST   /sources                创建新爬取源
GET    /sources/{id}           获取单个爬取源详情
PUT    /sources/{id}           更新爬取源配置
DELETE /sources/{id}           删除爬取源
POST   /sources/{id}/test      手动测试爬取 (返回解析结果预览)
POST   /sources/{id}/crawl     手动触发一次爬取

GET    /notices                通知列表 (分页 + 按来源筛选 + 时间排序)
GET    /notices/{id}           通知详情

GET    /logs                   推送日志 (分页)
GET    /stats                  统计数据 (来源数、今日新增、推送成功率)

GET    /settings               获取系统设置
PUT    /settings               更新系统设置

GET    /health                 健康检查
```

---

## 六、爬虫引擎逻辑

```
┌───────────────────────────────────────────────────┐
│                   Crawler.crawl(source)            │
├───────────────────────────────────────────────────┤
│                                                     │
│  1. 加载 User-Agent 池，随机选择一个模拟浏览器        │
│                         │                           │
│  2. httpx.get(source.url, timeout=15)              │
│     → 成功？ ──── 否 ───→ 记录错误，return          │
│     │ 是                                            │
│  3. BeautifulSoup(html, "lxml")                     │
│     soup.select(source.list_selector)               │
│     → 有结果？ ── 否 ──→ 记录"选择器无匹配"，return  │
│     │ 是                                            │
│  4. 遍历每个列表项 element:                          │
│     ├── title  = element.select_one(title_selector) │
│     ├── link   = element.select_one(link_selector)  │
│     ├── time   = element.select_one(time_selector)  │
│     ├── hash   = sha256(title + link)               │
│     ├── 查重：content_hash 是否已在 notices 表中？   │
│     │    → 存在 → 跳过（旧通知）                     │
│     │    → 不存在 → ↓                               │
│     ├── 写入 notices 表                             │
│     ├── 触发通知 → notifier.send(notice)            │
│     └── 写入 notification_logs 表                    │
│                         │                           │
│  5. 更新 source.last_crawled_at = now()             │
│                                                     │
└───────────────────────────────────────────────────┘
```

### 选择器配置示例

假设目标 HTML 结构：
```html
<ul class="news-list">
  <li>
    <a class="title" href="/info/123.html">关于期末考试安排的通知</a>
    <span class="date">2026-05-28</span>
  </li>
  <li>...</li>
</ul>
```

对应的选择器配置：
| 配置项 | 值 |
|--------|-----|
| `list_selector` | `ul.news-list > li` |
| `title_selector` | `a.title` |
| `link_selector` | `a.title` |
| `time_selector` | `span.date` |

> 选择器作用域：`title_selector`、`link_selector`、`time_selector` 是相对于 `list_selector` 匹配的每个列表项 `element` 而言的。

---

## 七、飞书通知消息格式

使用飞书**卡片消息**，结构清晰，可点击跳转：

```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": { "tag": "plain_text", "content": "🔔 新通知 — 教务处" },
      "template": "blue"
    },
    "elements": [
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": "**关于期末考试安排的通知**\n📅 发布时间：2026-05-28\n🔗 [查看详情](https://jwc.example.edu.cn/info/123.html)"
        }
      }
    ]
  }
}
```

---

## 八、前端页面设计

### 1. 仪表盘 `/`
```
┌─────────────────────────────────────────────┐
│  通知助手 - 仪表盘                           │
├─────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐                │
│  │  5   │ │  12  │ │ 98%  │                │
│  │ 来源  │ │今日新 │ │推送率 │                │
│  └──────┘ └──────┘ └──────┘                │
│                                             │
│  📋 最近通知                                │
│  ┌──────────────────────────────────────┐  │
│  │ 关于期末考试安排的通知  教务处 5分钟前  │  │
│  │ 2026年招生简章发布     招生办 1小时前  │  │
│  │ ...                                   │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 2. 爬取源管理 `/sources`
- 表格展示：名称、URL、状态开关、间隔、上次爬取、操作按钮
- 操作按钮：编辑、测试、手动爬取、删除
- 新增/编辑弹窗：表单含名称、URL、选择器配置、爬取间隔
- **测试弹窗**：点击后实时抓取，下方展示解析出的列表预览

### 3. 通知列表 `/notices`
- 表格展示：标题、来源、发布时间、首次抓取时间
- 来源下拉筛选、标题搜索
- 点击标题跳转到原文

### 4. 系统设置 `/settings`
- 飞书 Webhook URL 输入（支持多个）
- 全局默认爬取间隔
- 测试发送按钮

---

## 九、项目目录结构

```
notification-assistant/
│
├── backend/                         # Python 后端
│   ├── main.py                      # FastAPI 入口，挂载路由 & 启动调度器
│   ├── config.py                    # 配置管理 (Settings pydantic model)
│   ├── database.py                  # SQLAlchemy async engine + session
│   ├── models/
│   │   ├── __init__.py
│   │   ├── source.py                # Source ORM 模型
│   │   ├── notice.py                # Notice ORM 模型
│   │   └── notification_log.py      # NotificationLog ORM 模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── source.py                # Source 请求/响应 schema
│   │   ├── notice.py                # Notice 响应 schema
│   │   └── settings.py              # Settings schema
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── sources.py               # 爬取源 CRUD + test + crawl
│   │   ├── notices.py               # 通知列表 & 详情
│   │   ├── logs.py                  # 推送日志
│   │   ├── stats.py                 # 统计数据
│   │   └── settings.py              # 系统设置
│   ├── services/
│   │   ├── __init__.py
│   │   ├── crawler.py               # 爬虫引擎：CSS选择器抓取 + 去重
│   │   ├── scheduler.py             # APScheduler 封装
│   │   └── notifier.py              # 通知分发器 (飞书/钉钉/邮件)
│   ├── requirements.txt
│   └── .env.example                 # 环境变量模板
│
├── frontend/                        # React 前端
│   ├── src/
│   │   ├── main.tsx                 # 入口
│   │   ├── App.tsx                  # 根组件 + 路由
│   │   ├── index.css                # 全局样式
│   │   ├── lib/
│   │   │   └── utils.ts             # 工具函数 (classnames 等)
│   │   ├── api/
│   │   │   └── client.ts            # axios 实例 + API 函数封装
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript 类型定义
│   │   ├── hooks/
│   │   │   └── use-toast.ts         # Toast 通知 hook
│   │   ├── components/
│   │   │   ├── layout.tsx           # 页面布局 (侧边栏+顶栏)
│   │   │   ├── source-form.tsx      # 爬取源表单 (新增/编辑)
│   │   │   └── test-result.tsx      # 测试结果展示
│   │   └── pages/
│   │       ├── dashboard.tsx        # 仪表盘
│   │       ├── sources.tsx          # 爬取源管理
│   │       ├── notices.tsx          # 通知列表
│   │       └── settings.tsx         # 系统设置
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── tsconfig.app.json
│
└── README.md                        # 项目说明 & 快速开始
```

---

## 十、可扩展性

| 扩展方向 | 实现方式 |
|----------|----------|
| **新通知渠道** | `notifier.py` 使用策略模式，定义 `Notifier` 基类，新增渠道只需实现 `async send(notice) → bool` |
| **动态页面** | 爬虫配置增加 `page_type: "static" | "dynamic"`，后者调用 Playwright 渲染 JS |
| **XPath 支持** | 选择器配置增加 `mode: "css" | "xpath"`，alternate between `soup.select()` and `etree.HTML().xpath()` |
| **分布式爬取** | APScheduler → Celery + Redis broker，多 worker node 并行 |
| **内容去重增强** | title+url 哈希 → 全文 SimHash / MinHash 近似去重，避免换标题重发 |
| **RSS 订阅源** | 爬虫支持 `type: "rss"`，直接解析 XML feed |
| **认证页面** | cookies / headers 配置支持，处理需登录的校内页面 |

---

## 十一、实现步骤

| 步骤 | 内容 | 产出物 |
|------|------|--------|
| **Step 1** | 项目初始化 | 后端目录结构 + Python 依赖；前端 Vite 脚手架 + Tailwind + shadcn/ui |
| **Step 2** | 后端 — 数据库 & CRUD | ORM 模型、Source CRUD API、Settings API |
| **Step 3** | 后端 — 爬虫 & 通知 | 爬虫引擎、测试接口、飞书推送、APScheduler 调度 |
| **Step 4** | 后端 — Notice & Log API | 通知列表/详情 API、推送日志 API、统计 API |
| **Step 5** | 前端 — 管理界面 | 四个页面：仪表盘/爬取源/通知/设置 |
| **Step 6** | 联调测试 | 端到端：添加源 → 测试 → 定时抓取 → 推送 |

---

## 十二、验证清单

- [ ] 后端启动：`uvicorn main:app --reload` → 访问 `http://localhost:8000/docs` 查看 Swagger
- [ ] 前端启动：`npm run dev` → 访问 `http://localhost:5173`
- [ ] 创建爬取源：填写真实学校网站 URL 和选择器
- [ ] 手动测试：点击测试按钮，确认解析出正确的通知列表
- [ ] 飞书推送：填写 Webhook URL，收到卡片消息
- [ ] 定时抓取：启用来源，等待间隔触发，确认新通知自动推送
- [ ] 去重验证：手动连续爬取两次，确认不产生重复通知
