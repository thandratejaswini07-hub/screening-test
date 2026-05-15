from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)

class ReminderSchedule(Base):
    __tablename__ = "reminder_schedules"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    reminder_time = Column(DateTime, default=datetime.utcnow)