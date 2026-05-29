"""推送日志 ORM 模型。"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    notice_id: Mapped[str] = mapped_column(String(36), ForeignKey("notices.id", ondelete="CASCADE"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(50), nullable=False, comment="推送渠道")
    status: Mapped[str] = mapped_column(String(20), nullable=False, comment="success/failed")
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True, comment="错误信息")
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<NotificationLog id={self.id} channel={self.channel!r} status={self.status!r}>"
