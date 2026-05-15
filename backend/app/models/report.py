import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Report(Base):
    __tablename__ = "reports"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id        = Column(UUID(as_uuid=True), ForeignKey("screening_sessions.id"), nullable=False, unique=True)
    summary           = Column(Text)
    findings          = Column(JSONB, default=[])
    recommendations   = Column(JSONB, default=[])
    referral_required = Column(Boolean, default=False)
    referral_reason   = Column(Text, nullable=True)
    follow_up_weeks   = Column(Integer, default=4)
    model_version     = Column(String(100), default="Qwen2.5-VL-3B-Instruct")
    generated_at      = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ScreeningSession", back_populates="report")

class ImageAnalysis(Base):
    __tablename__ = "image_analyses"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id    = Column(UUID(as_uuid=True), ForeignKey("screening_sessions.id"), nullable=True)
    analysis_type = Column(String(30))
    findings      = Column(Text)
    disclaimer    = Column(Text)
    model_version = Column(String(100), default="Qwen2.5-VL-3B-Instruct")
    analysed_at   = Column(DateTime(timezone=True), server_default=func.now())