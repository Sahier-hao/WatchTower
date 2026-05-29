"""通知 Schema。"""

from datetime import datetime
from pydantic import BaseModel


class NoticeResponse(BaseModel):
    """通知响应。"""
    id: str
    source_id: str
    source_name: str = ""
    title: str
    url: str
    published_at: datetime | None
    first_seen_at: datetime

    model_config = {"from_attributes": True}


class NoticeListResponse(BaseModel):
    """通知分页列表。"""
    items: list[NoticeResponse]
    total: int
