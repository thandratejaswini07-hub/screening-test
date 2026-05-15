// ── Acuity ────────────────────────────────────────────────────────────────────

export const ACUITY_ROWS = [
  { label: '6/60',  score: 20 },
  { label: '6/36',  score: 35 },
  { label: '6/24',  score: 50 },
  { label: '6/18',  score: 60 },
  { label: '6/12',  score: 75 },
  { label: '6/9',   score: 85 },
  { label: '6/7.5', score: 92 },
  { label: '6/6',   score: 100 },
]

export function scoreAcuity(normalizedScore: number): { flags: string[] } {
  const flags: string[] = []
  if (normalizedScore < 35)       flags.push('urgent_referral')
  else if (normalizedScore < 50)  flags.push('referral_advised')
  else if (normalizedScore < 75)  flags.push('acuity_reduced')
  return { flags }
}

// ── Contrast ──────────────────────────────────────────────────────────────────

export function scoreContrast(accuracy: number): { score: number; flags: string[] } {
  const score = Math.round(accuracy * 100)
  const flags: string[] = []
  if (score < 40)       flags.push('contrast_severely_reduced')
  else if (score < 60)  flags.push('contrast_reduced')
  return { score, flags }
}

// ── Colour ────────────────────────────────────────────────────────────────────

export function scoreColor(correct: number, total: number): { score: number; flags: string[] } {
  const pct   = total > 0 ? correct / total : 1
  const score = Math.round(pct * 100)
  const flags: string[] = []
  if (pct < 0.6)       flags.push('colour_deficiency_likely')
  else if (pct < 0.8)  flags.push('colour_deficiency_possible')
  return { score, flags }
}

// FIX: alias so ColorVisionTest.tsx import works without changing that file
export const scoreColorVision = scoreColor

// ── Astigmatism ───────────────────────────────────────────────────────────────

// FIX: AstigmatismTest.tsx calls scoreAstigmatism(allEqual: boolean, spokeCount: number)
// Previous signature expected (blurredAxes: number[], totalAxes: number) — mismatch fixed here
export function scoreAstigmatism(
  allEqual:   boolean,
  spokeCount: number,
): { score: number; flags: string[] } {
  const flags: string[] = []
  if (!allEqual && spokeCount >= 4)       flags.push('astigmatism_likely')
  else if (!allEqual && spokeCount >= 1)  flags.push('astigmatism_possible')
  const deduction = allEqual ? 0 : Math.min(spokeCount * 8, 60)
  return { score: Math.max(0, 100 - deduction), flags }
}

// ── Amsler ────────────────────────────────────────────────────────────────────

export function scoreAmsler(
  distorted:   boolean,
  missingArea: boolean,
): { score: number; flags: string[] } {
  const flags: string[] = []
  if (distorted)    flags.push('metamorphopsia_possible')
  if (missingArea)  flags.push('scotoma_possible')
  const deductions = (distorted ? 30 : 0) + (missingArea ? 30 : 0)
  return { score: Math.max(0, 100 - deductions), flags }
}

// ── Overall risk ──────────────────────────────────────────────────────────────

export type RiskLevel = 'normal' | 'mild' | 'moderate' | 'high'

const WEIGHTS: Record<string, number> = {
  acuity:      0.35,
  contrast:    0.25,
  color:       0.15,
  astigmatism: 0.10,
  amsler:      0.15,
}

export function computeOverallRisk(scores: Record<string, number>): {
  overall:          number
  riskLevel:        RiskLevel
  referralRequired: boolean
} {
  const keys = Object.keys(scores)
  if (keys.length === 0) {
    return { overall: 0, riskLevel: 'normal', referralRequired: false }
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const key of keys) {
    const w = WEIGHTS[key] ?? 0.15
    weightedSum += (scores[key] ?? 0) * w
    totalWeight += w
  }

  const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
  const referralRequired = overall < 60

  let riskLevel: RiskLevel
  if      (overall >= 80) riskLevel = 'normal'
  else if (overall >= 60) riskLevel = 'mild'
  else if (overall >= 40) riskLevel = 'moderate'
  else                    riskLevel = 'high'

  return { overall, riskLevel, referralRequired }
}