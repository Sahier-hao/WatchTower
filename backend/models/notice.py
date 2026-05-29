"""爬取到的通知 ORM 模型。"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Notice(Base):
    __tablename__ = "notices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_id: Mapped[str] = mapped_column(String(36), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False, comment="通知标题")
    url: Mapped[str] = mapped_column(Text, nullable=False, comment="通知链接")
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True, comment="内容哈希(去重)")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, comment="通知发布时间")
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True, comment="原始数据")

    def __repr__(self) -> str:
        return f"<Notice id={self.id} title={self.title!r}>"
