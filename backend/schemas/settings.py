"""系统设置 Schema。"""

from pydantic import BaseModel, Field


class SettingsResponse(BaseModel):
    """系统设置响应。"""
    feishu_webhook_url: str = ""
    default_crawl_interval: int = 30


class SettingsUpdate(BaseModel):
    """更新系统设置请求。"""
    feishu_webhook_url: str | None = None
    default_crawl_interval: int | None = Field(None, ge=1, le=1440)
