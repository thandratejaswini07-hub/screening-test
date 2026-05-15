import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScreeningStore } from '../store/useScreeningStore'
import { submitScreening, generateReport } from '../services/api'

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

        const report = await generateReport(session.session_id)

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

  // ================= LOADING SCREEN =================

  if (loading)
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-12 max-w-xl w-full text-center">

          <div className="relative mx-auto mb-8 w-24 h-24">
            <div className="absolute inset-0 rounded-3xl bg-blue-500 animate-ping opacity-20"></div>

            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 32 32" fill="none" className="w-12 h-12">
                <ellipse
                  cx="16"
                  cy="16"
                  rx="13"
                  ry="10"
                  stroke="white"
                  strokeWidth="2"
                />
                <circle cx="16" cy="16" r="4" fill="white" />
              </svg>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            AI Processing
          </h2>

          <p className="text-lg text-blue-600 font-medium mb-3">
            {AI_MSGS[msgIdx]}
          </p>

          <p className="text-gray-400 mb-8">
            Qwen2.5-VL-3B-Instruct running locally
          </p>

          <div className="flex justify-center gap-3">
            {AI_MSGS.map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-500 ${
                  i <= msgIdx ? 'bg-blue-500 scale-110' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    )

  // ================= ERROR SCREEN =================

  if (error)
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-12 max-w-lg text-center">

          <div className="text-6xl mb-6">⚠️</div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Something went wrong
          </h2>

          <p className="text-gray-500 mb-8 leading-relaxed">
            {error}
          </p>

          <button
            onClick={() => {
              setError(null)
              reset()
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-semibold transition-all shadow-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    )

  // ================= MAIN SCREEN =================

  const Step = COMPONENTS[currentStep]

  const progress =
    (currentStep / (steps.length - 1)) * 100

  return (
    <div className="min-h-screen bg-[#f5f7fb] py-10 px-4">
      <div className="max-w-5xl mx-auto">

        {/* HERO HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-3xl p-10 text-white mb-8 shadow-xl">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">

            {/* LEFT */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full text-sm mb-5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                AI Vision Screening
              </div>

              <h1 className="text-4xl font-bold mb-4">
                {LABELS[currentStep]}
              </h1>

              <p className="text-blue-100 text-lg max-w-2xl leading-relaxed">
                Complete the guided test carefully for accurate
                AI-powered vision analysis and report generation.
              </p>
            </div>

            {/* RIGHT */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl px-8 py-6 border border-white/20">
              <div className="text-sm text-blue-100 mb-2">
                Progress
              </div>

              <div className="text-5xl font-bold">
                {currentStep + 1}
                <span className="text-blue-200 text-2xl">
                  /{steps.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESS CARD */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8">

          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">
              Screening Progress
            </h2>

            <span className="text-blue-600 font-semibold">
              {Math.round(progress)}%
            </span>
          </div>

          {/* BAR */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* STEPS */}
          <div className="grid grid-cols-6 gap-3">
            {LABELS.map((label, i) => (
              <div key={i} className="flex flex-col items-center">

                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-semibold transition-all ${
                    i < currentStep
                      ? 'bg-green-500 text-white'
                      : i === currentStep
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {i + 1}
                </div>

                <span
                  className={`text-xs text-center mt-2 leading-tight ${
                    i === currentStep
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* TEST COMPONENT */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8">
            <Step />
          </div>
        </div>

      </div>
    </div>
  )
}