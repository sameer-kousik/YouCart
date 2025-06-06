from fastapi import FastAPI
from bot import start_bot
from api.academic import router as academic_router

app = FastAPI(title="CSE_Helper_Bot API")

app.include_router(academic_router)

@app.on_event("startup")
async def startup_event():
    await start_bot()
