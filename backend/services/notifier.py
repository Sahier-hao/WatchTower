"""通知分发器 — 策略模式，支持多渠道扩展。

当前实现：飞书 Webhook 卡片消息。
扩展方式：继承 BaseNotifier，实现 send()，注册到 NOTIFIERS 字典。
"""

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from config import settings


@dataclass
class NoticeData:
    """发送给通知渠道的数据对象。"""
    source_name: str
    title: str
    url: str
    published_at: str = ""  # 格式化后的时间字符串


class BaseNotifier(ABC):
    """通知渠道基类。"""

    @abstractmethod
    async def send(self, notice: NoticeData) -> bool:
        """发送通知，返回 True 成功 / False 失败。"""
        ...


class FeishuNotifier(BaseNotifier):
    """飞书 Webhook 卡片消息。"""

    def __init__(self, webhook_url: str = ""):
        self.webhook_url = webhook_url or settings.feishu_webhook_url

    async def send(self, notice: NoticeData) -> bool:
        if not self.webhook_url:
            return False

        card = {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "title": {"tag": "plain_text", "content": f"🔔 新通知 — {notice.source_name}"},
                    "template": "blue",
                },
                "elements": [
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": (
                                f"**{notice.title}**\n"
                                + (f"📅 发布时间：{notice.published_at}\n" if notice.published_at else "")
                                + f"🔗 [查看详情]({notice.url})"
                            ),
                        },
                    }
                ],
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(self.webhook_url, json=card)
                result = resp.json()
                if result.get("code") == 0:
                    return True
                else:
                    print(f"[FeishuNotifier] 发送失败: {result}")
                    return False
        except Exception as e:
            print(f"[FeishuNotifier] 异常: {e}")
            return False


class NotifierService:
    """通知分发器，管理多个通知渠道。"""

    def __init__(self):
        self._notifiers: dict[str, BaseNotifier] = {}

    def register(self, channel: str, notifier: BaseNotifier):
        """注册一个通知渠道。"""
        self._notifiers[channel] = notifier

    async def send(self, channel: str, notice: NoticeData) -> bool:
        """通过指定渠道发送通知。"""
        notifier = self._notifiers.get(channel)
        if notifier is None:
            return False
        return await notifier.send(notice)

    async def send_all(self, notice: NoticeData) -> dict[str, bool]:
        """通过所有已注册渠道发送。"""
        results = {}
        for channel, notifier in self._notifiers.items():
            results[channel] = await notifier.send(notice)
        return results

    @property
    def channels(self) -> list[str]:
        return list(self._notifiers.keys())


# 全局单例
notifier_service = NotifierService()
# 默认注册飞书渠道
notifier_service.register("feishu", FeishuNotifier())
