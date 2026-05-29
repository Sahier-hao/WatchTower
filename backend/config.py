"""应用配置管理，支持 .env 文件和环境变量。"""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """全局配置，自动从 .env 和环境变量加载。"""

    # 飞书
    feishu_webhook_url: str = ""

    # 爬取
    default_crawl_interval: int = 30  # 分钟

    # 数据库
    database_url: str = "sqlite+aiosqlite:///./data/notification.db"

    # 服务
    host: str = "0.0.0.0"
    port: int = 8000

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()

# 确保 data 目录存在
data_dir = Path(settings.database_url.split("///")[-1]).parent
if data_dir and data_dir != Path("."):
    data_dir.mkdir(parents=True, exist_ok=True)
