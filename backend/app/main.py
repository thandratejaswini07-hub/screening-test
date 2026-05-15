import logging
import threading
import smtplib
import schedule
import time
from contextlib import asynccontextmanager
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Any, Optional
import jwt as pyjwt
import httpx

from app.core.database import engine, get_db, Base
from app.core.config import settings
from app.services.model_loader import load_model, is_loaded
from app.services.clinical_rules import calculate_overall_risk, compute_follow_up_weeks
from app.services.qwen_engine import generate_report, analyse_eye_image
from app.models.screening import ScreeningSession, TestResult
from app.models.report import Report
from app.models.user import User, ReminderSchedule

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s — %(name)s — %(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

# Generation status tracking
generation_status: dict[str, str] = {}
security = HTTPBearer(auto_error=False)


# ── Startup ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("✓ Database ready")
    load_model()
    logger.info("✓ Model ready")
    # Start reminder scheduler in background
    thread = threading.Thread(target=_start_scheduler, daemon=True)
    thread.start()
    logger.info("✓ Email reminder scheduler started")
    yield
    logger.info("Shutting down...")


app = FastAPI(title="MNR Vision API", version="2.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "app://."],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# ── Auth helpers ───────────────────────────────────────────────────────────
def create_jwt(user_id: str, email: str) -> str:
    payload = {
        "sub":   user_id,
        "email": email,
        "exp":   datetime.utcnow() + timedelta(days=30),
    }
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    return pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not creds:
        return None
    try:
        data = decode_jwt(creds.credentials)
        user = db.query(User).filter(User.id == data["sub"]).first()
        return user
    except Exception:
        return None


def require_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    user = get_current_user(creds, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ── EMAIL ──────────────────────────────────────────────────────────────────
def send_email(to_email: str, subject: str, html_body: str):
    """Send email via Gmail SMTP."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = settings.GMAIL_FROM
        msg["To"]      = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_FROM, to_email, msg.as_string())

        logger.info(f"✓ Email sent to {to_email}")
    except Exception as e:
        logger.error(f"Email failed to {to_email}: {e}")


def send_screening_report_email(user: User, report: Report, session: ScreeningSession):
    """Send full screening report to user."""
    risk_color = {
        "normal":   "#16a34a",
        "mild":     "#d97706",
        "moderate": "#ea580c",
        "high":     "#dc2626",
    }.get(session.risk_level, "#6b7280")

    findings_html = "".join([
        f"<li style='margin-bottom:8px'><strong>{f.get('test','')}</strong>: {f.get('finding','')}</li>"
        for f in (report.findings or [])
    ])

    recs_html = "".join([
        f"<li style='margin-bottom:6px'>{rec}</li>"
        for rec in (report.recommendations or [])
    ])

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#16a34a;padding:32px;text-align:center">
      <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center">
        <span style="font-size:28px">👁</span>
      </div>
      <h1 style="color:white;margin:0;font-size:24px;font-weight:700">MNR Vision</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">Your Vision Screening Report</p>
    </div>

    <!-- Score -->
    <div style="padding:32px;text-align:center;border-bottom:1px solid #f3f4f6">
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em">Overall Vision Score</p>
      <div style="font-size:72px;font-weight:700;color:#111827;line-height:1">{session.overall_score}</div>
      <div style="font-size:14px;color:#6b7280;margin:4px 0 12px">out of 100</div>
      <span style="background:{risk_color}20;color:{risk_color};padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;border:1px solid {risk_color}40">
        {session.risk_level.title()} Risk
      </span>
    </div>

    <!-- Summary -->
    <div style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
      <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 12px">AI Summary</h2>
      <p style="color:#374151;line-height:1.7;margin:0;font-size:14px">{report.summary}</p>
    </div>

    <!-- Findings -->
    <div style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
      <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 12px">Findings</h2>
      <ul style="color:#374151;font-size:14px;line-height:1.7;padding-left:20px;margin:0">
        {findings_html}
      </ul>
    </div>

    <!-- Recommendations -->
    <div style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
      <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 12px">Recommendations</h2>
      <ul style="color:#374151;font-size:14px;line-height:1.7;padding-left:20px;margin:0">
        {recs_html}
      </ul>
    </div>

    <!-- Referral -->
    {"<div style='margin:24px 32px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px'><p style='color:#991b1b;font-weight:600;margin:0 0 4px;font-size:14px'>⚠️ Professional Examination Recommended</p><p style='color:#7f1d1d;font-size:13px;margin:0'>" + (report.referral_reason or "") + "</p></div>" if report.referral_required else ""}

    <!-- Footer -->
    <div style="padding:24px 32px;background:#f9fafb;text-align:center">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 8px">
        This screening is a pre-check tool only and does not constitute a medical diagnosis.
      </p>
      <p style="color:#9ca3af;font-size:12px;margin:0">
        © 2026 MNR Vision · AI-powered eye health screening
      </p>
    </div>
  </div>
</body>
</html>"""

    send_email(
        user.email,
        f"Your MNR Vision Report — {session.risk_level.title()} Risk",
        html
    )


def send_reminder_email(user: User):
    """Send weekly/biweekly reminder to rescreen."""
    html = f"""
<!DOCTYPE html>
<html>
<body style="font-family:Inter,Arial,sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:#16a34a;padding:32px;text-align:center">
      <span style="font-size:48px">👁</span>
      <h1 style="color:white;margin:12px 0 0;font-size:22px">Time for your vision check</h1>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:15px;line-height:1.7">
        Hi {user.full_name or 'there'},
      </p>
      <p style="color:#374151;font-size:15px;line-height:1.7">
        It's time for your scheduled vision screening. Regular checks help detect
        changes early — before they become permanent.
      </p>
      <p style="color:#374151;font-size:15px;line-height:1.7">
        Your last screening was on <strong>{user.last_screened_at.strftime('%d %B %Y') if user.last_screened_at else 'not recorded'}</strong>.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="http://localhost:5173/screening"
           style="background:#16a34a;color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Start your screening →
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
        Takes only 7 minutes · Free · No registration required
      </p>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;text-align:center">
      <p style="color:#9ca3af;font-size:11px;margin:0">
        You are receiving this because you enabled reminders in MNR Vision.
        <a href="http://localhost:5173/unsubscribe" style="color:#9ca3af">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>"""

    send_email(user.email, "👁 Time for your MNR Vision check-up", html)


# ── Reminder scheduler ─────────────────────────────────────────────────────
def _check_and_send_reminders():
    """Runs daily. Sends reminders to users whose schedule is due."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        schedules = db.query(ReminderSchedule).filter(
            ReminderSchedule.active == True,
            ReminderSchedule.next_reminder_at <= datetime.utcnow(),
        ).all()

        for s in schedules:
            user = db.query(User).filter(User.id == s.user_id).first()
            if user:
                send_reminder_email(user)
                # Set next reminder
                days = 7 if s.frequency == "weekly" else 14
                s.next_reminder_at = datetime.utcnow() + timedelta(days=days)
                s.last_sent_at = datetime.utcnow()
                db.commit()
                logger.info(f"Reminder sent to {user.email}")
    except Exception as e:
        logger.error(f"Reminder check failed: {e}")
    finally:
        db.close()


def _start_scheduler():
    schedule.every().day.at("09:00").do(_check_and_send_reminders)
    while True:
        schedule.run_pending()
        time.sleep(60)


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

# ── Health ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": is_loaded()}


# ── Google OAuth ───────────────────────────────────────────────────────────
class GoogleAuthRequest(BaseModel):
    credential: str   # Google ID token from frontend


@app.post("/api/auth/google", tags=["Auth"])
async def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Verify Google ID token, create/find user, return JWT."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}"
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")

        google_data = resp.json()
        email      = google_data.get("email")
        name       = google_data.get("name")
        picture    = google_data.get("picture")
        google_id  = google_data.get("sub")

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        # Find or create user
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                full_name=name,
                avatar_url=picture,
                google_id=google_id,
                auth_provider="google",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"New user created: {email}")

        token = create_jwt(str(user.id), user.email)

        return {
            "token":     token,
            "user": {
                "id":        str(user.id),
                "email":     user.email,
                "full_name": user.full_name,
                "avatar_url": user.avatar_url,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@app.get("/api/auth/me", tags=["Auth"])
def get_me(user: User = Depends(require_user)):
    return {
        "id":        str(user.id),
        "email":     user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "last_screened_at": user.last_screened_at.isoformat() if user.last_screened_at else None,
    }


# ── Reminders ──────────────────────────────────────────────────────────────
class ReminderRequest(BaseModel):
    frequency:  str   # "weekly" or "biweekly"
    active:     bool  = True


@app.post("/api/reminders/setup", tags=["Reminders"])
def setup_reminder(req: ReminderRequest, db: Session = Depends(get_db),
                   user: User = Depends(require_user)):
    existing = db.query(ReminderSchedule).filter(
        ReminderSchedule.user_id == user.id
    ).first()

    days = 7 if req.frequency == "weekly" else 14

    if existing:
        existing.frequency        = req.frequency
        existing.active           = req.active
        existing.next_reminder_at = datetime.utcnow() + timedelta(days=days)
    else:
        reminder = ReminderSchedule(
            user_id=user.id,
            frequency=req.frequency,
            active=req.active,
            next_reminder_at=datetime.utcnow() + timedelta(days=days),
        )
        db.add(reminder)

    db.commit()
    return {"message": f"Reminder set to {req.frequency}", "active": req.active}


@app.get("/api/reminders/status", tags=["Reminders"])
def reminder_status(db: Session = Depends(get_db), user: User = Depends(require_user)):
    r = db.query(ReminderSchedule).filter(ReminderSchedule.user_id == user.id).first()
    if not r:
        return {"active": False, "frequency": None, "next_reminder_at": None}
    return {
        "active":            r.active,
        "frequency":         r.frequency,
        "next_reminder_at":  r.next_reminder_at.isoformat() if r.next_reminder_at else None,
        "last_sent_at":      r.last_sent_at.isoformat() if r.last_sent_at else None,
    }


# ── Screening ──────────────────────────────────────────────────────────────
class TestInput(BaseModel):
    test_id:          str
    normalized_score: int
    flags:            list[str] = []
    raw_data:         dict[str, Any] = {}
    completed_at:     str = ""


class SubmitRequest(BaseModel):
    tests: list[TestInput]


@app.post("/api/screening/submit", tags=["Screening"])
def submit_screening(
    req: SubmitRequest,
    db:   Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if not req.tests:
        raise HTTPException(status_code=400, detail="No test results provided")

    risk = calculate_overall_risk([t.dict() for t in req.tests])

    session = ScreeningSession(
        overall_score=risk.overall_score,
        risk_level=risk.risk_level,
        referral_required=risk.referral_required,
        per_test_levels=risk.per_test_levels,
        urgent_flags=risk.urgent_flags,
    )
    db.add(session)
    db.flush()

    for t in req.tests:
        db.add(TestResult(
            session_id=session.id,
            test_id=t.test_id,
            normalized_score=t.normalized_score,
            flags=t.flags,
            raw_data=t.raw_data,
            completed_at=t.completed_at,
        ))

    # Update user's last screened time
    if user:
        user.last_screened_at = datetime.utcnow()

    db.commit()
    db.refresh(session)

    return {
        "session_id":        str(session.id),
        "overall_score":     risk.overall_score,
        "risk_level":        risk.risk_level,
        "referral_required": risk.referral_required,
        "per_test_levels":   risk.per_test_levels,
    }


@app.get("/api/screening/history", tags=["Screening"])
def screening_history(
    limit: int = 10,
    db:    Session = Depends(get_db),
    user:  User = Depends(require_user),
):
    sessions = (
        db.query(ScreeningSession)
        .filter(ScreeningSession.user_id == str(user.id))
        .order_by(ScreeningSession.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "session_id":    str(s.id),
            "overall_score": s.overall_score,
            "risk_level":    s.risk_level,
            "created_at":    s.created_at.isoformat(),
        }
        for s in sessions
    ]


# ── Reports ────────────────────────────────────────────────────────────────
def _generate_background(session_id: str, user_email: Optional[str] = None):
    from app.core.database import SessionLocal
    generation_status[session_id] = "pending"
    db = SessionLocal()
    try:
        session = db.query(ScreeningSession).filter(
            ScreeningSession.id == session_id
        ).first()
        if not session:
            generation_status[session_id] = "error"
            return

        existing = db.query(Report).filter(Report.session_id == session_id).first()
        if existing:
            generation_status[session_id] = "done"
            return

        test_results = [
            {"test_id": t.test_id, "normalized_score": t.normalized_score, "flags": t.flags or []}
            for t in session.test_results
        ]

        ai = generate_report(test_results, session.risk_level, session.overall_score)

        report = Report(
            session_id=session.id,
            summary=ai.get("summary", ""),
            findings=ai.get("findings", []),
            recommendations=ai.get("recommendations", []),
            referral_required=ai.get("referral_required", session.referral_required),
            referral_reason=ai.get("referral_reason"),
            follow_up_weeks=ai.get("follow_up_weeks", compute_follow_up_weeks(session.risk_level)),
            model_version="AI-Powered",
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        # Send email report if user is logged in
        if user_email:
            user = db.query(User).filter(User.email == user_email).first()
            if user:
                send_screening_report_email(user, report, session)

        generation_status[session_id] = "done"
        logger.info(f"[Report] ✓ Done for {session_id}")

    except Exception as e:
        logger.error(f"[Report] Error: {e}")
        generation_status[session_id] = "error"
    finally:
        db.close()


@app.post("/api/reports/generate/{session_id}", tags=["Reports"])
def generate_report_route(
    session_id: str,
    db:   Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    session = db.query(ScreeningSession).filter(ScreeningSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    existing = db.query(Report).filter(Report.session_id == session_id).first()
    if existing:
        return {"status": "done", "session_id": session_id, "report": _fmt(existing)}

    if generation_status.get(session_id) == "pending":
        return {"status": "pending", "session_id": session_id, "report": None}

    thread = threading.Thread(
        target=_generate_background,
        args=(session_id, user.email if user else None),
        daemon=True,
    )
    thread.start()

    return {"status": "pending", "session_id": session_id, "report": None}


@app.get("/api/reports/status/{session_id}", tags=["Reports"])
def report_status(session_id: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.session_id == session_id).first()
    if report:
        return {"ready": True, "status": "done", "session_id": session_id, "report": _fmt(report)}
    status = generation_status.get(session_id, "not_started")
    return {"ready": False, "status": status, "session_id": session_id, "report": None}


@app.get("/api/reports/{report_id}", tags=["Reports"])
def get_report(report_id: str, db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    return _fmt(r)


def _fmt(r: Report) -> dict:
    return {
        "report_id":        str(r.id),
        "session_id":       str(r.session_id),
        "summary":          r.summary,
        "findings":         r.findings,
        "recommendations":  r.recommendations,
        "referral_required": r.referral_required,
        "referral_reason":  r.referral_reason,
        "follow_up_weeks":  r.follow_up_weeks,
        "generated_at":     r.generated_at.isoformat(),
    }


# ── Retinal Image Analysis ─────────────────────────────────────────────────
ALLOWED = {"image/jpeg", "image/png", "image/webp"}


@app.post("/api/analyse/retina", tags=["Image Analysis"])
async def analyse_retina(
    file:          UploadFile = File(...),
    analysis_type: str        = Form(default="fundus"),
    compare_with:  str        = Form(default=""),   # comma-sep conditions to compare
    session_id:    str        = Form(default=None),
    db:            Session    = Depends(get_db),
    user: Optional[User]      = Depends(get_current_user),
):
    """
    Analyse a retinal/fundus image.
    compare_with: comma-separated list of conditions to compare against
    e.g. "diabetic_retinopathy,glaucoma,amd"
    """
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Use JPEG, PNG or WebP")

    image_bytes = await file.read()
    if len(image_bytes) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Max 15MB")

    # Build comparison prompt if conditions specified
    conditions = [c.strip() for c in compare_with.split(",") if c.strip()]
    comparison_text = ""
    if conditions:
        readable = {
            "diabetic_retinopathy": "Diabetic Retinopathy",
            "glaucoma":             "Glaucoma",
            "amd":                  "Age-related Macular Degeneration",
            "cataract":             "Cataract",
            "hypertensive":         "Hypertensive Retinopathy",
        }
        names = [readable.get(c, c.replace("_", " ").title()) for c in conditions]
        comparison_text = (
            f" Specifically compare findings against these conditions: {', '.join(names)}. "
            f"For each condition, state whether signs are present, absent, or inconclusive."
        )

    result = analyse_eye_image(image_bytes, analysis_type, extra_prompt=comparison_text)

    return {
        "session_id":       session_id,
        "analysis_type":    analysis_type,
        "compared_against": conditions,
        "findings":         result["findings"],
        "disclaimer":       result["disclaimer"],
    }


# ── Dashboard ──────────────────────────────────────────────────────────────
@app.get("/api/dashboard", tags=["Dashboard"])
def get_dashboard(
    db:   Session = Depends(get_db),
    user: User    = Depends(require_user),
):
    sessions = (
        db.query(ScreeningSession)
        .filter(ScreeningSession.user_id == str(user.id))
        .order_by(ScreeningSession.created_at.asc())
        .all()
    )

    history = [
        {
            "date":          s.created_at.isoformat(),
            "overall_score": s.overall_score,
            "risk_level":    s.risk_level,
            "session_id":    str(s.id),
        }
        for s in sessions
    ]

    latest = sessions[-1] if sessions else None
    reminder = db.query(ReminderSchedule).filter(
        ReminderSchedule.user_id == user.id
    ).first()

    return {
        "user": {
            "full_name":        user.full_name,
            "email":            user.email,
            "avatar_url":       user.avatar_url,
            "last_screened_at": user.last_screened_at.isoformat() if user.last_screened_at else None,
        },
        "total_screenings": len(sessions),
        "latest_score":     latest.overall_score if latest else None,
        "latest_risk":      latest.risk_level if latest else None,
        "score_history":    history,
        "reminder": {
            "active":    reminder.active if reminder else False,
            "frequency": reminder.frequency if reminder else None,
        } if reminder else {"active": False, "frequency": None},
    }