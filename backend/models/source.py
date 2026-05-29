"""爬取源 ORM 模型。"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="来源名称")
    url: Mapped[str] = mapped_column(Text, nullable=False, comment="目标列表页URL")
    list_selector: Mapped[str] = mapped_column(Text, nullable=False, comment="列表项CSS选择器")
    title_selector: Mapped[str] = mapped_column(Text, nullable=False, comment="标题CSS选择器")
    link_selector: Mapped[str] = mapped_column(Text, nullable=False, comment="链接CSS选择器")
    time_selector: Mapped[str | None] = mapped_column(Text, nullable=True, comment="时间CSS选择器(可选)")
    crawl_interval: Mapped[int] = mapped_column(Integer, default=30, comment="爬取间隔(分钟)")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否启用")
    last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, comment="上次爬取时间")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<Source id={self.id} name={self.name!r}>"
