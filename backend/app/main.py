from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import Auth0Middleware
from app.config import settings
from app.database import Base, engine
from app.models import AIReport, Assessment, Patient, SpeechMetric  # noqa: F401
from app.routes.assessment import router as assessment_router
from app.routes.doctor import router as doctor_router
from app.routes.patient import router as patient_router
from app.routes.speech import router as speech_router


app = FastAPI(title=settings.app_name, version=settings.app_version)

app.add_middleware(Auth0Middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Remote Dementia Monitoring API"}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(assessment_router)
app.include_router(speech_router)
app.include_router(patient_router)
app.include_router(doctor_router)
