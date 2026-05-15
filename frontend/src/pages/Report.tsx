import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useScreeningStore } from '../store/useScreeningStore'
import { computeOverallRisk } from '../utils/scoring'
import { analyseEyeImage } from '../services/api'

const RISK_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  normal:   { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700'  },
  mild:     { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  moderate: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  high:     { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700'    },
}

const TEST_META: Record<string, { label: string; icon: string }> = {
  acuity:      { label: 'Visual Acuity',       icon: '👁'  },
  contrast:    { label: 'Contrast Sensitivity', icon: '◑'  },
  color:       { label: 'Colour Vision',        icon: '🎨' },
  astigmatism: { label: 'Astigmatism',          icon: '⊕'  },
  amsler:      { label: 'Central Visual Field', icon: '⊞'  },
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
  const styles = RISK_STYLES[riskLevel] || RISK_STYLES.normal

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
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">No results yet</h2>
        <p className="text-gray-500 mb-8">Complete a screening first to see your report.</p>
        <Link
          to="/screening"
          className="bg-green-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
        >
          Start screening →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-medium px-3 py-1 rounded-full mb-4">
          ✓ Screening complete · Analysed by Qwen2.5-VL-3B-Instruct
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Vision Report</h1>
        <p className="text-gray-500 text-sm">AI report generated locally — your data never left this device</p>
      </div>

      <div className={`rounded-2xl border p-8 mb-8 text-center ${styles.bg} ${styles.border}`}>
        <p className={`text-sm font-medium mb-2 ${styles.text}`}>Overall Vision Score</p>
        <div className="text-7xl font-bold text-gray-900 mb-2">{overall}</div>
        <div className="text-sm text-gray-500 mb-4">out of 100</div>
        <span className={`inline-block text-sm font-semibold px-4 py-1.5 rounded-full border ${styles.bg} ${styles.text} ${styles.border}`}>
          {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk
        </span>
        {referralRequired && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-left">
            <div className="flex gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-800 text-sm">Professional examination recommended</p>
                {report?.referral_reason && (
                  <p className="text-red-600 text-xs mt-1">{report.referral_reason}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {report?.summary && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <ellipse cx="8" cy="8" rx="6" ry="4" stroke="white" strokeWidth="1.2" />
                <circle cx="8" cy="8" r="2" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900">Qwen2.5-VL Analysis</span>
            <span className="text-xs text-gray-400 ml-auto">Generated locally</span>
          </div>
          <p className="text-gray-700 leading-relaxed text-sm">{report.summary}</p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h2>
        <div className="space-y-3">
          {Object.entries(testScores).map(([testId, score]) => {
            const meta = TEST_META[testId]
            if (!meta) return null
            const rLevel = score >= 80 ? 'normal' : score >= 60 ? 'mild' : score >= 40 ? 'moderate' : 'high'
            const rs = RISK_STYLES[rLevel]
            const finding = report?.findings?.find((f: any) =>
              f.test?.toLowerCase().includes(testId.toLowerCase())
            )
            const barColor =
              score >= 80 ? '#16a34a' :
              score >= 60 ? '#d97706' :
              score >= 40 ? '#ea580c' : '#dc2626'
            return (
              <div key={testId} className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <span className="font-semibold text-gray-900 text-sm">{meta.label}</span>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${rs.bg} ${rs.text}`}>
                    {rLevel}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${score}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-12 text-right">
                    {score}/100
                  </span>
                </div>
                {finding && (
                  <p className="text-xs text-gray-500 mt-2">{finding.finding}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {report?.recommendations?.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
          <div className="space-y-3">
            {report.recommendations.map((rec: string, i: number) => (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-green-50 border border-green-100 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">AI Eye Image Analysis</h2>
        <p className="text-sm text-gray-500 mb-4">
          Upload a fundus photo, prescription, or eye symptom photo for Qwen2.5-VL visual analysis.
        </p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {['general', 'fundus', 'prescription', 'symptom'].map((type) => (
            <button
              key={type}
              onClick={() => setAnalysisType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                analysisType === type
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={imageLoading}
          className="w-full py-3 border-2 border-dashed border-green-300 rounded-xl text-sm text-green-700 font-medium hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {imageLoading ? 'Qwen is analysing your image...' : '+ Upload image for visual analysis'}
        </button>
        {imageAnalysis && (
          <div className="mt-4 bg-white rounded-xl p-4 border border-green-100">
            {imageAnalysis.error ? (
              <p className="text-red-600 text-sm">{imageAnalysis.error}</p>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">
                  Qwen2.5-VL {imageAnalysis.analysis_type} analysis
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{imageAnalysis.findings}</p>
                <p className="text-xs text-gray-400 mt-3 italic">{imageAnalysis.disclaimer}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong>Important:</strong> This screening uses Qwen2.5-VL-3B-Instruct running locally.
          Results are for informational purposes only and do not constitute a medical diagnosis.
          Always consult a qualified ophthalmologist or optometrist for clinical evaluation.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          to="/screening"
          className="flex-1 text-center py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:border-green-400 transition-colors"
        >
          Retake screening
        </Link>
        <button
          onClick={() => window.print()}
          className="flex-1 py-3.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
        >
          Save / Print
        </button>
      </div>
    </div>
  )
}