from dataclasses import dataclass
from typing import Optional
 
 
# ── Per-test thresholds ──────────────────────────────────────────────────────
# (min_score_for_level)
THRESHOLDS = {
    "normal":   80,
    "mild":     60,
    "moderate": 40,
    # below 40 = high risk
}
 
# ── Weights must sum to 1.0 ───────────────────────────────────────────────────
WEIGHTS = {
    "acuity":      0.35,
    "contrast":    0.25,
    "color":       0.15,
    "astigmatism": 0.15,
    "amsler":      0.10,
}
 
 
@dataclass
class RiskResult:
    overall_score: int
    risk_level: str           # normal | mild | moderate | high
    referral_required: bool
    per_test_levels: dict     # { test_id: risk_level }
    urgent_flags: list        # flags that require immediate attention
 
 
def score_test(normalized_score: int) -> str:
    """Classify a single test score into a risk level."""
    if normalized_score >= THRESHOLDS["normal"]:
        return "normal"
    elif normalized_score >= THRESHOLDS["mild"]:
        return "mild"
    elif normalized_score >= THRESHOLDS["moderate"]:
        return "moderate"
    else:
        return "high"
 
 
def calculate_overall_risk(test_results: list[dict]) -> RiskResult:
    """
    Compute weighted overall risk from all test results.
 
    Input: list of {test_id, normalized_score, flags}
    Output: RiskResult dataclass
    """
    weighted_score = 0.0
    total_weight = 0.0
    per_test_levels = {}
    urgent_flags = []
 
    for r in test_results:
        tid = r["test_id"]
        score = r["normalized_score"]
        flags = r.get("flags", [])
 
        w = WEIGHTS.get(tid, 0.1)
        weighted_score += score * w
        total_weight += w
 
        level = score_test(score)
        per_test_levels[tid] = level
 
        # Collect urgent flags
        for flag in flags:
            if "urgent" in flag or "referral" in flag:
                urgent_flags.append({"test": tid, "flag": flag})
 
    overall = round(weighted_score / total_weight) if total_weight > 0 else 0
 
    if overall >= THRESHOLDS["normal"]:
        risk_level = "normal"
    elif overall >= THRESHOLDS["mild"]:
        risk_level = "mild"
    elif overall >= THRESHOLDS["moderate"]:
        risk_level = "moderate"
    else:
        risk_level = "high"
 
    # Referral required if moderate/high overall OR any urgent flags
    referral_required = (
        overall < THRESHOLDS["mild"]
        or len(urgent_flags) > 0
        or any(v in ("moderate", "high") for v in per_test_levels.values())
    )
 
    return RiskResult(
        overall_score=overall,
        risk_level=risk_level,
        referral_required=referral_required,
        per_test_levels=per_test_levels,
        urgent_flags=urgent_flags,
    )
 
 
def compute_follow_up_weeks(risk_level: str) -> int:
    """Return follow-up interval in weeks based on risk level."""
    return {"normal": 12, "mild": 4, "moderate": 2, "high": 1}.get(risk_level, 4)