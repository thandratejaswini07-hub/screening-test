import { useState, useEffect, useCallback } from 'react'
import { useScreeningStore } from '../../store/useScreeningStore'
import { scoreContrast } from '../../utils/scoring'
import { useCamera } from '../../hooks/useCamera'
import CameraPanel from '../../ui/CameraPanel'

const GAPS   = [0, 90, 180, 270]
const LABELS: Record<number, string> = { 0: '↑', 90: '→', 180: '↓', 270: '←' }
const LEVELS = [100, 80, 60, 40, 25, 15, 8, 4, 2]

function ContrastC({ px, contrast, gap }: { px: number; contrast: number; gap: number }) {
  const sw    = px / 5
  const r     = (px - sw) / 2
  const cx    = px / 2
  const cy    = px / 2
  const rad   = (gap - 90) * (Math.PI / 180)
  const half  = Math.PI * 0.2
  const x1    = cx + r * Math.cos(rad - half)
  const y1    = cy + r * Math.sin(rad - half)
  const x2    = cx + r * Math.cos(rad + half)
  const y2    = cy + r * Math.sin(rad + half)
  const gray  = Math.round(255 - (contrast / 100) * (255 - 17))
  return (
    <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} style={{ display: 'block' }}>
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 1 0 ${x2} ${y2}`}
        fill="none"
        stroke={`rgb(${gray},${gray},${gray})`}
        strokeWidth={sw}
        strokeLinecap="butt"
      />
    </svg>
  )
}

const cardStyle = {
  background: 'rgba(17,31,54,0.7)',
  border: '1px solid rgba(61,139,255,0.12)',
  backdropFilter: 'blur(8px)',
}

export default function ContrastTest() {
  const { pixelsPerMm, setTestResult, nextStep } = useScreeningStore()
  const camera = useCamera()
  const ppm    = pixelsPerMm || 3.78
  const px     = Math.max(Math.round(8 * ppm), 80)

  const [lvlIdx,       setLvlIdx]       = useState(0)
  const [gap,          setGap]          = useState(0)
  const [total,        setTotal]        = useState(0)
  const [correct,      setCorrect]      = useState(0)
  const [phase,        setPhase]        = useState<'intro' | 'testing' | 'done'>('intro')
  const [eyeWarning,   setEyeWarning]   = useState<string | null>(null)
  const [waitingEyes,  setWaitingEyes]  = useState(false)

  const randomGap = useCallback(() => GAPS[Math.floor(Math.random() * 4)], [])

  useEffect(() => {
    if (phase === 'testing') setGap(randomGap())
  }, [phase, lvlIdx])

  useEffect(() => {
    if (phase !== 'testing') return
    if (!camera.faceData.detected) return

    if (!camera.faceData.leftEyeOpen && !camera.faceData.rightEyeOpen) {
      setEyeWarning('Both eyes are closed — please open your eyes')
      setWaitingEyes(true)
    } else if (!camera.faceData.leftEyeOpen) {
      setEyeWarning('Left eye appears closed')
      setWaitingEyes(false)
    } else if (!camera.faceData.rightEyeOpen) {
      setEyeWarning('Right eye appears closed')
      setWaitingEyes(false)
    } else {
      setEyeWarning(null)
      setWaitingEyes(false)
    }
  }, [camera.faceData, phase])

  const handleAnswer = (deg: number) => {
    if (waitingEyes) return

    const ok       = deg === gap
    const newTotal = total + 1
    const newCorr  = ok ? correct + 1 : correct
    setTotal(newTotal)
    setCorrect(newCorr)

    if (!ok || lvlIdx === LEVELS.length - 1) {
      const scored = scoreContrast(newCorr / newTotal)
      setTestResult('contrast', {
        testId:          'contrast',
        normalizedScore: scored.score,
        rawData: {
          lowestContrastPassed: LEVELS[ok ? lvlIdx : Math.max(0, lvlIdx - 1)],
          blinkRate:  camera.faceData.blinkRate,
          distanceCm: camera.faceData.distanceCm,
        },
        flags:       scored.flags,
        completedAt: new Date().toISOString(),
      })
      camera.stopCamera()
      setPhase('done')
      setTimeout(() => nextStep(), 1500)
    } else {
      setLvlIdx(i => i + 1)
      setGap(randomGap())
    }
  }

  if (phase === 'intro') return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <span
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-6"
          style={{ background: 'rgba(92,103,242,0.12)', color: '#5c67f2', border: '1px solid rgba(92,103,242,0.25)' }}
        >
          Test 2 of 5  Contrast Sensitivity
        </span>
        <h2 className="text-2xl font-bold text-white mb-4">Contrast Sensitivity</h2>
        <div className="rounded-2xl p-5 mb-5 text-left space-y-3" style={cardStyle}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You will see a ring with a gap. It gets progressively <strong className="text-white">lighter</strong>.
            Tap which direction the gap faces for as long as you can see it.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            The camera ensures both eyes are open before each stimulus is shown.
          </p>
        </div>
        <div className="flex justify-center gap-6 mb-5">
          {[100, 40, 10].map(c => (
            <div key={c} className="flex flex-col items-center gap-2">
              <div className="rounded-xl p-2" style={{ background: '#fff' }}>
                <ContrastC px={56} contrast={c} gap={90}/>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c}%</span>
            </div>
          ))}
        </div>
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} testName="Contrast"
        />
        <button
          onClick={() => setPhase('testing')}
          className="btn-accent mt-5 w-full py-4 rounded-xl font-semibold text-sm"
        >
          Start Test
        </button>
      </div>
    </div>
  )

  if (phase === 'done') return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white">Contrast test complete</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Moving to colour vision...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex gap-4">

      {/* Left — test */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          <span>Contrast: {LEVELS[lvlIdx]}%</span>
          <span>Level {lvlIdx + 1}/{LEVELS.length}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(92,103,242,0.1)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(lvlIdx / LEVELS.length) * 100}%`,
              background: 'linear-gradient(90deg,#5c67f2,#a855f7)',
              boxShadow: '0 0 8px rgba(92,103,242,0.5)',
            }}
          />
        </div>

        {/* Eye warning */}
        {eyeWarning && (
          <div
            className="rounded-xl p-3 mb-3 text-center"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>{eyeWarning}</p>
          </div>
        )}

        {/* Stimulus */}
        <div
          className="rounded-2xl flex items-center justify-center mb-6 transition-opacity"
          style={{
            minHeight: 200,
            background: '#ffffff',
            border: '1px solid rgba(255,255,255,0.08)',
            opacity: waitingEyes ? 0.3 : 1,
          }}
        >
          <ContrastC px={px} contrast={LEVELS[lvlIdx]} gap={gap}/>
        </div>

        {/* Direction buttons */}
        <div className="flex justify-center gap-3 mb-4">
          {GAPS.map(deg => (
            <button
              key={deg}
              onClick={() => handleAnswer(deg)}
              disabled={waitingEyes}
              className="w-14 h-14 rounded-xl text-lg font-bold transition-all"
              style={{
                background: 'rgba(17,31,54,0.9)',
                border: '1px solid rgba(61,139,255,0.2)',
                color: 'var(--text)',
                opacity: waitingEyes ? 0.4 : 1,
                cursor: waitingEyes ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!waitingEyes) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(61,139,255,0.15)'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(61,139,255,0.3)'
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(17,31,54,0.9)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(61,139,255,0.2)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
            >
              {LABELS[deg]}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleAnswer(-1)}
          className="text-sm text-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          Cannot see it anymore
        </button>
      </div>

      {/* Right — camera */}
      <div className="w-44 flex-shrink-0">
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} compact={true} testName="Contrast"
        />
      </div>
    </div>
  )
}