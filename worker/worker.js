/**
 * Cloudflare Worker — 通知助手 API (多人版)
 *
 * 每个用户有一个 workspace ID（随机 UUID），通过 URL 区分：
 *   /api/:workspace/sources
 *   /api/:workspace/notices
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Turso API ──
function tursoUrl(env) {
  let url = (env.TURSO_URL || "").replace("libsql://", "https://");
  // libsql 格式: db-org.location.turso.io → HTTP: db-org.turso.io
  let parts = url.split("/");
  let hostParts = parts[2].split(".");
  if (hostParts.length >= 4) {
    hostParts.splice(hostParts.length - 3, 1);
    parts[2] = hostParts.join(".");
  }
  return parts.join("/");
}

function parseTime(str) {
  if (!str) return null;
  str = str.trim();
  // 标准格式
  const r = matchFmt(str);
  if (r) return r;
  // 粘连: 202605-29
  let m = str.match(/^(\d{4})(\d{2}-\d{2})$/);
  if (m) { const d = new Date(`${m[1]}-${m[2]}`); if (!isNaN(d)) return d.toISOString(); }
  // 粘连: 04-242026
  m = str.match(/^(\d{2}-\d{2})(\d{4})$/);
  if (m) { const d = new Date(`${m[2]}-${m[1]}`); if (!isNaN(d)) return d.toISOString(); }
  return null;
}

function matchFmt(str) {
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const d = new Date(m[0]); return !isNaN(d.getTime()) ? d.toISOString() : null; }
  m = str.match(/^(\d{2})-(\d{2})/);
  if (m) { const d = new Date(`${new Date().getFullYear()}-${m[1]}-${m[2]}`); return !isNaN(d.getTime()) ? d.toISOString() : null; }
  return null;
}

async function matchTime(html, selector) {
  // Simple regex to find date-like patterns near the selector pattern
  const datePattern = /(\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{2}-\d{2})/g;
  const matches = html.match(datePattern);
  return matches ? matches[matches.length - 1] : null;
}

function typedArgs(params = []) {
  return params.map(v => {
    if (v === null || v === undefined) return { type: "null" };
    if (typeof v === "number") return { type: "integer", value: String(v) };
    return { type: "text", value: String(v) };
  });
}

async function tursoQuery(env, sql, params = []) {
  const resp = await fetch(`${tursoUrl(env)}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.TURSO_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [
      { type: "execute", stmt: { sql, args: typedArgs(params) } },
      { type: "close" },
    ]}),
  });
  const data = await resp.json();
  const rows = [];
  for (const r of data.results || []) {
    if (r.type === "ok" && r.response?.type === "execute") {
      const cols = (r.response.result.cols || []).map(c => c.name);
      for (const row of r.response.result.rows || []) {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]?.value ?? null);
        rows.push(obj);
      }
    }
  }
  return rows;
}

async function tursoExecute(env, sql, params = []) {
  const resp = await fetch(`${tursoUrl(env)}/v2/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.TURSO_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [
      { type: "execute", stmt: { sql, args: typedArgs(params) } },
      { type: "close" },
    ]}),
  });
  const data = await resp.json();
  for (const r of data.results || []) {
    if (r.type === "ok" && r.response?.type === "execute") {
      return r.response.result?.affected_row_count ?? 0;
    }
  }
  return 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── 初始化表 ──
async function ensureTables(env) {
  await tursoExecute(env, `CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT DEFAULT '', default_webhook TEXT DEFAULT '', admin_token TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))`);
  await tursoExecute(env, `CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, url TEXT NOT NULL, list_selector TEXT NOT NULL, title_selector TEXT NOT NULL, link_selector TEXT NOT NULL, time_selector TEXT, webhook_url TEXT DEFAULT '', crawl_interval INTEGER DEFAULT 30, is_active INTEGER DEFAULT 1, last_crawled_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
  await tursoExecute(env, `CREATE TABLE IF NOT EXISTS notices (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, source_id TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, content_hash TEXT NOT NULL, published_at TEXT, first_seen_at TEXT DEFAULT (datetime('now')), raw_data TEXT)`);
  await tursoExecute(env, `CREATE TABLE IF NOT EXISTS notification_logs (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, notice_id TEXT NOT NULL, channel TEXT DEFAULT 'feishu', status TEXT NOT NULL, error_msg TEXT, sent_at TEXT DEFAULT (datetime('now')))`);
  await tursoExecute(env, `CREATE TABLE IF NOT EXISTS workspace_webhooks (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_token TEXT NOT NULL, webhook_url TEXT NOT NULL, label TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))`);
  await tursoExecute(env, `CREATE UNIQUE INDEX IF NOT EXISTS idx_notices_hash ON notices(content_hash)`);
  await tursoExecute(env, `CREATE INDEX IF NOT EXISTS idx_notices_ws ON notices(workspace_id)`);
  await tursoExecute(env, `CREATE TABLE IF NOT EXISTS crawl_runs (id TEXT PRIMARY KEY, workspace_id TEXT DEFAULT '', source_count INTEGER DEFAULT 0, new_count INTEGER DEFAULT 0, notified_count INTEGER DEFAULT 0, status TEXT DEFAULT 'ok', error_msg TEXT, started_at TEXT, finished_at TEXT DEFAULT (datetime('now')))`);
  await tursoExecute(env, `CREATE INDEX IF NOT EXISTS idx_sources_ws ON sources(workspace_id)`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      await ensureTables(env);

      // 解析路径: /api/:workspace/...
      const parts = url.pathname.replace(/^\/api\//, "").split("/");
      const ws = parts[0];               // workspace ID
      const resource = parts[1] || "";   // "sources" | "notices" | "stats" | "settings" | "workspaces"
      const subId = parts[2] || "";      // source ID or action
      const action = parts[3] || "";     // "test" | "crawl"

      // ── workspace 创建 / 查询 / 权限 ──
      if (resource === "workspaces" && !subId && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const wsId = body.id || crypto.randomUUID();
        const wsName = body.name || "我的空间";
        const adminToken = body.admin_token || crypto.randomUUID();
        await tursoExecute(env,
          "INSERT OR IGNORE INTO workspaces (id, name, admin_token) VALUES (?, ?, ?)", [wsId, wsName, adminToken]
        );
        if (body.default_webhook) {
          await tursoExecute(env, "UPDATE workspaces SET default_webhook = ? WHERE id = ?", [body.default_webhook, wsId]);
        }
        const ws = await tursoQuery(env, "SELECT * FROM workspaces WHERE id = ?", [wsId]);
        return json({ ...ws[0], admin_token: adminToken }, 201);
      }

      // ── health ──
      if (!ws || ws === "health") {
        return json({ status: "ok", version: "2.0-multi" });
      }

      // 验证 workspace + 获取用户 token
      const userToken = url.searchParams.get("token") || "";
      let wsData = await tursoQuery(env, "SELECT * FROM workspaces WHERE id = ?", [ws]);
      if (!wsData.length) {
        const newAdminToken = crypto.randomUUID();
        await tursoExecute(env, "INSERT INTO workspaces (id, name, admin_token) VALUES (?, '新空间', ?)", [ws, newAdminToken]);
        wsData = [{ id: ws, name: "新空间", default_webhook: "", admin_token: newAdminToken }];
      }
      // 如果旧空间没有 admin_token，把当前用户设为管理员
      if (!wsData[0].admin_token && userToken) {
        await tursoExecute(env, "UPDATE workspaces SET admin_token = ? WHERE id = ?", [userToken, ws]);
        wsData[0].admin_token = userToken;
      }
      const isAdmin = wsData[0].admin_token && userToken === wsData[0].admin_token;

      // ── GET /stats ──
      if (resource === "stats") {
        const sResults = await Promise.all([
            tursoQuery(env, "SELECT COUNT(*) as c FROM sources WHERE workspace_id = ?", [ws]),
            tursoQuery(env, "SELECT COUNT(*) as c FROM sources WHERE workspace_id = ? AND is_active = 1", [ws]),
            tursoQuery(env, "SELECT COUNT(*) as c FROM notices WHERE workspace_id = ?", [ws]),
            tursoQuery(env, "SELECT COUNT(*) as c FROM notices WHERE workspace_id = ? AND first_seen_at >= date('now')", [ws]),
            tursoQuery(env, "SELECT COUNT(*) as c FROM notification_logs WHERE workspace_id = ?", [ws]),
            tursoQuery(env, "SELECT COUNT(*) as c FROM notification_logs WHERE workspace_id = ? AND status = 'success'", [ws]),
          ]);
        const sc = sResults[0]?.[0]?.c || 0;
        const ac = sResults[1]?.[0]?.c || 0;
        const nc = sResults[2]?.[0]?.c || 0;
        const td = sResults[3]?.[0]?.c || 0;
        const tl = sResults[4]?.[0]?.c || 0;
        const sl = sResults[5]?.[0]?.c || 0;
        return json({
          source_count: sc,
          active_source_count: ac,
          notice_total: nc,
          today_new: td,
          push_success_rate: tl ? Math.round((sl / tl) * 1000) / 10 : 100,
          is_admin: isAdmin,
          workspace_name: wsData?.[0]?.name || "",
          default_webhook: wsData?.[0]?.default_webhook || "",
        });
      }

      // ── 个人 Webhook 管理 ──
      if (resource === "webhooks") {
        const userToken = url.searchParams.get("token") || "anonymous";
        if (method === "GET") {
          const hooks = await tursoQuery(env,
            "SELECT * FROM workspace_webhooks WHERE workspace_id = ? AND user_token = ?", [ws, userToken]
          );
          return json({ items: hooks });
        }
        if (method === "POST") {
          const body = await request.json();
          const hookId = crypto.randomUUID();
          await tursoExecute(env,
            "INSERT INTO workspace_webhooks (id, workspace_id, user_token, webhook_url, label) VALUES (?,?,?,?,?)",
            [hookId, ws, userToken, body.webhook_url, body.label || ""]
          );
          return json({ id: hookId }, 201);
        }
        if (method === "DELETE" && subId) {
          await tursoExecute(env,
            "DELETE FROM workspace_webhooks WHERE id = ? AND workspace_id = ? AND user_token = ?",
            [subId, ws, userToken]
          );
          return new Response(null, { status: 204, headers: CORS_HEADERS });
        }
      }

      // ── GET/PUT /settings ──
      if (resource === "settings") {
        if (method === "GET") {
          return json({
            default_webhook: wsData[0].default_webhook || "",
            workspace_name: wsData[0].name || "",
            default_crawl_interval: 30,
          });
        }
        if (method === "PUT") {
          const body = await request.json();
          if (body.default_webhook !== undefined) {
            await tursoExecute(env, "UPDATE workspaces SET default_webhook = ? WHERE id = ?", [body.default_webhook, ws]);
          }
          if (body.workspace_name !== undefined) {
            await tursoExecute(env, "UPDATE workspaces SET name = ? WHERE id = ?", [body.workspace_name, ws]);
          }
          const updated = await tursoQuery(env, "SELECT * FROM workspaces WHERE id = ?", [ws]);
          return json({
            default_webhook: updated[0].default_webhook || "",
            workspace_name: updated[0].name || "",
            default_crawl_interval: 30,
          });
        }
      }

      // ── GET /sources ──
      if (resource === "sources" && !subId) {
        if (method === "GET") {
          const skip = parseInt(url.searchParams.get("skip") || "0");
          const limit = parseInt(url.searchParams.get("limit") || "50");
          const sources = await tursoQuery(env,
            "SELECT * FROM sources WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [ws, limit, skip]
          );
          const [[total]] = await Promise.all([
            tursoQuery(env, "SELECT COUNT(*) as c FROM sources WHERE workspace_id = ?", [ws]),
          ]);
          for (const s of sources) {
            const [[cnt]] = await Promise.all([
              tursoQuery(env, "SELECT COUNT(*) as c FROM notices WHERE source_id = ?", [s.id]),
            ]);
            s.notice_count = cnt?.c || 0;
          }
          return json({ items: sources, total: total?.c || 0 });
        }
        // POST /sources
        if (method === "POST") {
          if (!isAdmin) return json({ detail: "仅管理员可操作" }, 403);
          const body = await request.json();
          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          await tursoExecute(env,
            `INSERT INTO sources (id, workspace_id, name, url, list_selector, title_selector, link_selector,
             time_selector, webhook_url, crawl_interval, is_active, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, ws, body.name, body.url, body.list_selector, body.title_selector,
             body.link_selector, body.time_selector || null, body.webhook_url || "",
             body.crawl_interval || 30, body.is_active !== false ? 1 : 0, now, now]
          );
          const s = await tursoQuery(env, "SELECT * FROM sources WHERE id = ?", [id]);
          s[0].notice_count = 0;
          return json(s[0], 201);
        }
      }

      // ── /sources/:id ──
      if (resource === "sources" && subId) {
        // GET
        if (method === "GET" && !action) {
          const s = await tursoQuery(env, "SELECT * FROM sources WHERE id = ? AND workspace_id = ?", [subId, ws]);
          if (!s.length) return json({ detail: "不存在" }, 404);
          const [[cnt]] = await Promise.all([
            tursoQuery(env, "SELECT COUNT(*) as c FROM notices WHERE source_id = ?", [subId]),
          ]);
          s[0].notice_count = cnt?.c || 0;
          return json(s[0]);
        }

        // PUT
        if (method === "PUT" && !action) {
          if (!isAdmin) return json({ detail: "仅管理员可操作" }, 403);
          const body = await request.json();
          const existing = await tursoQuery(env, "SELECT * FROM sources WHERE id = ? AND workspace_id = ?", [subId, ws]);
          if (!existing.length) return json({ detail: "不存在" }, 404);
          const fields = ["name","url","list_selector","title_selector","link_selector",
                          "time_selector","webhook_url","crawl_interval","is_active"];
          for (const f of fields) {
            if (body[f] !== undefined) {
              const val = f === "is_active" ? (body[f] ? 1 : 0) : body[f];
              await tursoExecute(env, `UPDATE sources SET ${f} = ?, updated_at = ? WHERE id = ?`,
                [val, new Date().toISOString(), subId]);
            }
          }
          const s = await tursoQuery(env, "SELECT * FROM sources WHERE id = ?", [subId]);
          const [[cnt]] = await Promise.all([
            tursoQuery(env, "SELECT COUNT(*) as c FROM notices WHERE source_id = ?", [subId]),
          ]);
          s[0].notice_count = cnt?.c || 0;
          return json(s[0]);
        }

        // DELETE
        if (method === "DELETE") {
          if (!isAdmin) return json({ detail: "仅管理员可操作" }, 403);
          await tursoExecute(env, "DELETE FROM notification_logs WHERE notice_id IN (SELECT id FROM notices WHERE source_id = ?)", [subId]);
          await tursoExecute(env, "DELETE FROM notices WHERE source_id = ?", [subId]);
          await tursoExecute(env, "DELETE FROM sources WHERE id = ? AND workspace_id = ?", [subId, ws]);
          return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (action === "test" && method === "POST") {
          if (!isAdmin) return json({ detail: "仅管理员可操作" }, 403);
          const s = await tursoQuery(env, "SELECT * FROM sources WHERE id = ? AND workspace_id = ?", [subId, ws]);
          if (!s.length) return json({ detail: "不存在" }, 404);
          const src = s[0];
          try {
            const htmlResp = await fetch(src.url, {
              headers: { "User-Agent": "Mozilla/5.0 Chrome/131", "Accept": "text/html" },
              redirect: "follow",
            });
            const html = await htmlResp.text();

            // 匹配列表项数量
            const escaped = src.list_selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const listCount = (html.match(new RegExp(escaped.replace(/\s+/g, '\\s+'), 'gi')) || []).length;

            // 提取 title + link (正则: href="..." title="..." 或 href="...">content</a>)
            const items = [];
            const re = /<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>/gi;
            let m;
            while ((m = re.exec(html)) !== null && items.length < 20) {
              items.push({
                title: m[2],
                url: m[1].startsWith("http") ? m[1] : new URL(m[1], src.url).href,
                time: null,
              });
            }
            return json({
              status: items.length ? "success" : "warning",
              message: `匹配到约 ${listCount} 个列表项，提取 ${items.length} 条预览`,
              items,
              item_count: listCount || items.length,
            });
          } catch (e) {
            return json({ detail: `请求失败: ${e.message}` }, 502);
          }
        }

        // POST /sources/:id/crawl
        if (action === "crawl" && method === "POST") {
          if (!isAdmin) return json({ detail: "仅管理员可操作" }, 403);
          const s = await tursoQuery(env, "SELECT * FROM sources WHERE id = ? AND workspace_id = ?", [subId, ws]);
          if (!s.length) return json({ detail: "不存在" }, 404);
          const src = s[0];
          // 收集所有 webhook：源专属 + 空间默认 + 所有个人 webhook
          const allHooks = await tursoQuery(env,
            "SELECT webhook_url FROM workspace_webhooks WHERE workspace_id = ?", [ws]
          );
          const personalHooks = allHooks.map(h => h.webhook_url);
          const webhookRaw = [src.webhook_url, wsData[0].default_webhook, env.FEISHU_WEBHOOK, ...personalHooks]
            .filter(Boolean).join(",");
          const webhooks = webhookRaw.split(/[\n,]+/).map(w => w.trim()).filter(w => w.startsWith("http"));

          try {
            const htmlResp = await fetch(src.url, {
              headers: { "User-Agent": "Mozilla/5.0 Chrome/131", "Accept": "text/html" },
              redirect: "follow",
            });
            const html = await htmlResp.text();
            const textEncoder = new TextEncoder();

            const re = /<a[^>]*href="([^"]*)"[^>]*title="([^"]*)"[^>]*>/gi;
            let m;
            const newNotices = [];
            while ((m = re.exec(html)) !== null) {
              const href = m[1];
              const title = m[2].trim();
              if (!href || !title || title.length < 3) continue;
              const fullUrl = href.startsWith("http") ? href : new URL(href, src.url).href;
              const hashBuffer = await crypto.subtle.digest("SHA-256", textEncoder.encode(title + fullUrl));
              const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

              const existing = await tursoQuery(env, "SELECT id FROM notices WHERE content_hash = ?", [hash]);
              if (existing.length) continue;

              // 提取时间
              const timeEl = src.time_selector ? matchTime(html, src.time_selector) : null;
              const publishedAt = timeEl ? parseTime(timeEl) : null;

              const noticeId = crypto.randomUUID();
              await tursoExecute(env,
                "INSERT INTO notices (id, workspace_id, source_id, title, url, content_hash, published_at, first_seen_at) VALUES (?,?,?,?,?,?,?,?)",
                [noticeId, ws, src.id, title, fullUrl, hash, publishedAt, new Date().toISOString()]
              );
              newNotices.push({ id: noticeId, title, url: fullUrl });

              // 发飞书（支持多 webhook，换行或逗号分隔）
              for (const wh of webhooks) {
                const card = {
                  msg_type: "interactive",
                  card: {
                    header: { title: { tag: "plain_text", content: `🔔 新通知 — ${src.name}` }, template: "blue" },
                    elements: [{ tag: "div", text: { tag: "lark_md", content: `**${title}**\n🔗 [查看详情](${fullUrl})` } }],
                  },
                };
                await fetch(wh, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(card),
                });
              }
              await tursoExecute(env,
                "INSERT INTO notification_logs (id, workspace_id, notice_id, channel, status) VALUES (?,?,?,'feishu','success')",
                [crypto.randomUUID(), ws, noticeId]
              );
            }

            await tursoExecute(env, "UPDATE sources SET last_crawled_at = ? WHERE id = ?",
              [new Date().toISOString(), src.id]);

            return json({ status: "success", new_count: newNotices.length, notified: newNotices.length, items: newNotices });
          } catch (e) {
            return json({ detail: `爬取失败: ${e.message}` }, 500);
          }
        }
      }

      // ── GET /notices ──
      if (resource === "notices") {
        const skip = parseInt(url.searchParams.get("skip") || "0");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const sourceId = url.searchParams.get("source_id");

        let sql = "SELECT n.*, s.name as source_name FROM notices n LEFT JOIN sources s ON n.source_id = s.id WHERE n.workspace_id = ?";
        let countSql = "SELECT COUNT(*) as c FROM notices WHERE workspace_id = ?";
        const params = [ws];

        if (sourceId) {
          sql += " AND n.source_id = ?";
          countSql += " AND source_id = ?";
          params.push(sourceId);
        }
        sql += " ORDER BY COALESCE(n.published_at, n.first_seen_at) DESC LIMIT ? OFFSET ?";
        params.push(limit, skip);

        const notices = await tursoQuery(env, sql, params);
        const [[total]] = await Promise.all([
          tursoQuery(env, countSql, sourceId ? [ws, sourceId] : [ws]),
        ]);
        return json({ items: notices, total: total?.c || 0 });
      }

      // ── GET /runs (爬取日志) ──
      if (resource === "runs" && method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const runs = await tursoQuery(env,
          "SELECT * FROM crawl_runs WHERE workspace_id = ? OR workspace_id = '' ORDER BY finished_at DESC LIMIT ?",
          [ws, limit]
        );
        return json({ items: runs });
      }

      return json({ detail: "Not Found" }, 404);
    } catch (e) {
      return json({ detail: e.message }, 500);
    }
  },
};
