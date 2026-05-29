"""
GitHub Actions 定时爬取脚本 — 多人版。

每次运行：
1. 从 Turso 读取所有启用的爬取源（跨所有 workspace）
2. 逐个爬取，SHA256 去重
3. 新通知写入 Turso，通过各自的飞书 Webhook 推送
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, Tag

# ── Turso 数据库配置 ──
_raw = os.environ["TURSO_URL"].replace("libsql://", "https://")
_parts = _raw.split("/")
_host_parts = _parts[2].split(".")
if len(_host_parts) >= 4:
    _host_parts.pop(-3)
    _parts[2] = ".".join(_host_parts)
TURSO_URL = "/".join(_parts)
TURSO_TOKEN = os.environ["TURSO_TOKEN"]
DEFAULT_WEBHOOK = os.environ.get("FEISHU_WEBHOOK", "")

# ── HTTP 配置 ──
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
]
HEADERS_TEMPLATE = {
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


# ── Turso HTTP API ──
def _typed_args(params: list | None) -> list:
    if not params:
        return []
    result = []
    for v in params:
        if isinstance(v, int):
            result.append({"type": "integer", "value": str(v)})
        elif v is None:
            result.append({"type": "null"})
        else:
            result.append({"type": "text", "value": str(v)})
    return result

def turso_query(sql: str, params: list | None = None) -> list[dict]:
    resp = httpx.post(
        f"{TURSO_URL}/v2/pipeline",
        headers={"Authorization": f"Bearer {TURSO_TOKEN}", "Content-Type": "application/json"},
        json={"requests": [
            {"type": "execute", "stmt": {"sql": sql, "args": _typed_args(params)}},
            {"type": "close"},
        ]},
        timeout=30,
    )
    resp.raise_for_status()
    rows = []
    for r in resp.json().get("results", []):
        if r.get("type") == "execute" and "response" in r:
            response = r["response"]
            if response.get("type") == "ok":
                cols = [c["name"] for c in response["result"]["cols"]]
                for row in response["result"].get("rows", []):
                    rows.append(dict(zip(cols, [v.get("value") for v in row])))
    return rows


def turso_execute(sql: str, params: list | None = None) -> int:
    resp = httpx.post(
        f"{TURSO_URL}/v2/pipeline",
        headers={"Authorization": f"Bearer {TURSO_TOKEN}", "Content-Type": "application/json"},
        json={"requests": [
            {"type": "execute", "stmt": {"sql": sql, "args": _typed_args(params)}},
            {"type": "close"},
        ]},
        timeout=30,
    )
    resp.raise_for_status()
    for r in resp.json().get("results", []):
        if r.get("type") == "execute" and "response" in r:
            return r["response"]["result"].get("affected_row_count", 0)
    return 0


# ── 初始化表 ──
def init_tables():
    turso_execute("""
        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT DEFAULT '默认空间',
            default_webhook TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    turso_execute("""
        CREATE TABLE IF NOT EXISTS sources (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id),
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            list_selector TEXT NOT NULL,
            title_selector TEXT NOT NULL,
            link_selector TEXT NOT NULL,
            time_selector TEXT,
            webhook_url TEXT DEFAULT '',
            crawl_interval INTEGER DEFAULT 30,
            is_active INTEGER DEFAULT 1,
            last_crawled_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)
    turso_execute("""
        CREATE TABLE IF NOT EXISTS notices (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            source_id TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            published_at TEXT,
            first_seen_at TEXT DEFAULT (datetime('now')),
            raw_data TEXT
        )
    """)
    turso_execute("""
        CREATE TABLE IF NOT EXISTS notification_logs (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            notice_id TEXT NOT NULL,
            channel TEXT DEFAULT 'feishu',
            status TEXT NOT NULL,
            error_msg TEXT,
            sent_at TEXT DEFAULT (datetime('now'))
        )
    """)
    # 创建索引
    turso_execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_notices_hash ON notices(content_hash)")
    turso_execute("CREATE INDEX IF NOT EXISTS idx_notices_workspace ON notices(workspace_id)")
    turso_execute("CREATE INDEX IF NOT EXISTS idx_sources_workspace ON sources(workspace_id)")


# ── 时间解析 ──
def parse_time(time_str: str | None) -> str | None:
    if not time_str:
        return None
    import re
    text = time_str.strip()
    formats = [
        "%Y-%m-%d", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d", "%Y/%m/%d %H:%M", "%Y年%m月%d日", "%m-%d", "%m月%d日",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(text, fmt)
            if dt.year == 1900:
                dt = dt.replace(year=datetime.now().year)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    m = re.match(r"^(\d{4})(\d{2}-\d{2})$", text)
    if m:
        try:
            return datetime.strptime(f"{m.group(1)}-{m.group(2)}", "%Y-%m-%d").replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass
    m = re.match(r"^(\d{2}-\d{2})(\d{4})$", text)
    if m:
        try:
            return datetime.strptime(f"{m.group(2)}-{m.group(1)}", "%Y-%m-%d").replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass
    return None


def make_hash(title: str, url: str) -> str:
    return hashlib.sha256(f"{title.strip()}|{url.strip()}".encode()).hexdigest()


def send_feishu(webhook_url: str, source_name: str, title: str, url: str, published_at: str | None) -> bool:
    if not webhook_url:
        return False
    time_line = f"📅 发布时间：{published_at}\n" if published_at else ""
    card = {
        "msg_type": "interactive",
        "card": {
            "header": {"title": {"tag": "plain_text", "content": f"🔔 新通知 — {source_name}"}, "template": "blue"},
            "elements": [{"tag": "div", "text": {"tag": "lark_md", "content": f"**{title}**\n{time_line}🔗 [查看详情]({url})"}}],
        },
    }
    try:
        resp = httpx.post(webhook_url, json=card, timeout=10)
        return resp.json().get("code") == 0
    except Exception:
        return False


# ── 爬取 ──
def crawl_source(source: dict, ua_index: int) -> tuple[int, int]:
    headers = {**HEADERS_TEMPLATE, "User-Agent": USER_AGENTS[ua_index % len(USER_AGENTS)]}

    try:
        resp = httpx.get(source["url"], headers=headers, timeout=15, follow_redirects=True)
        resp.encoding = resp.encoding or "utf-8"
        html = resp.text
    except Exception as e:
        print(f"  [ERROR] 请求失败: {e}")
        return 0, 0

    soup = BeautifulSoup(html, "lxml")
    items: list[Tag] = soup.select(source["list_selector"])
    if not items:
        print(f"  [WARN] 选择器无匹配")
        return 0, 0

    # 确定 webhook：源级别 > 空间级别 > 全局默认
    webhook = source.get("webhook_url") or source.get("default_webhook") or DEFAULT_WEBHOOK

    new_count = 0
    notified = 0

    for item in items:
        title_el = item.select_one(source["title_selector"])
        link_el = item.select_one(source["link_selector"])
        if not title_el or not link_el:
            continue
        title = title_el.get_text(strip=True)
        href = link_el.get("href", "")
        if not title or not href:
            continue
        full_url = urljoin(source["url"], href)

        time_el = item.select_one(source["time_selector"]) if source.get("time_selector") else None
        time_str = time_el.get_text(strip=True) if time_el else None
        published_at = parse_time(time_str)

        content_hash = make_hash(title, full_url)
        existing = turso_query("SELECT id FROM notices WHERE content_hash = ?", [content_hash])
        if existing:
            continue

        import uuid
        notice_id = str(uuid.uuid4())
        ws_id = source["workspace_id"]
        turso_execute(
            "INSERT INTO notices (id, workspace_id, source_id, title, url, content_hash, published_at, raw_data) VALUES (?,?,?,?,?,?,?,?)",
            [notice_id, ws_id, source["id"], title, full_url, content_hash, published_at,
             json.dumps({"title": title, "url": full_url, "time": time_str}, ensure_ascii=False)],
        )
        new_count += 1

        success = send_feishu(webhook, source["name"], title, full_url, published_at)
        if success:
            notified += 1

        turso_execute(
            "INSERT INTO notification_logs (id, workspace_id, notice_id, channel, status, error_msg) VALUES (?,?,?,'feishu',?,?)",
            [str(uuid.uuid4()), ws_id, notice_id, "success" if success else "failed", None if success else "发送失败"],
        )

    turso_execute("UPDATE sources SET last_crawled_at = ? WHERE id = ?",
                  [datetime.now(timezone.utc).isoformat(), source["id"]])
    return new_count, notified


# ── 主入口 ──
def main():
    print("=" * 50)
    print(f"通知助手 多人版 — {datetime.now(timezone.utc).isoformat()}")
    print("=" * 50)

    init_tables()

    # 读取所有启用的源，JOIN workspace 获取默认 webhook
    sources = turso_query("""
        SELECT s.*, w.default_webhook
        FROM sources s
        LEFT JOIN workspaces w ON s.workspace_id = w.id
        WHERE s.is_active = 1
    """)
    print(f"活跃源: {len(sources)} 个\n")

    total_new = 0
    total_notified = 0

    for i, src in enumerate(sources):
        print(f"[{i+1}/{len(sources)}] {src['name']}")
        new, notified = crawl_source(src, i)
        print(f"  → 新增 {new} 条, 推送 {notified} 条")
        total_new += new
        total_notified += notified

    print(f"\n总计: 新增 {total_new} 条, 推送 {total_notified} 条")

    if "GITHUB_STEP_SUMMARY" in os.environ:
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(f"## 爬取结果\n| 源 | 新增 | 推送 |\n|----|------|------|\n")
            f.write(f"| {len(sources)} 个 | {total_new} | {total_notified} |\n")


if __name__ == "__main__":
    main()
