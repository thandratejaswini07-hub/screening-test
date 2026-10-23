
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
      className={`rounded-xl border ${interactive ? 'cursor-crosshair' : ''}`}
      style={{ background: '#ffffff', border: '1px solid rgba(255,255,255,0.15)' }}
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

const cardStyle = {
  background: 'rgba(17,31,54,0.7)',
  border: '1px solid rgba(61,139,255,0.12)',
  backdropFilter: 'blur(8px)',
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <span
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-6"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          Test 5 of 5  Central Visual Field
        </span>
        <h2 className="text-2xl font-bold text-white mb-4">Amsler Grid Test</h2>
        <div className="rounded-2xl p-5 mb-5 text-left space-y-3" style={cardStyle}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You will see a grid with a <strong className="text-white">dot in the centre</strong>.
            Fix your gaze on the dot and <strong className="text-white">do not move your eyes</strong> — the camera verifies this.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            While looking only at the dot, notice whether any lines appear wavy or any area is missing.
          </p>
          <p className="text-sm font-medium" style={{ color: '#f59e0b' }}>
            Wear reading glasses for this test if you use them.
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
          className="btn-accent mt-5 w-full py-4 rounded-xl font-semibold text-sm"
        >
          View Amsler Grid
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
        <h3 className="text-lg font-semibold text-white">All 5 tests complete</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Generating your AI report...</p>
      </div>
    </div>
  )

  if (phase === 'marking') return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 py-6">
      <p className="text-base font-medium text-white mb-1 text-center">
        Tap the areas that appear missing or dark
      </p>
      <p className="text-sm mb-4 text-center" style={{ color: 'var(--text-muted)' }}>Tap again to deselect</p>
      <div className="mb-5">
        <AmslerGrid marks={marks} onMark={toggleMark} interactive={true} size={320}/>
      </div>
      {marks.length > 0 && (
        <p className="text-sm mb-3" style={{ color: '#22c55e' }}>
          {marks.length} area{marks.length > 1 ? 's' : ''} marked
        </p>
      )}
      <button
        onClick={() => finish(distorted!, true)}
        className="btn-accent w-full max-w-xs py-4 rounded-2xl font-semibold text-sm"
      >
        Confirm
      </button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex gap-4">

      <div className="flex-1 flex flex-col items-center">

        {/* Fixation warning */}
        {!fixationOk && (
          <div
            className="w-full rounded-xl p-2 mb-3 text-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
              Fix your gaze on the centre dot — do not move your eyes
            </p>
          </div>
        )}

        {fixationWarnings > 0 && (
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Fixation breaks: {fixationWarnings}
            {fixationWarnings > 3 ? ' — try to keep gaze steady' : ''}
          </p>
        )}

        <p className="text-xs mb-3 text-center" style={{ color: 'var(--text-muted)' }}>
          <strong className="text-white">Fix gaze on the centre dot.</strong> Sit approximately 30 cm from screen.
        </p>

        <div className="mb-5">
          <AmslerGrid marks={[]} onMark={() => {}} interactive={false} size={320}/>
        </div>

        {distorted === null ? (
          <>
            <p className="text-base font-medium text-white mb-4 text-center">
              Do any lines appear wavy or distorted?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setDistorted(true)}
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
                Yes — wavy
              </button>
              <button
                onClick={() => setDistorted(false)}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.2)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.12)'}
              >
                No — straight
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-base font-medium text-white mb-4 text-center">
              Is any area missing, dark, or blurry?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setPhase('marking')}
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
                Yes — missing area
              </button>
              <button
                onClick={() => finish(distorted!, false)}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.2)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.12)'}
              >
                No — all visible
              </button>
            </div>
          </>
        )}
      </div>

      <div className="w-44 flex-shrink-0 flex flex-col gap-2">
        <CameraPanel
          canvasRef={camera.canvasRef} videoRef={camera.videoRef}
          faceData={camera.faceData} cameraActive={camera.cameraActive}
          cameraError={camera.cameraError} onStart={camera.startCamera}
          onStop={camera.stopCamera} compact={true} testName="Amsler"
        />

        {camera.faceData.detected && (
          <div
            className="text-xs text-center px-2 py-1.5 rounded-lg font-medium"
            style={
              fixationOk
                ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }
                : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }
            }
          >
            {fixationOk ? 'Fixation stable' : 'Look at centre dot'}
          </div>
        )}

        {camera.faceData.distanceCm && (
          <div
            className="text-xs text-center px-2 py-1 rounded-lg"
            style={
              camera.faceData.distanceCm >= 25 && camera.faceData.distanceCm <= 40
                ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e' }
                : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
            }
          >
            {camera.faceData.distanceCm}cm
            {camera.faceData.distanceCm < 25 ? ' — move back' :
             camera.faceData.distanceCm > 40 ? ' — move closer' : ''}
          </div>
        )}
      </div>
    </div>
  )
}