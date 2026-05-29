"""定时调度器 — 基于 APScheduler 的动态任务管理。

功能：
- 启动时从数据库加载所有启用的爬取源
- 为每个源注册一个间隔任务
- 支持动态添加/移除/更新任务
"""

import asyncio
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models import Source, NotificationLog
from services.crawler import crawler_service
from services.notifier import NoticeData, notifier_service


class SchedulerService:
    """定时调度管理器。"""

    def __init__(self):
        self._scheduler = AsyncIOScheduler()
        self._job_ids: set[str] = set()

    async def start(self):
        """启动调度器，加载所有活跃爬取源。"""
        async with async_session() as db:
            result = await db.execute(select(Source).where(Source.is_active == True))
            sources = result.scalars().all()
            for source in sources:
                self.add_job(source)
        self._scheduler.start()
        print(f"[Scheduler] 已启动，注册了 {len(self._job_ids)} 个任务")

    def shutdown(self):
        """关闭调度器。"""
        self._scheduler.shutdown(wait=False)

    def add_job(self, source: Source):
        """为指定爬取源注册定时任务。"""
        job_id = f"crawl_{source.id}"
        if job_id in self._job_ids:
            self._scheduler.remove_job(job_id)
        self._scheduler.add_job(
            self._crawl_job,
            IntervalTrigger(minutes=source.crawl_interval),
            args=[source.id],
            id=job_id,
            name=f"爬取: {source.name}",
            replace_existing=True,
        )
        self._job_ids.add(job_id)

    def remove_job(self, source_id: str):
        """移除调度任务。"""
        job_id = f"crawl_{source_id}"
        if job_id in self._job_ids:
            self._scheduler.remove_job(job_id)
            self._job_ids.discard(job_id)

    def update_job(self, source: Source):
        """更新任务：如果源启用则添加/更新，否则移除。"""
        if source.is_active:
            self.add_job(source)
        else:
            self.remove_job(source.id)

    async def _crawl_job(self, source_id: str):
        """定时任务执行函数：爬取 → 通知 → 记录日志。"""
        async with async_session() as db:
            source = await db.get(Source, source_id)
            if not source or not source.is_active:
                return

            try:
                new_notices = await crawler_service.crawl(source, db)
                if new_notices:
                    print(f"[Scheduler] {source.name}: 发现 {len(new_notices)} 条新通知")
                    for notice in new_notices:
                        # 发送通知
                        success = await notifier_service.send(
                            "feishu",
                            NoticeData(
                                source_name=source.name,
                                title=notice.title,
                                url=notice.url,
                                published_at=(
                                    notice.published_at.strftime("%Y-%m-%d %H:%M")
                                    if notice.published_at
                                    else ""
                                ),
                            ),
                        )
                        # 记录推送日志
                        db.add(NotificationLog(
                            notice_id=notice.id,
                            channel="feishu",
                            status="success" if success else "failed",
                            error_msg=None if success else "Webhook 发送失败",
                        ))
                await db.commit()
            except Exception as e:
                print(f"[Scheduler] 爬取失败 {source.name}: {e}")
                await db.rollback()


# 全局单例
scheduler_service = SchedulerService()
