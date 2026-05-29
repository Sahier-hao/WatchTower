"""爬取源请求/响应 Schema。"""

from datetime import datetime
from pydantic import BaseModel, Field


class SourceCreate(BaseModel):
    """创建爬取源请求。"""
    name: str = Field(..., min_length=1, max_length=255, description="来源名称")
    url: str = Field(..., min_length=1, description="目标列表页URL")
    list_selector: str = Field(..., min_length=1, description="列表项CSS选择器")
    title_selector: str = Field(..., min_length=1, description="标题CSS选择器")
    link_selector: str = Field(..., min_length=1, description="链接CSS选择器")
    time_selector: str | None = Field(None, description="时间CSS选择器(可选)")
    crawl_interval: int = Field(30, ge=1, le=1440, description="爬取间隔(分钟)")
    is_active: bool = Field(True, description="是否启用")


class SourceUpdate(BaseModel):
    """更新爬取源请求（所有字段可选）。"""
    name: str | None = Field(None, min_length=1, max_length=255)
    url: str | None = Field(None, min_length=1)
    list_selector: str | None = Field(None, min_length=1)
    title_selector: str | None = Field(None, min_length=1)
    link_selector: str | None = Field(None, min_length=1)
    time_selector: str | None = None
    crawl_interval: int | None = Field(None, ge=1, le=1440)
    is_active: bool | None = None


class SourceResponse(BaseModel):
    """爬取源响应。"""
    id: str
    name: str
    url: str
    list_selector: str
    title_selector: str
    link_selector: str
    time_selector: str | None
    crawl_interval: int
    is_active: bool
    last_crawled_at: datetime | None
    created_at: datetime
    updated_at: datetime
    notice_count: int = 0  # 该源已爬取的通知数量

    model_config = {"from_attributes": True}


class SourceListResponse(BaseModel):
    """爬取源分页列表。"""
    items: list[SourceResponse]
    total: int
