"""通知助手 — FastAPI 入口。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings as app_settings
from database import init_db
from routers import sources, notices, logs, stats, settings
from services.scheduler import scheduler_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化数据库和调度器，关闭时清理。"""
    print("[App] 初始化数据库...")
    await init_db()
    print("[App] 启动定时调度器...")
    await scheduler_service.start()
    print(f"[App] 服务已启动: http://{app_settings.host}:{app_settings.port}")
    yield
    print("[App] 关闭调度器...")
    scheduler_service.shutdown()


app = FastAPI(
    title="通知助手 API",
    description="网站通知监控与推送系统",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置（开发环境前端端口）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载路由
app.include_router(sources.router, prefix="/api")
app.include_router(notices.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


@app.get("/api/health", tags=["健康检查"])
async def health():
    """健康检查接口。"""
    return {"status": "ok", "version": "1.0.0"}


# ============================================================
# 直接运行入口
# ============================================================
if __name__ == "__main__":
    import uvicorn
    from config import settings as app_settings

    app.state.host = app_settings.host
    app.state.port = app_settings.port

    uvicorn.run(
        "main:app",
        host=app_settings.host,
        port=app_settings.port,
        reload=True,
    )
