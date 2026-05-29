"""通知列表 API。"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Notice, Source
from schemas.notice import NoticeResponse, NoticeListResponse

router = APIRouter(prefix="/notices", tags=["通知"])


@router.get("", response_model=NoticeListResponse)
async def list_notices(
    skip: int = Query(0, ge=0, description="跳过条数"),
    limit: int = Query(20, ge=1, le=100, description="返回条数"),
    source_id: str | None = Query(None, description="按来源筛选"),
    db: AsyncSession = Depends(get_db),
):
    """获取通知分页列表，支持按来源筛选。"""
    query = select(Notice)
    count_query = select(func.count(Notice.id))

    if source_id:
        query = query.where(Notice.source_id == source_id)
        count_query = count_query.where(Notice.source_id == source_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(
        query.order_by(Notice.first_seen_at.desc()).offset(skip).limit(limit)
    )
    notices = result.scalars().all()

    # 批量获取来源名称
    source_ids = list({n.source_id for n in notices})
    source_map: dict[str, str] = {}
    if source_ids:
        src_result = await db.execute(select(Source.id, Source.name).where(Source.id.in_(source_ids)))
        source_map = {row[0]: row[1] for row in src_result}

    items = [
        NoticeResponse(
            id=n.id,
            source_id=n.source_id,
            source_name=source_map.get(n.source_id, "已删除"),
            title=n.title,
            url=n.url,
            published_at=n.published_at,
            first_seen_at=n.first_seen_at,
        )
        for n in notices
    ]

    return NoticeListResponse(items=items, total=total)
