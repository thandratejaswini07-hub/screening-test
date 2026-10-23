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

const cardStyle = {
  background: 'rgba(17,31,54,0.7)',
  border: '1px solid rgba(61,139,255,0.12)',
  backdropFilter: 'blur(8px)',
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <span
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-6"
          style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}
        >
          Test 3 of 5  Colour Vision
        </span>
        <h2 className="text-2xl font-bold text-white mb-4">Colour Vision Test</h2>
        <div className="rounded-2xl p-5 mb-5 text-left space-y-3" style={cardStyle}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Dot patterns with a <strong className="text-white">number hidden inside</strong>. Tap the number you see.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Keep <strong className="text-white">both eyes open</strong>. The camera confirms both eyes are open before each plate.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
        <h3 className="text-lg font-semibold text-white">Colour vision complete</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Moving to astigmatism check...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex gap-4">

      {/* Left — test */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full flex justify-between text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          <span>Plate {plateIdx + 1} of {PLATES.length}</span>
          {plateIdx === 0 && <span style={{ color: 'var(--success)' }}>Demonstration plate</span>}
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden mb-4" style={{ background: 'rgba(168,85,247,0.1)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(plateIdx / PLATES.length) * 100}%`,
              background: 'linear-gradient(90deg,#a855f7,#5c67f2)',
              boxShadow: '0 0 8px rgba(168,85,247,0.5)',
            }}
          />
        </div>

        {/* Eye warning */}
        {eyeMsg && (
          <div
            className="w-full rounded-xl p-2 mb-3 text-center"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <p className="text-xs" style={{ color: '#f59e0b' }}>{eyeMsg}</p>
          </div>
        )}

        {/* Plate */}
        <div
          className="rounded-full overflow-hidden mb-5 shadow-xl"
          dangerouslySetInnerHTML={{ __html: plateSVG }}
          style={{ width: 240, height: 240, border: '2px solid rgba(255,255,255,0.1)' }}
        />

        {/* Answer buttons */}
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs mb-3">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              className="py-3 rounded-xl text-xl font-bold text-white transition-all"
              style={{
                background: 'rgba(17,31,54,0.9)',
                border: '1px solid rgba(61,139,255,0.2)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(61,139,255,0.15)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(61,139,255,0.25)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(17,31,54,0.9)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(61,139,255,0.2)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
            >
              {opt}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleAnswer('none')}
          className="text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          Cannot see a number
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