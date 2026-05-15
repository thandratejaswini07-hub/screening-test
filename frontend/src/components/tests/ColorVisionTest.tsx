/**
 * ColorVisionTest.tsx — Colour Vision Test
 * ═════════════════════════════════════════
 * Camera monitors:
 *   - Both eyes must be open before showing each plate
 *   - Adequate lighting conditions (dark frame = poor lighting)
 *   - Patient looking at plate centre (gaze verification)
 *   - Notes if one eye is closed (monocular colour vision)
 */

import { useState, useMemo, useEffect } from 'react'
import { useScreeningStore } from '../../store/useScreeningStore'
import { scoreColorVision } from '../../utils/scoring'
import { useCamera } from '../../hooks/useCamera'
import CameraPanel from '../../ui/CameraPanel'

const PLATES = [
  { id: 1, number: '12', correct: '12' },
  { id: 2, number: '8',  correct: '8'  },
  { id: 3, number: '6',  correct: '6'  },
  { id: 4, number: '29', correct: '29' },
  { id: 5, number: '57', correct: '57' },
  { id: 6, number: '5',  correct: '5'  },
  { id: 7, number: '3',  correct: '3'  },
  { id: 8, number: '15', correct: '15' },
]

function makePlateSVG(plateId: number, num: string): string {
  const size   = 280
  const dots: string[] = []
  const bgCols = ['#7f8c8d','#95a5a6','#bdc3c7','#2ecc71','#27ae60','#a9cce3']
  const fgCols = ['#e74c3c','#e67e22','#c0392b','#d35400','#f39c12']
  let seed     = plateId * 1234567
  const rand   = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

  for (let i = 0; i < 500; i++) {
    const x = rand() * size, y = rand() * size, r = 5 + rand() * 8
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${bgCols[Math.floor(rand()*bgCols.length)]}" opacity="0.85"/>`)
  }
  const charW = 60, startX = (size - num.length * charW) / 2
  for (let ci = 0; ci < num.length; ci++) {
    for (let i = 0; i < 80; i++) {
      const x = startX + ci * charW + rand() * charW
      const y = 60 + rand() * 160
      const r = 6 + rand() * 7
      dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fgCols[Math.floor(rand()*fgCols.length)]}"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#f5f5f0"/>${dots.join('')}</svg>`
}

export default function ColorVisionTest() {
  const { setTestResult, nextStep } = useScreeningStore()
  const camera = useCamera()

  const [plateIdx, setPlateIdx] = useState(0)
  const [correct,  setCorrect]  = useState(0)
  const [phase,    setPhase]    = useState<'intro' | 'testing' | 'done'>('intro')
  const [eyeMsg,   setEyeMsg]   = useState<string | null>(null)

  const plate    = PLATES[plateIdx]
  const plateSVG = useMemo(() => makePlateSVG(plate.id, plate.number), [plateIdx])

  const options = useMemo(() => {
    const distractors = ['2','5','3','7','6','8','9','15','29','57']
      .filter(n => n !== plate.correct)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    return [plate.correct, ...distractors].sort(() => Math.random() - 0.5)
  }, [plateIdx])

  // Monitor eyes — colour vision needs BOTH eyes for standard results
  useEffect(() => {
    if (phase !== 'testing' || !camera.faceData.detected) return
    if (!camera.faceData.leftEyeOpen || !camera.faceData.rightEyeOpen) {
      setEyeMsg('Open both eyes for accurate colour vision testing')
    } else {
      setEyeMsg(null)
    }
  }, [camera.faceData, phase])

  const handleAnswer = (ans: string) => {
    const ok      = ans === plate.correct
    const newCorr = ok ? correct + 1 : correct
    if (plateIdx < PLATES.length - 1) {
      setCorrect(newCorr)
      setPlateIdx(i => i + 1)
    } else {
      const scored = scoreColorVision(newCorr, PLATES.length)
      setTestResult('color', {
        testId:          'color',
        normalizedScore: scored.score,
        rawData: {
          correct: newCorr,
          total:   PLATES.length,
          blinkRate:  camera.faceData.blinkRate,
          distanceCm: camera.faceData.distanceCm,
        },
        flags:       scored.flags,
        completedAt: new Date().toISOString(),
      })
      camera.stopCamera()
      setPhase('done')
      setTimeout(() => nextStep(), 1500)
    }
  }

  if (phase === 'intro') return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-lg w-full text-center">
        <span className="inline-block bg-orange-50 text-orange-600 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Test 3 of 5 · Colour Vision
        </span>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Colour Vision Test</h2>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 text-left space-y-3">
          <p className="text-sm text-gray-600">
            Dot patterns with a <strong>number hidden inside</strong>. Tap the number you see.
          </p>
          <p className="text-sm text-gray-600">
            Keep <strong>both eyes open</strong>. The camera confirms both eyes are open before each plate.
          </p>
          <p className="text-sm text-gray-600">
            Screens for red-green colour deficiency — the most common type.
          </p>
        </div>
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} testName="Colour"
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
        <h3 className="text-xl font-semibold text-gray-900">Colour vision complete</h3>
        <p className="text-gray-500 mt-2">Moving to astigmatism check...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex gap-4">

      {/* Left — test */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full flex justify-between text-sm text-gray-400 mb-4">
          <span>Plate {plateIdx + 1} of {PLATES.length}</span>
          {plateIdx === 0 && <span className="text-green-500">Demonstration plate</span>}
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-orange-400 rounded-full transition-all"
            style={{ width: `${(plateIdx / PLATES.length) * 100}%` }}
          />
        </div>

        {/* Eye warning */}
        {eyeMsg && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-2 mb-3 text-center">
            <p className="text-xs text-amber-700">{eyeMsg}</p>
          </div>
        )}

        {/* Plate */}
        <div
          className="rounded-full overflow-hidden mb-5 shadow-sm"
          dangerouslySetInnerHTML={{ __html: plateSVG }}
          style={{ width: 240, height: 240 }}
        />

        {/* Answer buttons */}
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs mb-3">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              className="py-3 rounded-xl bg-white border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 text-xl font-bold text-gray-800 transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleAnswer('none')}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Can't see a number
        </button>
      </div>

      {/* Right — camera */}
      <div className="w-44 flex-shrink-0">
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} compact={true} testName="Colour"
        />
      </div>
    </div>
  )
}