"""推送日志 API。"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import NotificationLog

router = APIRouter(prefix="/logs", tags=["推送日志"])


class LogResponse(BaseModel):
    id: str
    notice_id: str
    channel: str
    status: str
    error_msg: str | None
    sent_at: str

    model_config = {"from_attributes": True}


class LogListResponse(BaseModel):
    items: list[LogResponse]
    total: int


@router.get("", response_model=LogListResponse)
async def list_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取推送日志分页列表。"""
    total_result = await db.execute(select(func.count(NotificationLog.id)))
    total = total_result.scalar() or 0

    result = await db.execute(
        select(NotificationLog)
        .order_by(NotificationLog.sent_at.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = result.scalars().all()

    items = [
        LogResponse(
            id=log.id,
            notice_id=log.notice_id,
            channel=log.channel,
            status=log.status,
            error_msg=log.error_msg,
            sent_at=log.sent_at.isoformat(),
        )
        for log in logs
    ]

    return LogListResponse(items=items, total=total)
