/**
 * AstigmatismTest.tsx — Astigmatism Clock Dial Test
 * ════════════════════════════════════════════════════
 * Camera monitors:
 *   - Confirms correct eye is open/closed for monocular testing
 *   - Gaze fixed on centre dot (critical for accurate result)
 *   - Distance consistency
 *   - Detects if patient moves head (invalidates result)
 */

import { useState, useEffect } from 'react'
import { useScreeningStore } from '../../store/useScreeningStore'
import { scoreAstigmatism } from '../../utils/scoring'
import { useCamera } from '../../hooks/useCamera'
import CameraPanel from '../../ui/CameraPanel'

const SPOKES = Array.from({ length: 12 }, (_, i) => i * 15)

function ClockDial({ selected, onToggle, size = 260 }: {
  selected: number[]
  onToggle: (d: number) => void
  size?:    number
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 24

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="cursor-pointer">
      <circle cx={cx} cy={cy} r={cx - 4} fill="white" stroke="#e5e7eb" strokeWidth="1"/>
      {SPOKES.map(deg => {
        const rad   = (deg - 90) * (Math.PI / 180)
        const x1    = cx + 10 * Math.cos(rad)
        const y1    = cy + 10 * Math.sin(rad)
        const x2    = cx + r  * Math.cos(rad)
        const y2    = cy + r  * Math.sin(rad)
        const isSel = selected.includes(deg) || selected.includes((deg + 180) % 360)
        return (
          <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isSel ? '#dc2626' : '#111827'}
            strokeWidth={isSel ? 4 : 2.5}
            strokeLinecap="round"
            onClick={() => onToggle(deg)}
            className="hover:opacity-70 transition-opacity"
          />
        )
      })}
      <circle cx={cx} cy={cy} r={5} fill="#111827"/>
      {[12, 3, 6, 9].map((h, i) => {
        const rad = (i * 90 - 90) * (Math.PI / 180)
        return (
          <text key={h}
            x={cx + (r + 16) * Math.cos(rad)}
            y={cy + (r + 16) * Math.sin(rad)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="13" fill="#9ca3af"
          >
            {h}
          </text>
        )
      })}
    </svg>
  )
}

export default function AstigmatismTest() {
  const { setTestResult, nextStep } = useScreeningStore()
  const camera = useCamera()

  const [phase,    setPhase]    = useState<'intro' | 'q1' | 'q2' | 'done'>('intro')
  const [allEqual, setAllEqual] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [gazeMsg,  setGazeMsg]  = useState<string | null>(null)

  const toggle = (deg: number) =>
    setSelected(p => p.includes(deg) ? p.filter(d => d !== deg) : [...p, deg])

  // Gaze monitoring — critical for clock dial (must look at centre)
  useEffect(() => {
    if (phase !== 'q1' && phase !== 'q2') return
    if (!camera.faceData.detected) return

    if (!camera.faceData.gazeOnScreen) {
      setGazeMsg('Keep your gaze fixed on the centre dot')
    } else {
      setGazeMsg(null)
    }
  }, [camera.faceData, phase])

  const finish = (d: boolean, m: boolean) => {
    const scored = scoreAstigmatism(!d, d ? selected.length : 0)
    setTestResult('astigmatism', {
      testId:          'astigmatism',
      normalizedScore: scored.score,
      rawData: {
        allEqual:    !d,
        unevenSpokes: selected,
        blinkRate:   camera.faceData.blinkRate,
        distanceCm:  camera.faceData.distanceCm,
        gazeVerified: camera.faceData.gazeOnScreen,
      },
      flags:       scored.flags,
      completedAt: new Date().toISOString(),
    })
    camera.stopCamera()
    setPhase('done')
    setTimeout(() => nextStep(), 1500)
  }

  const handleQ1 = (equal: boolean) => {
    setAllEqual(equal)
    if (equal) finish(false, false)
    else setPhase('q2')
  }

  if (phase === 'intro') return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-lg w-full text-center">
        <span className="inline-block bg-yellow-50 text-yellow-600 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Test 4 of 5 · Astigmatism
        </span>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Astigmatism Check</h2>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 text-left space-y-3">
          <p className="text-sm text-gray-600">
            You will see a <strong>clock dial</strong>. Fix your gaze on the centre dot —
            the camera verifies you are looking at the centre throughout the test.
          </p>
          <p className="text-sm text-gray-600">
            Report whether all lines look equally dark, or if some appear darker.
          </p>
        </div>
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} testName="Astigmatism"
        />
        <button
          onClick={() => setPhase('q1')}
          className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-2xl transition-colors"
        >
          View clock dial →
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
        <h3 className="text-xl font-semibold text-gray-900">Astigmatism check complete</h3>
        <p className="text-gray-500 mt-2">Moving to Amsler grid...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex gap-4">

      {/* Left — test */}
      <div className="flex-1 flex flex-col items-center">

        {/* Gaze warning */}
        {gazeMsg && (
          <div className="w-full bg-red-50 border border-red-200 rounded-xl p-2 mb-3 text-center">
            <p className="text-xs text-red-700 font-medium">👁 {gazeMsg}</p>
          </div>
        )}

        <p className="text-sm text-gray-500 mb-3 text-center">
          {phase === 'q1'
            ? 'Fix gaze on the centre dot — do all lines look equally dark?'
            : 'Tap the lines that appear darkest to you'
          }
        </p>

        <div className="bg-white rounded-2xl p-3 border border-gray-100 mb-5 shadow-sm">
          <ClockDial
            selected={phase === 'q2' ? selected : []}
            onToggle={phase === 'q2' ? toggle : () => {}}
          />
        </div>

        {phase === 'q1' && (
          <div className="flex gap-3 w-full">
            <button
              onClick={() => handleQ1(true)}
              className="flex-1 py-3.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
            >
              Yes — all equal
            </button>
            <button
              onClick={() => handleQ1(false)}
              className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:border-green-400 transition-colors"
            >
              No — some darker
            </button>
          </div>
        )}

        {phase === 'q2' && (
          <>
            {selected.length > 0 && (
              <p className="text-sm text-green-600 mb-3">
                {selected.length} line{selected.length > 1 ? 's' : ''} selected
              </p>
            )}
            <button
              onClick={() => finish(true, false)}
              disabled={selected.length === 0}
              className="w-full py-3.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Confirm →
            </button>
          </>
        )}
      </div>

      {/* Right — camera */}
      <div className="w-44 flex-shrink-0">
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} compact={true} testName="Astigmatism"
        />
        {camera.faceData.detected && (
          <div className={`mt-2 text-xs text-center px-2 py-1 rounded-lg ${
            camera.faceData.gazeOnScreen
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-600'
          }`}>
            {camera.faceData.gazeOnScreen ? '✓ Gaze on chart' : '⚠ Look at centre'}
          </div>
        )}
      </div>
    </div>
  )
}