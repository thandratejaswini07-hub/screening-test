import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useScreeningStore } from '../store/useScreeningStore'
import { computeOverallRisk } from '../utils/scoring'
import { analyseEyeImage } from '../services/api'

const RISK_STYLES: Record<string, { glow: string; border: string; text: string; bg: string }> = {
  normal:   { glow: 'rgba(34,197,94,0.2)',   border: 'rgba(34,197,94,0.3)',   text: '#22c55e', bg: 'rgba(34,197,94,0.08)'   },
  mild:     { glow: 'rgba(245,158,11,0.2)',   border: 'rgba(245,158,11,0.3)',  text: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
  moderate: { glow: 'rgba(249,115,22,0.2)',   border: 'rgba(249,115,22,0.3)',  text: '#f97316', bg: 'rgba(249,115,22,0.08)'  },
  high:     { glow: 'rgba(239,68,68,0.2)',    border: 'rgba(239,68,68,0.3)',   text: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
}

const TEST_META: Record<string, { label: string; dotColor: string }> = {
  acuity:      { label: 'Visual Acuity',        dotColor: '#3d8bff' },
  contrast:    { label: 'Contrast Sensitivity',  dotColor: '#5c67f2' },
  color:       { label: 'Colour Vision',         dotColor: '#a855f7' },
  astigmatism: { label: 'Astigmatism',           dotColor: '#f59e0b' },
  amsler:      { label: 'Central Visual Field',  dotColor: '#22c55e' },
}

const cardStyle = {
  background: 'rgba(17,31,54,0.7)',
  border: '1px solid rgba(61,139,255,0.12)',
  backdropFilter: 'blur(8px)',
}

export default function Report() {
  const { results, report } = useScreeningStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [imageAnalysis, setImageAnalysis] = useState<any>(null)
  const [imageLoading,  setImageLoading]  = useState(false)
  const [analysisType,  setAnalysisType]  = useState('general')

  const testScores: Record<string, number> = {}
  Object.values(results).forEach((r) => {
    if (r) testScores[r.testId] = r.normalizedScore
  })

  const { overall, riskLevel, referralRequired } = computeOverallRisk(testScores)
  const rStyle = RISK_STYLES[riskLevel] || RISK_STYLES.normal

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageLoading(true)
    setImageAnalysis(null)
    try {
      const result = await analyseEyeImage(file, analysisType)
      setImageAnalysis(result)
    } catch {
      setImageAnalysis({ error: 'Analysis failed. Please try again.' })
    } finally {
      setImageLoading(false)
    }
  }

  if (!Object.keys(testScores).length) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="max-w-md w-full text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(61,139,255,0.12)', border: '1px solid rgba(61,139,255,0.2)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="#3d8bff" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">No results yet</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            Complete a screening first to see your report.
          </p>
          <Link
            to="/screening"
            className="btn-accent inline-block px-8 py-3.5 rounded-xl font-semibold"
          >
            Start Screening
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-2xl mx-auto">

        {/* HEADER */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <path d="M3 8l3 3 7-7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Screening complete — Analysed by Qwen2.5-VL-3B-Instruct
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Your Vision Report</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            AI report generated locally — your data never left this device
          </p>
        </div>

        {/* SCORE CARD */}
        <div
          className="rounded-2xl p-8 mb-6 text-center"
          style={{
            background: rStyle.bg,
            border: `1px solid ${rStyle.border}`,
            boxShadow: `0 0 48px ${rStyle.glow}`,
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: rStyle.text }}>
            Overall Vision Score
          </p>
          <div className="text-8xl font-bold text-white mb-1">{overall}</div>
          <div className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>out of 100</div>
          <span
            className="inline-block text-sm font-semibold px-5 py-2 rounded-full"
            style={{ background: rStyle.bg, color: rStyle.text, border: `1px solid ${rStyle.border}` }}
          >
            {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk
          </span>

          {referralRequired && (
            <div
              className="mt-6 rounded-xl p-4 text-left"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <div className="flex gap-3 items-start">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(239,68,68,0.15)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#ef4444" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#ef4444' }}>
                    Professional examination recommended
                  </p>
                  {report?.referral_reason && (
                    <p className="text-xs mt-1" style={{ color: 'rgba(239,68,68,0.7)' }}>
                      {report.referral_reason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI SUMMARY */}
        {report?.summary && (
          <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#3d8bff,#5c67f2)' }}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <ellipse cx="8" cy="8" rx="6" ry="4" stroke="white" strokeWidth="1.2" />
                  <circle cx="8" cy="8" r="2" fill="white" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Qwen2.5-VL Analysis</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>Generated locally</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{report.summary}</p>
          </div>
        )}

        {/* TEST RESULTS */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Test Results</h2>
          <div className="space-y-3">
            {Object.entries(testScores).map(([testId, score]) => {
              const meta = TEST_META[testId]
              if (!meta) return null
              const rLevel = score >= 80 ? 'normal' : score >= 60 ? 'mild' : score >= 40 ? 'moderate' : 'high'
              const rs = RISK_STYLES[rLevel]
              const barColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444'
              const finding = report?.findings?.find((f: any) =>
                f.test?.toLowerCase().includes(testId.toLowerCase())
              )
              return (
                <div key={testId} className="rounded-xl p-5" style={cardStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: meta.dotColor, boxShadow: `0 0 8px ${meta.dotColor}` }}
                      />
                      <span className="font-medium text-sm text-white">{meta.label}</span>
                    </div>
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded-full"
                      style={{ background: rs.bg, color: rs.text, border: `1px solid ${rs.border}` }}
                    >
                      {rLevel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(61,139,255,0.08)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${score}%`, background: barColor, boxShadow: `0 0 8px ${barColor}60` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-14 text-right text-white">{score}/100</span>
                  </div>
                  {finding && (
                    <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {finding.finding}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RECOMMENDATIONS */}
        {report?.recommendations?.length > 0 && (
          <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
            <h2 className="text-base font-semibold text-white mb-4">Recommendations</h2>
            <div className="space-y-3">
              {report.recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex gap-3">
                  <div
                    className="w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'linear-gradient(135deg,#3d8bff,#5c67f2)', color: '#fff' }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI IMAGE ANALYSIS */}
        <div className="rounded-2xl p-6 mb-6" style={{ ...cardStyle, border: '1px solid rgba(61,139,255,0.2)' }}>
          <h2 className="text-base font-semibold text-white mb-1">AI Eye Image Analysis</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Upload a fundus photo, prescription, or eye symptom photo for Qwen2.5-VL visual analysis.
          </p>
          <div className="flex gap-2 mb-4 flex-wrap">
            {['general', 'fundus', 'prescription', 'symptom'].map((type) => (
              <button
                key={type}
                onClick={() => setAnalysisType(type)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={
                  analysisType === type
                    ? { background: 'var(--accent)', color: '#fff', border: '1px solid transparent' }
                    : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid rgba(61,139,255,0.2)' }
                }
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={imageLoading}
            className="w-full py-3.5 rounded-xl text-sm font-medium transition-colors"
            style={{
              border: '2px dashed rgba(61,139,255,0.3)',
              color: 'var(--accent)',
              background: 'transparent',
            }}
          >
            {imageLoading ? 'Qwen is analysing your image...' : 'Upload image for visual analysis'}
          </button>
          {imageAnalysis && (
            <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(61,139,255,0.06)', border: '1px solid rgba(61,139,255,0.15)' }}>
              {imageAnalysis.error ? (
                <p className="text-sm" style={{ color: '#ef4444' }}>{imageAnalysis.error}</p>
              ) : (
                <>
                  <p className="text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    Qwen2.5-VL {imageAnalysis.analysis_type} analysis
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{imageAnalysis.findings}</p>
                  <p className="text-xs mt-3 italic" style={{ color: 'rgba(107,138,184,0.6)' }}>{imageAnalysis.disclaimer}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* DISCLAIMER */}
        <div className="rounded-xl p-5 mb-8" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            <strong className="text-white">Important:</strong> This screening uses Qwen2.5-VL-3B-Instruct running locally.
            Results are for informational purposes only and do not constitute a medical diagnosis.
            Always consult a qualified ophthalmologist or optometrist for clinical evaluation.
          </p>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-4">
          <Link
            to="/screening"
            className="flex-1 text-center py-3.5 rounded-xl font-semibold text-sm transition-colors"
            style={{ border: '1px solid rgba(61,139,255,0.25)', color: 'var(--text-muted)' }}
          >
            Retake Screening
          </Link>
          <button
            onClick={() => window.print()}
            className="btn-accent flex-1 py-3.5 rounded-xl font-semibold text-sm"
          >
            Save / Print
          </button>
        </div>

      </div>
    </div>
  )
}