from datetime import datetime
from pathlib import Path

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "civiclens.db"

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class IngestedComplaint(Base):
    __tablename__ = "ingested_complaints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(32), index=True)
    city: Mapped[str] = mapped_column(String(128), index=True, default="Unknown")
    text: Mapped[str] = mapped_column(String(2000))
    category: Mapped[str] = mapped_column(String(32), index=True)
    summary: Mapped[str] = mapped_column(String(240))
    urgency_score: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VoiceIngest(Base):
    __tablename__ = "voice_ingest"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(32), default="voice")
    language: Mapped[str] = mapped_column(String(16), default="unknown")
    city: Mapped[str] = mapped_column(String(128), index=True, default="Unknown")
    original_text: Mapped[str] = mapped_column(String(4000))
    translated_text: Mapped[str] = mapped_column(String(4000))
    category: Mapped[str] = mapped_column(String(32), index=True)
    urgency_score: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CityGeo(Base):
    __tablename__ = "city_geocodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    city: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
