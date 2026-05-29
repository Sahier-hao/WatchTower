"""系统设置 API。"""

from fastapi import APIRouter

from config import settings as app_settings
from schemas.settings import SettingsResponse, SettingsUpdate
from services.notifier import notifier_service, FeishuNotifier

router = APIRouter(prefix="/settings", tags=["设置"])


@router.get("", response_model=SettingsResponse)
async def get_settings():
    """获取当前系统设置。"""
    return SettingsResponse(
        feishu_webhook_url=app_settings.feishu_webhook_url,
        default_crawl_interval=app_settings.default_crawl_interval,
    )


@router.put("", response_model=SettingsResponse)
async def update_settings(body: SettingsUpdate):
    """更新系统设置。"""
    if body.feishu_webhook_url is not None:
        app_settings.feishu_webhook_url = body.feishu_webhook_url
        # 重新注册飞书渠道以使用新的 Webhook URL
        notifier_service.register("feishu", FeishuNotifier(body.feishu_webhook_url))

    if body.default_crawl_interval is not None:
        app_settings.default_crawl_interval = body.default_crawl_interval

    return SettingsResponse(
        feishu_webhook_url=app_settings.feishu_webhook_url,
        default_crawl_interval=app_settings.default_crawl_interval,
    )
