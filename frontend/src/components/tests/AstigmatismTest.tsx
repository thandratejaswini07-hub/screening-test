
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

const cardStyle = {
  background: 'rgba(17,31,54,0.7)',
  border: '1px solid rgba(61,139,255,0.12)',
  backdropFilter: 'blur(8px)',
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <span
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-6"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}
        >
          Test 4 of 5  Astigmatism
        </span>
        <h2 className="text-2xl font-bold text-white mb-4">Astigmatism Check</h2>
        <div className="rounded-2xl p-5 mb-5 text-left space-y-3" style={cardStyle}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You will see a <strong className="text-white">clock dial</strong>. Fix your gaze on the centre dot —
            the camera verifies you are looking at the centre throughout the test.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
          className="btn-accent mt-5 w-full py-4 rounded-xl font-semibold text-sm"
        >
          View Clock Dial
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
        <h3 className="text-lg font-semibold text-white">Astigmatism check complete</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Moving to Amsler grid...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex gap-4">

      <div className="flex-1 flex flex-col items-center">

        {/* Gaze warning */}
        {gazeMsg && (
          <div
            className="w-full rounded-xl p-2 mb-3 text-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <p className="text-xs font-medium" style={{ color: '#ef4444' }}>{gazeMsg}</p>
          </div>
        )}

        <p className="text-sm mb-3 text-center" style={{ color: 'var(--text-muted)' }}>
          {phase === 'q1'
            ? 'Fix gaze on the centre dot — do all lines look equally dark?'
            : 'Tap the lines that appear darkest to you'
          }
        </p>

        <div className="rounded-2xl p-3 mb-5" style={{ background: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
          <ClockDial
            selected={phase === 'q2' ? selected : []}
            onToggle={phase === 'q2' ? toggle : () => {}}
          />
        </div>

        {phase === 'q1' && (
          <div className="flex gap-3 w-full">
            <button
              onClick={() => handleQ1(true)}
              className="flex-1 py-3.5 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.25)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.15)'}
            >
              Yes — all equal
            </button>
            <button
              onClick={() => handleQ1(false)}
              className="flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(17,31,54,0.9)', border: '1px solid rgba(61,139,255,0.2)', color: 'var(--text-muted)' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(61,139,255,0.2)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
              }}
            >
              No — some darker
            </button>
          </div>
        )}

        {phase === 'q2' && (
          <>
            {selected.length > 0 && (
              <p className="text-sm mb-3" style={{ color: '#22c55e' }}>
                {selected.length} line{selected.length > 1 ? 's' : ''} selected
              </p>
            )}
            <button
              onClick={() => finish(true, false)}
              disabled={selected.length === 0}
              className="btn-accent w-full py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </>
        )}
      </div>

      <div className="w-44 flex-shrink-0">
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} compact={true} testName="Astigmatism"
        />
        {camera.faceData.detected && (
          <div
            className="mt-2 text-xs text-center px-2 py-1 rounded-lg"
            style={
              camera.faceData.gazeOnScreen
                ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }
                : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }
            }
          >
            {camera.faceData.gazeOnScreen ? 'Gaze on chart' : 'Look at centre'}
          </div>
        )}
      </div>
    </div>
  )
}