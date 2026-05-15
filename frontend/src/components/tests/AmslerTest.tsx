/**
 * AmslerTest.tsx — Amsler Grid Test
 * ════════════════════════════════════
 * Camera monitors:
 *   - Fixation on centre dot (most critical — must not move gaze)
 *   - Both eyes open
 *   - Distance from screen (~30cm for this test)
 *   - Detects if patient scans the grid (invalidates test)
 *
 * Clinical note: Amsler grid REQUIRES strict central fixation.
 * If the patient scans the grid, the test is invalid.
 * The camera gaze tracking enforces this clinically.
 */

import { useState, useEffect, useRef } from 'react'
import { useScreeningStore } from '../../store/useScreeningStore'
import { scoreAmsler } from '../../utils/scoring'
import { useCamera } from '../../hooks/useCamera'
import CameraPanel from '../../ui/CameraPanel'

interface Mark { x: number; y: number }

function AmslerGrid({ marks, onMark, interactive, size = 300 }: {
  marks:       Mark[]
  onMark:      (x: number, y: number) => void
  interactive: boolean
  size?:       number
}) {
  const cells = 10
  const step  = size / cells

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive) return
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    onMark(
      Math.floor((e.clientX - rect.left) / step),
      Math.floor((e.clientY - rect.top)  / step)
    )
  }

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`bg-white rounded-xl border border-gray-200 ${interactive ? 'cursor-crosshair' : ''}`}
      onClick={handleClick}
    >
      {/* Grid lines */}
      {Array.from({ length: cells + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i*step} y1={0} x2={i*step} y2={size} stroke="#222" strokeWidth="0.7"/>
      ))}
      {Array.from({ length: cells + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i*step} x2={size} y2={i*step} stroke="#222" strokeWidth="0.7"/>
      ))}

      {/* Marked areas */}
      {marks.map((m, i) => (
        <rect key={i}
          x={m.x*step} y={m.y*step} width={step} height={step}
          fill="rgba(220,38,38,0.2)" stroke="rgba(220,38,38,0.6)" strokeWidth="1"
        />
      ))}

      {/* Centre fixation dot */}
      <circle cx={size/2} cy={size/2} r={6} fill="#111827"/>
      <circle cx={size/2} cy={size/2} r={2} fill="white"/>
    </svg>
  )
}

export default function AmslerTest() {
  const { setTestResult, nextStep } = useScreeningStore()
  const camera = useCamera()

  const [phase,      setPhase]     = useState<'intro' | 'testing' | 'marking' | 'done'>('intro')
  const [distorted,  setDistorted] = useState<boolean | null>(null)
  const [marks,      setMarks]     = useState<Mark[]>([])
  const [fixationOk, setFixationOk] = useState(true)
  const [fixationWarnings, setFixationWarnings] = useState(0)
  const fixationRef = useRef(0)

  const toggleMark = (x: number, y: number) =>
    setMarks(p => p.find(m => m.x===x && m.y===y)
      ? p.filter(m => !(m.x===x && m.y===y))
      : [...p, {x, y}]
    )

  // Fixation monitoring — most critical part of Amsler test
  useEffect(() => {
    if (phase !== 'testing') return
    if (!camera.faceData.detected) return

    const ok = camera.faceData.gazeOnScreen
    setFixationOk(ok)

    if (!ok) {
      fixationRef.current += 1
      setFixationWarnings(fixationRef.current)
    }
  }, [camera.faceData.gazeOnScreen, phase])

  const finish = (d: boolean, m: boolean) => {
    const scored = scoreAmsler(d, m)
    setTestResult('amsler', {
      testId:          'amsler',
      normalizedScore: scored.score,
      rawData: {
        distorted:        d,
        missingArea:      m,
        markedAreas:      marks,
        blinkRate:        camera.faceData.blinkRate,
        distanceCm:       camera.faceData.distanceCm,
        fixationWarnings: fixationRef.current,
        gazeVerified:     fixationRef.current === 0,
      },
      flags: [
        ...scored.flags,
        ...(fixationRef.current > 3 ? ['fixation_unstable'] : []),
      ],
      completedAt: new Date().toISOString(),
    })
    camera.stopCamera()
    setPhase('done')
    setTimeout(() => nextStep(), 1500)
  }

  if (phase === 'intro') return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-lg w-full text-center">
        <span className="inline-block bg-red-50 text-red-600 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Test 5 of 5 · Central Visual Field
        </span>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Amsler Grid Test</h2>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 text-left space-y-3">
          <p className="text-sm text-gray-600">
            You will see a grid with a <strong>dot in the centre</strong>.
            Fix your gaze on the dot and <strong>do not move your eyes</strong> — the camera verifies this.
          </p>
          <p className="text-sm text-gray-600">
            While looking only at the dot, notice whether any lines appear wavy or any area is missing.
          </p>
          <p className="text-sm font-medium text-amber-600">
            ⚠️ Wear reading glasses for this test if you use them.
          </p>
        </div>
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} testName="Amsler"
        />
        <button
          onClick={() => { fixationRef.current = 0; setPhase('testing') }}
          className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-2xl transition-colors"
        >
          View Amsler grid →
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
        <h3 className="text-xl font-semibold text-gray-900">All 5 tests complete!</h3>
        <p className="text-gray-500 mt-2">Generating your AI report...</p>
      </div>
    </div>
  )

  if (phase === 'marking') return (
    <div className="flex flex-col items-center min-h-[70vh] px-4 py-6">
      <p className="text-base font-medium text-gray-900 mb-2 text-center">
        Tap the areas that appear missing or dark
      </p>
      <p className="text-sm text-gray-400 mb-4 text-center">Tap again to deselect</p>
      <div className="mb-5">
        <AmslerGrid marks={marks} onMark={toggleMark} interactive={true} size={320}/>
      </div>
      {marks.length > 0 && (
        <p className="text-sm text-green-600 mb-3">{marks.length} area{marks.length > 1 ? 's' : ''} marked</p>
      )}
      <button
        onClick={() => finish(distorted!, true)}
        className="w-full max-w-xs py-4 rounded-2xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
      >
        Confirm →
      </button>
    </div>
  )

  // Testing phase
  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex gap-4">

      {/* Left — test */}
      <div className="flex-1 flex flex-col items-center">

        {/* Fixation warning */}
        {!fixationOk && (
          <div className="w-full bg-red-50 border border-red-200 rounded-xl p-2 mb-3 text-center">
            <p className="text-xs text-red-700 font-medium">
              ⚠️ Fix your gaze on the centre dot — do not move your eyes
            </p>
          </div>
        )}

        {/* Fixation counter */}
        {fixationWarnings > 0 && (
          <p className="text-xs text-gray-400 mb-2">
            Fixation breaks: {fixationWarnings}
            {fixationWarnings > 3 ? ' — try to keep gaze steady' : ''}
          </p>
        )}

        <p className="text-xs text-gray-500 mb-3 text-center">
          <strong>Fix gaze on the centre dot.</strong> Sit ~30cm from screen.
        </p>

        <div className="mb-5">
          <AmslerGrid marks={[]} onMark={() => {}} interactive={false} size={320}/>
        </div>

        {distorted === null ? (
          <>
            <p className="text-base font-medium text-gray-900 mb-4 text-center">
              Do any lines appear wavy or distorted?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setDistorted(true)}
                className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:border-green-400 transition-colors"
              >
                Yes — wavy
              </button>
              <button
                onClick={() => setDistorted(false)}
                className="flex-1 py-3.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
              >
                No — straight
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-base font-medium text-gray-900 mb-4 text-center">
              Is any area missing, dark, or blurry?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setPhase('marking')}
                className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:border-green-400 transition-colors"
              >
                Yes — missing area
              </button>
              <button
                onClick={() => finish(distorted!, false)}
                className="flex-1 py-3.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
              >
                No — all visible
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right — camera */}
      <div className="w-44 flex-shrink-0 flex flex-col gap-2">
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} compact={true} testName="Amsler"
        />

        {/* Fixation status */}
        {camera.faceData.detected && (
          <div className={`text-xs text-center px-2 py-1.5 rounded-lg font-medium ${
            fixationOk
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {fixationOk ? '✓ Fixation stable' : '⚠ Look at centre dot'}
          </div>
        )}

        {/* Distance for Amsler (30cm ideal) */}
        {camera.faceData.distanceCm && (
          <div className={`text-xs text-center px-2 py-1 rounded-lg ${
            camera.faceData.distanceCm >= 25 && camera.faceData.distanceCm <= 40
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {camera.faceData.distanceCm}cm
            {camera.faceData.distanceCm < 25 ? ' — move back' :
             camera.faceData.distanceCm > 40 ? ' — move closer' : ' ✓'}
          </div>
        )}
      </div>
    </div>
  )
}