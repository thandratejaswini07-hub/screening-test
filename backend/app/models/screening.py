import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class ScreeningSession(Base):
    __tablename__ = "screening_sessions"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    overall_score     = Column(Integer, nullable=False)
    risk_level        = Column(String(20), nullable=False)
    referral_required = Column(Boolean, default=False)
    per_test_levels   = Column(JSONB, default={})
    urgent_flags      = Column(JSONB, default=[])
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    test_results = relationship("TestResult", back_populates="session", cascade="all, delete")
    report       = relationship("Report", back_populates="session", uselist=False, cascade="all, delete")

class TestResult(Base):
    __tablename__ = "test_results"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id       = Column(UUID(as_uuid=True), ForeignKey("screening_sessions.id"), nullable=False)
    test_id          = Column(String(30), nullable=False)
    normalized_score = Column(Integer, nullable=False)
    flags            = Column(JSONB, default=[])
    raw_data         = Column(JSONB, default={})
    completed_at     = Column(String(50))

    session = relationship("ScreeningSession", back_populates="test_results")