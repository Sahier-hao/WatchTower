"""爬取源管理 API。"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Source, Notice
from schemas.source import SourceCreate, SourceUpdate, SourceResponse, SourceListResponse
from services.crawler import crawler_service
from services.scheduler import scheduler_service

router = APIRouter(prefix="/sources", tags=["爬取源"])


@router.get("", response_model=SourceListResponse)
async def list_sources(
    skip: int = Query(0, ge=0, description="跳过条数"),
    limit: int = Query(20, ge=1, le=100, description="返回条数"),
    db: AsyncSession = Depends(get_db),
):
    """获取爬取源分页列表。"""
    # 总数
    total_result = await db.execute(select(func.count(Source.id)))
    total = total_result.scalar() or 0

    # 分页数据
    result = await db.execute(
        select(Source).order_by(Source.created_at.desc()).offset(skip).limit(limit)
    )
    sources = result.scalars().all()

    items = []
    for s in sources:
        cnt_result = await db.execute(
            select(func.count(Notice.id)).where(Notice.source_id == s.id)
        )
        notice_count = cnt_result.scalar() or 0
        items.append(SourceResponse(
            id=s.id,
            name=s.name,
            url=s.url,
            list_selector=s.list_selector,
            title_selector=s.title_selector,
            link_selector=s.link_selector,
            time_selector=s.time_selector,
            crawl_interval=s.crawl_interval,
            is_active=s.is_active,
            last_crawled_at=s.last_crawled_at,
            created_at=s.created_at,
            updated_at=s.updated_at,
            notice_count=notice_count,
        ))

    return SourceListResponse(items=items, total=total)


@router.post("", response_model=SourceResponse, status_code=201)
async def create_source(body: SourceCreate, db: AsyncSession = Depends(get_db)):
    """创建新爬取源。"""
    source = Source(
        name=body.name,
        url=body.url,
        list_selector=body.list_selector,
        title_selector=body.title_selector,
        link_selector=body.link_selector,
        time_selector=body.time_selector,
        crawl_interval=body.crawl_interval,
        is_active=body.is_active,
    )
    db.add(source)
    await db.flush()

    # 注册调度任务
    scheduler_service.update_job(source)

    return SourceResponse(
        id=source.id,
        name=source.name,
        url=source.url,
        list_selector=source.list_selector,
        title_selector=source.title_selector,
        link_selector=source.link_selector,
        time_selector=source.time_selector,
        crawl_interval=source.crawl_interval,
        is_active=source.is_active,
        last_crawled_at=source.last_crawled_at,
        created_at=source.created_at,
        updated_at=source.updated_at,
        notice_count=0,
    )


@router.get("/{source_id}", response_model=SourceResponse)
async def get_source(source_id: str, db: AsyncSession = Depends(get_db)):
    """获取单个爬取源详情。"""
    source = await db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="爬取源不存在")

    cnt_result = await db.execute(
        select(func.count(Notice.id)).where(Notice.source_id == source.id)
    )
    notice_count = cnt_result.scalar() or 0

    return SourceResponse(
        id=source.id,
        name=source.name,
        url=source.url,
        list_selector=source.list_selector,
        title_selector=source.title_selector,
        link_selector=source.link_selector,
        time_selector=source.time_selector,
        crawl_interval=source.crawl_interval,
        is_active=source.is_active,
        last_crawled_at=source.last_crawled_at,
        created_at=source.created_at,
        updated_at=source.updated_at,
        notice_count=notice_count,
    )


@router.put("/{source_id}", response_model=SourceResponse)
async def update_source(source_id: str, body: SourceUpdate, db: AsyncSession = Depends(get_db)):
    """更新爬取源配置。"""
    source = await db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="爬取源不存在")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(source, key, value)

    await db.flush()

    # 更新调度任务
    scheduler_service.update_job(source)

    cnt_result = await db.execute(
        select(func.count(Notice.id)).where(Notice.source_id == source.id)
    )
    notice_count = cnt_result.scalar() or 0

    return SourceResponse(
        id=source.id,
        name=source.name,
        url=source.url,
        list_selector=source.list_selector,
        title_selector=source.title_selector,
        link_selector=source.link_selector,
        time_selector=source.time_selector,
        crawl_interval=source.crawl_interval,
        is_active=source.is_active,
        last_crawled_at=source.last_crawled_at,
        created_at=source.created_at,
        updated_at=source.updated_at,
        notice_count=notice_count,
    )


@router.delete("/{source_id}", status_code=204)
async def delete_source(source_id: str, db: AsyncSession = Depends(get_db)):
    """删除爬取源。"""
    source = await db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="爬取源不存在")

    scheduler_service.remove_job(source.id)
    await db.delete(source)
    await db.flush()


@router.post("/{source_id}/test")
async def test_source(source_id: str, db: AsyncSession = Depends(get_db)):
    """手动测试爬取 — 返回解析出的数据预览（不写入数据库，不触发通知）。"""
    source = await db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="爬取源不存在")

    # 临时复制一个 source 用于测试
    import copy
    import httpx
    from urllib.parse import urljoin
    from bs4 import BeautifulSoup, Tag

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(source.url, headers=headers)
            resp.encoding = resp.encoding or "utf-8"
            html = resp.text
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="请求超时")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"请求失败: {str(e)}")

    soup = BeautifulSoup(html, "lxml")
    items: list[Tag] = soup.select(source.list_selector)

    if not items:
        return {
            "status": "warning",
            "message": f"选择器 '{source.list_selector}' 未匹配到任何元素",
            "items": [],
            "item_count": 0,
        }

    results = []
    for item in items[:20]:  # 最多返回 20 条预览
        title_el = item.select_one(source.title_selector)
        link_el = item.select_one(source.link_selector)
        time_el = item.select_one(source.time_selector) if source.time_selector else None

        href = link_el.get("href", "") if link_el else ""
        full_url = urljoin(source.url, href) if href else ""

        results.append({
            "title": title_el.get_text(strip=True) if title_el else "(未提取到)",
            "url": full_url,
            "time": time_el.get_text(strip=True) if time_el else None,
        })

    return {
        "status": "success",
        "message": f"成功匹配 {len(items)} 个列表项，展示前 {len(results)} 条",
        "items": results,
        "item_count": len(items),
    }


@router.post("/{source_id}/crawl")
async def manual_crawl(source_id: str, db: AsyncSession = Depends(get_db)):
    """手动触发一次爬取（会写入数据库并触发通知）。"""
    source = await db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="爬取源不存在")

    new_notices = await crawler_service.crawl(source, db)

    # 发送通知 + 记录日志
    from services.notifier import NoticeData, notifier_service
    from models import NotificationLog

    notified = 0
    for notice in new_notices:
        success = await notifier_service.send(
            "feishu",
            NoticeData(
                source_name=source.name,
                title=notice.title,
                url=notice.url,
                published_at=(
                    notice.published_at.strftime("%Y-%m-%d %H:%M")
                    if notice.published_at
                    else ""
                ),
            ),
        )
        if success:
            notified += 1
        db.add(NotificationLog(
            notice_id=notice.id,
            channel="feishu",
            status="success" if success else "failed",
            error_msg=None if success else "Webhook 发送失败",
        ))

    await db.flush()

    return {
        "status": "success",
        "new_count": len(new_notices),
        "notified": notified,
        "items": [
            {
                "id": n.id,
                "title": n.title,
                "url": n.url,
                "published_at": n.published_at.isoformat() if n.published_at else None,
            }
            for n in new_notices
        ],
    }
