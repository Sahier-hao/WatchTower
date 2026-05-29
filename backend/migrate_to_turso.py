"""
将本地 SQLite 中的数据迁移到 Turso（多人版，需指定 workspace ID）。

用法：
  set TURSO_URL=libsql://xxx.turso.io
  set TURSO_TOKEN=your_token
  set WS_ID=你的空间ID      （自己起一个，比如 sherlock）
  set WS_NAME=我的空间       （可选）
  python migrate_to_turso.py
"""

import json
import os
import sqlite3

import httpx

_raw_url = os.environ["TURSO_URL"]
_raw_url = _raw_url.replace("libsql://", "https://")
# libsql 格式: db-org.location.turso.io → HTTP 格式: db-org.turso.io
_parts = _raw_url.split("/")
_host_parts = _parts[2].split(".")
if len(_host_parts) >= 4:
    _host_parts.pop(-3)  # 去掉 location 部分
    _parts[2] = ".".join(_host_parts)
TURSO_URL = "/".join(_parts)
TURSO_TOKEN = os.environ["TURSO_TOKEN"]
WS_ID = os.environ.get("WS_ID", "default")
WS_NAME = os.environ.get("WS_NAME", "我的空间")
LOCAL_DB = "data/notification.db"


def _typed_args(params: list | None) -> list:
    """将 Python 值转为 Turso 带类型的参数格式。"""
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

def turso_execute(sql: str, params: list | None = None):
    payload = {
        "requests": [
            {"type": "execute", "stmt": {"sql": sql, "args": _typed_args(params)}},
            {"type": "close"},
        ]
    }
    resp = httpx.post(
        f"{TURSO_URL}/v2/pipeline",
        headers={
            "Authorization": f"Bearer {TURSO_TOKEN}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"[DEBUG] URL: {TURSO_URL}/v2/pipeline")
        print(f"[DEBUG] Status: {resp.status_code}")
        print(f"[DEBUG] Response: {resp.text[:500]}")
    resp.raise_for_status()
    return resp.json()


def main():
    # 1. 创建 workspace + 表
    print(f"创建空间: {WS_ID} ({WS_NAME})")
    turso_execute("""
        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY, name TEXT DEFAULT '', default_webhook TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    turso_execute("INSERT OR IGNORE INTO workspaces (id, name) VALUES (?, ?)", [WS_ID, WS_NAME])

    turso_execute("""
        CREATE TABLE IF NOT EXISTS sources (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
            name TEXT NOT NULL, url TEXT NOT NULL,
            list_selector TEXT NOT NULL, title_selector TEXT NOT NULL,
            link_selector TEXT NOT NULL, time_selector TEXT, webhook_url TEXT DEFAULT '',
            crawl_interval INTEGER DEFAULT 30, is_active INTEGER DEFAULT 1,
            last_crawled_at TEXT, created_at TEXT, updated_at TEXT
        )
    """)
    turso_execute("""
        CREATE TABLE IF NOT EXISTS notices (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
            source_id TEXT NOT NULL, title TEXT NOT NULL,
            url TEXT NOT NULL, content_hash TEXT NOT NULL,
            published_at TEXT, first_seen_at TEXT, raw_data TEXT
        )
    """)
    turso_execute("""
        CREATE TABLE IF NOT EXISTS notification_logs (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
            notice_id TEXT NOT NULL, channel TEXT DEFAULT 'feishu',
            status TEXT NOT NULL, error_msg TEXT, sent_at TEXT
        )
    """)
    turso_execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_notices_hash ON notices(content_hash)")
    print("表创建完成\n")

    # 2. 读取本地 SQLite
    local = sqlite3.connect(LOCAL_DB)
    local.row_factory = sqlite3.Row

    sources = local.execute("SELECT * FROM sources").fetchall()
    print(f"本地源: {len(sources)} 个")

    # 3. 迁移源
    for s in sources:
        s_dict = dict(s)
        try:
            turso_execute(
                """INSERT OR REPLACE INTO sources
                   (id, workspace_id, name, url, list_selector, title_selector, link_selector,
                    time_selector, crawl_interval, is_active, last_crawled_at, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                [s_dict["id"], WS_ID, s_dict["name"], s_dict["url"],
                 s_dict["list_selector"], s_dict["title_selector"], s_dict["link_selector"],
                 s_dict.get("time_selector"), s_dict.get("crawl_interval", 30),
                 1 if s_dict.get("is_active") else 0, s_dict.get("last_crawled_at"),
                 s_dict.get("created_at"), s_dict.get("updated_at")],
            )
            print(f"  ✅ {s_dict['name']}")
        except Exception as e:
            print(f"  ❌ {s_dict['name']}: {e}")

    # 4. 迁移通知（可选，历史数据量大时跳过）
    skip_notices = os.environ.get("SKIP_NOTICES", "1") == "1"
    if skip_notices:
        print(f"\n跳过历史通知迁移（源迁移完成即可，新通知由爬虫自动抓取）")
        print("如需迁移历史通知: set SKIP_NOTICES=0 再跑一次")
    else:
        notices = local.execute("SELECT * FROM notices").fetchall()
        print(f"\n本地通知: {len(notices)} 条（可能较慢，请耐心等待...）")
        migrated_notes = 0
        for n in notices:
            n_dict = dict(n)
            try:
                turso_execute(
                    """INSERT OR REPLACE INTO notices
                       (id, workspace_id, source_id, title, url, content_hash, published_at, first_seen_at, raw_data)
                       VALUES (?,?,?,?,?,?,?,?,?)""",
                    [n_dict["id"], WS_ID, n_dict["source_id"], n_dict["title"],
                     n_dict["url"], n_dict["content_hash"], n_dict.get("published_at"),
                     n_dict.get("first_seen_at"), n_dict.get("raw_data")],
                )
                migrated_notes += 1
            except Exception:
                pass
        print(f"成功迁移 {migrated_notes} 条通知")

    local.close()
    print("\n🎉 迁移完成！")


if __name__ == "__main__":
    main()
