import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScreeningStore } from '../store/useScreeningStore'
import { submitScreening, generateReport, pollForReport } from '../services/api'

import Calibration from '../components/tests/Calibration'
import AcuityTest from '../components/tests/AcuityTest'
import ContrastTest from '../components/tests/ContrastTest'
import ColorVisionTest from '../components/tests/ColorVisionTest'
import AstigmatismTest from '../components/tests/AstigmatismTest'
import AmslerTest from '../components/tests/AmslerTest'

const LABELS = [
  'Calibration',
  'Visual Acuity',
  'Contrast',
  'Colour Vision',
  'Astigmatism',
  'Amsler Grid',
]

const COMPONENTS = [
  Calibration,
  AcuityTest,
  ContrastTest,
  ColorVisionTest,
  AstigmatismTest,
  AmslerTest,
]

const AI_MSGS = [
  'Submitting your results...',
  'Running clinical scoring engine...',
  'Qwen2.5-VL is analysing results...',
  'Generating your personalised report...',
  'Almost done...',
]

export default function Screening() {
  const {
    currentStep,
    steps,
    isComplete,
    results,
    setSession,
    setReport,
    reset,
  } = useScreeningStore()

  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    reset()
  }, [])

  useEffect(() => {
    if (!isComplete) return

    const run = async () => {
      setLoading(true)

      const iv = setInterval(() => {
        setMsgIdx((m) => Math.min(m + 1, AI_MSGS.length - 1))
      }, 2500)

      try {
        const tests = Object.values(results).map((r) => ({
          test_id: r!.testId,
          normalized_score: r!.normalizedScore,
          flags: r!.flags,
          raw_data: r!.rawData,
          completed_at: r!.completedAt,
        }))

        const session = await submitScreening(tests)
        setSession(session.session_id)

        // Kick off generation (returns immediately — report is built in background)
        await generateReport(session.session_id)

        // Poll until the report is ready (up to 5 minutes)
        const report = await pollForReport(session.session_id)
        setReport(report)
        navigate('/report')
      } catch (e: any) {
        setError(
          e?.response?.data?.detail ||
            'Something went wrong. Please try again.'
        )
      } finally {
        clearInterval(iv)
        setLoading(false)
      }
    }

    run()
  }, [isComplete])

  // ── LOADING ──
  if (loading)
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--bg-base)' }}
      >
        <div
          className="rounded-3xl p-12 max-w-xl w-full text-center"
          style={{
            background: 'rgba(17,31,54,0.85)',
            border: '1px solid rgba(61,139,255,0.18)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 60px rgba(61,139,255,0.1)',
          }}
        >
          {/* Spinner */}
          <div className="relative mx-auto mb-8 w-20 h-20">
            <div
              className="absolute inset-0 rounded-2xl animate-ping opacity-20"
              style={{ background: 'var(--accent)' }}
            />
            <div
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#3d8bff,#5c67f2)', boxShadow: '0 0 32px rgba(61,139,255,0.4)' }}
            >
              <svg viewBox="0 0 32 32" fill="none" className="w-10 h-10">
                <ellipse cx="16" cy="16" rx="13" ry="10" stroke="white" strokeWidth="2" />
                <circle cx="16" cy="16" r="4" fill="white" />
              </svg>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-3">AI Processing</h2>
          <p className="text-base font-medium mb-2" style={{ color: 'var(--accent)' }}>
            {AI_MSGS[msgIdx]}
          </p>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            Qwen2.5-VL-3B-Instruct running locally
          </p>

          <div className="flex justify-center gap-3">
            {AI_MSGS.map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full transition-all duration-500"
                style={{
                  background: i <= msgIdx ? 'var(--accent)' : 'rgba(61,139,255,0.2)',
                  transform: i <= msgIdx ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )

  // ── ERROR ──
  if (error)
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--bg-base)' }}
      >
        <div
          className="rounded-3xl p-12 max-w-lg w-full text-center"
          style={{
            background: 'rgba(17,31,54,0.85)',
            border: '1px solid rgba(239,68,68,0.25)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="#ef4444" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">Something went wrong</h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>{error}</p>

          <button
            onClick={() => { setError(null); reset() }}
            className="btn-accent px-8 py-3.5 rounded-xl font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    )

  // ── MAIN ──
  const Step = COMPONENTS[currentStep]
  const progress = (currentStep / (steps.length - 1)) * 100

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-5xl mx-auto">

        {/* HERO HEADER */}
        <div
          className="rounded-3xl p-8 mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(61,139,255,0.18), rgba(92,103,242,0.18))',
            border: '1px solid rgba(61,139,255,0.22)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div>
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-4"
                style={{ background: 'rgba(61,139,255,0.15)', border: '1px solid rgba(61,139,255,0.3)', color: 'var(--accent)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: 'pulse 2s infinite' }} />
                AI Vision Screening
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">{LABELS[currentStep]}</h1>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,240,254,0.6)' }}>
                Complete each guided test carefully for accurate AI-powered vision analysis.
              </p>
            </div>

            <div
              className="px-8 py-5 rounded-2xl text-center flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <p className="text-xs mb-1" style={{ color: 'rgba(232,240,254,0.5)' }}>Progress</p>
              <div className="text-4xl font-bold text-white">
                {currentStep + 1}
                <span className="text-xl font-normal" style={{ color: 'rgba(232,240,254,0.4)' }}>
                  /{steps.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESS CARD */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            background: 'rgba(17,31,54,0.7)',
            border: '1px solid rgba(61,139,255,0.12)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-medium text-sm text-white">Screening Progress</h2>
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              {Math.round(progress)}%
            </span>
          </div>

          <div className="h-2 rounded-full overflow-hidden mb-5" style={{ background: 'rgba(61,139,255,0.1)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg,#3d8bff,#5c67f2)',
                boxShadow: '0 0 12px rgba(61,139,255,0.5)',
              }}
            />
          </div>

          <div className="grid grid-cols-6 gap-2">
            {LABELS.map((label, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-semibold transition-all"
                  style={
                    i < currentStep
                      ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }
                      : i === currentStep
                      ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 16px rgba(61,139,255,0.5)' }
                      : { background: 'rgba(61,139,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(61,139,255,0.1)' }
                  }
                >
                  {i < currentStep ? (
                    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                      <path d="M3 8l3 3 7-7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className="text-xs text-center mt-1.5 leading-tight"
                  style={{ color: i === currentStep ? 'var(--accent)' : 'var(--text-muted)', fontSize: '10px' }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* TEST COMPONENT */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(17,31,54,0.7)',
            border: '1px solid rgba(61,139,255,0.12)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="p-8">
            <Step />
          </div>
        </div>

      </div>
    </div>
  )
}