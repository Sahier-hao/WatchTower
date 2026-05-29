"""爬虫引擎 — 基于 CSS 选择器的网页内容提取。

核心流程：
1. httpx 请求目标 URL
2. BeautifulSoup 解析 HTML
3. 用配置的选择器提取通知列表
4. SHA256 哈希去重
5. 返回新发现的通知列表
"""

import hashlib
from datetime import datetime, timezone
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, Tag
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Notice, Source

# 常用 User-Agent 池
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]

HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Cache-Control": "max-age=0",
    "Connection": "keep-alive",
}


def make_hash(title: str, url: str) -> str:
    """根据标题和链接计算 SHA256 哈希值。"""
    return hashlib.sha256(f"{title.strip()}|{url.strip()}".encode()).hexdigest()


class CrawlerService:
    """爬虫服务。"""

    def __init__(self, user_agent_index: int = 0):
        self._ua_index = user_agent_index

    def _rotate_ua(self):
        """轮换 User-Agent。"""
        self._ua_index = (self._ua_index + 1) % len(USER_AGENTS)

    async def crawl(self, source: Source, db: AsyncSession) -> list[Notice]:
        """对单个爬取源执行一次爬取，返回新发现的通知列表。"""
        headers = {**HEADERS, "User-Agent": USER_AGENTS[self._ua_index]}
        self._rotate_ua()

        # 1. 请求页面
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(source.url, headers=headers)
                resp.encoding = resp.encoding or "utf-8"
                html = resp.text
        except httpx.TimeoutException:
            print(f"[Crawler] 请求超时: {source.url}")
            return []
        except Exception as e:
            print(f"[Crawler] 请求失败: {source.url} — {e}")
            return []

        # 2. 解析 HTML
        soup = BeautifulSoup(html, "lxml")
        items: list[Tag] = soup.select(source.list_selector)

        if not items:
            print(f"[Crawler] 选择器无匹配: {source.list_selector} @ {source.url}")
            return []

        new_notices: list[Notice] = []

        for item in items:
            # 3. 提取标题、链接、时间
            title_el = item.select_one(source.title_selector)
            link_el = item.select_one(source.link_selector)
            time_el = item.select_one(source.time_selector) if source.time_selector else None

            if not title_el or not link_el:
                continue

            title = title_el.get_text(strip=True)
            href = link_el.get("href", "")
            if not title or not href:
                continue

            # 处理相对链接 → 绝对链接
            full_url = urljoin(source.url, href)

            time_str = time_el.get_text(strip=True) if time_el else None
            published_at = self._parse_time(time_str)

            # 4. 去重检查
            content_hash = make_hash(title, full_url)
            existing = await db.scalar(
                select(Notice).where(Notice.content_hash == content_hash)
            )
            if existing:
                continue  # 已存在，跳过

            # 5. 创建通知记录
            notice = Notice(
                source_id=source.id,
                title=title,
                url=full_url,
                content_hash=content_hash,
                published_at=published_at,
                raw_data={"title": title, "url": full_url, "time": time_str},
            )
            db.add(notice)
            new_notices.append(notice)

        # 6. 更新爬取时间
        source.last_crawled_at = datetime.now(timezone.utc)
        await db.flush()

        return new_notices

    def _parse_time(self, time_str: str | None) -> datetime | None:
        """尝试解析常见时间格式，返回 UTC datetime 或 None。

        支持格式：
        - 标准格式：2026-05-29, 2026/05/29, 2026年05月29日, 05-29
        - 粘连格式：202605-29 (年+月-日粘在一起), 04-242026 (月日+年)
        """
        if not time_str:
            return None

        import re
        from datetime import timezone as tz

        text = time_str.strip()

        formats = [
            "%Y-%m-%d",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d",
            "%Y/%m/%d %H:%M",
            "%Y年%m月%d日",
            "%m-%d",
            "%m月%d日",
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(text, fmt)
                if dt.year == 1900:
                    dt = dt.replace(year=datetime.now().year)
                return dt.replace(tzinfo=tz.utc)
            except ValueError:
                continue

        # ── 兜底：正则修复粘连格式 ──
        # 模式1: "202605-29" → 年+月-日粘在一起，年份在前
        m = re.match(r"^(\d{4})(\d{2}-\d{2})$", text)
        if m:
            try:
                dt = datetime.strptime(f"{m.group(1)}-{m.group(2)}", "%Y-%m-%d")
                return dt.replace(tzinfo=tz.utc)
            except ValueError:
                pass

        # 模式2: "04-242026" → 月日+年，年份在后
        m = re.match(r"^(\d{2}-\d{2})(\d{4})$", text)
        if m:
            try:
                dt = datetime.strptime(f"{m.group(2)}-{m.group(1)}", "%Y-%m-%d")
                return dt.replace(tzinfo=tz.utc)
            except ValueError:
                pass

        # 模式3: 通用提取纯数字，尝试拼接
        digits = re.findall(r"\d+", text)
        if len(digits) >= 3:
            # 尝试 年-月-日 顺序
            for y_idx, m_idx, d_idx in [(0, 1, 2), (2, 0, 1)]:
                try:
                    y, m, d = digits[y_idx], digits[m_idx], digits[d_idx]
                    if len(y) == 4 and len(m) <= 2 and len(d) <= 2:
                        dt = datetime(int(y), int(m), int(d))
                        return dt.replace(tzinfo=tz.utc)
                except (ValueError, IndexError):
                    continue

        return None


# 全局单例
crawler_service = CrawlerService()
