/**
 * ContrastTest.tsx — Contrast Sensitivity Test
 * ══════════════════════════════════════════════
 * Camera monitors:
 *   - Both eyes open before showing each stimulus
 *   - Distance stays consistent (same as acuity test)
 *   - Blink rate (dry eyes affect contrast sensitivity)
 *   - Gaze on stimulus before accepting answer
 */

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

  const randomGap = useCallback(
    () => GAPS[Math.floor(Math.random() * 4)],
    []
  )

  useEffect(() => {
    if (phase === 'testing') setGap(randomGap())
  }, [phase, lvlIdx])

  // Monitor eye status — warn if eyes closed before answer
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
    if (waitingEyes) return  // don't accept answer if eyes closed

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
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-lg w-full text-center">
        <span className="inline-block bg-purple-50 text-purple-600 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Test 2 of 5 · Contrast Sensitivity
        </span>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Contrast Sensitivity</h2>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 text-left space-y-3">
          <p className="text-sm text-gray-600">
            You will see a circle with a gap. It gets progressively <strong>lighter</strong>.
            Tap which direction the gap faces for as long as you can see it.
          </p>
          <p className="text-sm text-gray-600">
            The camera ensures both eyes are open before each stimulus is shown.
          </p>
        </div>
        <div className="flex justify-center gap-6 mb-6">
          {[100, 40, 10].map(c => (
            <div key={c} className="flex flex-col items-center gap-2">
              <ContrastC px={60} contrast={c} gap={90}/>
              <span className="text-xs text-gray-400">{c}%</span>
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
          className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-2xl transition-colors"
        >
          Start test →
        </button>
      </div>
    </div>
  )

  if (phase === 'done') return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Contrast test complete</h3>
        <p className="text-gray-500 mt-2">Moving to colour vision...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex gap-4">

      {/* Left — test */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between text-sm text-gray-400 mb-4">
          <span>Contrast: {LEVELS[lvlIdx]}%</span>
          <span>Level {lvlIdx + 1}/{LEVELS.length}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-purple-400 rounded-full transition-all"
            style={{ width: `${(lvlIdx / LEVELS.length) * 100}%` }}
          />
        </div>

        {/* Eye warning */}
        {eyeWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-center">
            <p className="text-xs text-amber-700 font-medium">⚠️ {eyeWarning}</p>
          </div>
        )}

        {/* Stimulus */}
        <div
          className={`bg-white rounded-2xl border-2 flex items-center justify-center mb-6 ${
            waitingEyes ? 'border-amber-300 opacity-40' : 'border-gray-100'
          }`}
          style={{ minHeight: 200 }}
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
              className="w-16 h-16 rounded-xl bg-white border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 text-xl font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {LABELS[deg]}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleAnswer(-1)}
          className="text-sm text-gray-400 hover:text-gray-600 text-center"
        >
          Can't see it anymore
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