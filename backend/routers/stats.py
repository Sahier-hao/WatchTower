"""统计数据 API。"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Source, Notice, NotificationLog

router = APIRouter(prefix="/stats", tags=["统计"])


class StatsResponse(BaseModel):
    source_count: int
    active_source_count: int
    notice_total: int
    today_new: int
    push_success_rate: float  # 0-100


@router.get("", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    """获取仪表盘统计数据。"""
    # 来源统计
    total_src = await db.scalar(select(func.count(Source.id)))
    active_src = await db.scalar(
        select(func.count(Source.id)).where(Source.is_active == True)
    )

    # 通知总数
    total_notice = await db.scalar(select(func.count(Notice.id)))

    # 今日新增
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_new = await db.scalar(
        select(func.count(Notice.id)).where(Notice.first_seen_at >= today_start)
    )

    # 推送成功率
    total_logs = await db.scalar(select(func.count(NotificationLog.id)))
    success_logs = await db.scalar(
        select(func.count(NotificationLog.id)).where(NotificationLog.status == "success")
    )
    push_rate = (success_logs / total_logs * 100) if total_logs else 100.0

    return StatsResponse(
        source_count=total_src or 0,
        active_source_count=active_src or 0,
        notice_total=total_notice or 0,
        today_new=today_new or 0,
        push_success_rate=round(push_rate, 1),
    )
