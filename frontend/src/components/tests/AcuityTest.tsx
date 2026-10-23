import { useState, useEffect, useCallback } from 'react'
import { useScreeningStore }                from '../../store/useScreeningStore'
import { scoreAcuity, ACUITY_ROWS }         from '../../utils/scoring'

const GAP_POSITIONS = [0, 45, 90, 135, 180, 225, 270, 315]
const GAP_LABELS:    Record<number, string> = {
  0:'↑', 45:'↗', 90:'→', 135:'↘', 180:'↓', 225:'↙', 270:'←', 315:'↖'
}

const SNELLEN = [
  { label:'6/60',  arcmin:50 },{ label:'6/36', arcmin:30 },
  { label:'6/24',  arcmin:20 },{ label:'6/18', arcmin:15 },
  { label:'6/12',  arcmin:10 },{ label:'6/9',  arcmin:7.5 },
  { label:'6/7.5', arcmin:6.25},{ label:'6/6', arcmin:5 },
]
const ARCMIN_PER_MM = 5.714
const PER_ROW = 5

function LandoltC({ sizeMm, gapDeg, ppm }: { sizeMm:number; gapDeg:number; ppm:number }) {
  const px    = sizeMm * ppm
  const sw    = px / 5
  const r     = (px - sw) / 2
  const cx    = px / 2
  const cy    = px / 2
  const rad   = (gapDeg - 90) * (Math.PI / 180)
  const half  = Math.PI * 0.2
  const x1    = cx + r * Math.cos(rad - half)
  const y1    = cy + r * Math.sin(rad - half)
  const x2    = cx + r * Math.cos(rad + half)
  const y2    = cy + r * Math.sin(rad + half)
  return (
    <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}>
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 1 0 ${x2} ${y2}`}
        fill="none" stroke="#111" strokeWidth={sw} strokeLinecap="butt"/>
    </svg>
  )
}

const cardStyle = {
  background: 'rgba(17,31,54,0.7)',
  border: '1px solid rgba(61,139,255,0.12)',
  backdropFilter: 'blur(8px)',
}

export default function AcuityTest() {
  const { pixelsPerMm, setTestResult, nextStep } = useScreeningStore()
  const ppm = pixelsPerMm || 3.78

  const [rowIdx,     setRowIdx]     = useState(0)
  const [optIdx,     setOptIdx]     = useState(0)
  const [correct,    setCorrect]    = useState(0)
  const [gap,        setGap]        = useState(0)
  const [lastScore,  setLastScore]  = useState(ACUITY_ROWS[0].score)
  const [phase,      setPhase]      = useState<'intro'|'testing'|'done'>('intro')

  const randomGap = useCallback(() => GAP_POSITIONS[Math.floor(Math.random() * 8)], [])

  useEffect(() => { if (phase === 'testing') setGap(randomGap()) }, [phase, rowIdx, optIdx])

  const row = SNELLEN[rowIdx]
  const sizeMm = row.arcmin / ARCMIN_PER_MM

  const handleAnswer = (deg: number) => {
    const ok      = deg === gap
    const newCorr = ok ? correct + 1 : correct

    if (optIdx < PER_ROW - 1) {
      setOptIdx(i => i + 1)
      setCorrect(newCorr)
      setGap(randomGap())
    } else {
      if (newCorr >= 3 && rowIdx < SNELLEN.length - 1) {
        setLastScore(ACUITY_ROWS.find(r => r.label === row.label)?.score || lastScore)
        setRowIdx(i => i + 1)
        setOptIdx(0)
        setCorrect(0)
      } else {
        const finalScore = newCorr >= 3
          ? (ACUITY_ROWS.find(r => r.label === row.label)?.score || lastScore)
          : lastScore
        const scored = scoreAcuity(finalScore)
        setTestResult('acuity', {
          testId: 'acuity', normalizedScore: finalScore,
          rawData: { finalRow: row.label }, flags: scored.flags,
          completedAt: new Date().toISOString(),
        })
        setPhase('done')
        setTimeout(() => nextStep(), 1500)
      }
    }
  }

  if (phase === 'intro') return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <span
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-6"
          style={{ background: 'rgba(61,139,255,0.12)', color: 'var(--accent)', border: '1px solid rgba(61,139,255,0.25)' }}
        >
          Test 1 of 5  Visual Acuity
        </span>
        <h2 className="text-2xl font-bold text-white mb-4">Visual Acuity Test</h2>
        <div className="rounded-2xl p-5 mb-8 text-left space-y-3" style={cardStyle}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You will see a <strong className="text-white">Landolt C</strong> — a ring with a gap. Tap the button showing which direction the gap faces.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            The C gets smaller each row. Stop when you can no longer see it.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sit approximately <strong className="text-white">60 cm</strong> from your screen. Wear glasses if you normally use them.
          </p>
        </div>
        <button
          onClick={() => setPhase('testing')}
          className="btn-accent w-full py-4 rounded-xl font-semibold text-sm"
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
        <h3 className="text-lg font-semibold text-white">Acuity test complete</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Moving to contrast test...</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 py-6">
      <div className="w-full max-w-md mb-6">
        <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          <span>Row {rowIdx + 1}/{SNELLEN.length} · {row.label}</span>
          <span>Letter {optIdx + 1}/{PER_ROW}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(61,139,255,0.1)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${((rowIdx * PER_ROW + optIdx) / (SNELLEN.length * PER_ROW)) * 100}%`,
              background: 'linear-gradient(90deg,#3d8bff,#5c67f2)',
              boxShadow: '0 0 8px rgba(61,139,255,0.5)',
            }}
          />
        </div>
      </div>

      {/* Landolt C display */}
      <div
        className="w-full max-w-md rounded-2xl flex items-center justify-center mb-8"
        style={{ minHeight: 200, background: '#ffffff', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <LandoltC sizeMm={Math.max(sizeMm, 5)} gapDeg={gap} ppm={ppm}/>
      </div>

      {/* Direction buttons ring */}
      <div className="relative w-48 h-48">
        {GAP_POSITIONS.map(deg => {
          const rad = (deg - 90) * (Math.PI / 180)
          const x   = 50 + 43 * Math.cos(rad)
          const y   = 50 + 43 * Math.sin(rad)
          return (
            <button key={deg}
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
              className="absolute w-11 h-11 rounded-xl text-base font-bold transition-all flex items-center justify-center"
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(61,139,255,0.2)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(61,139,255,0.3)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(17,31,54,0.9)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(61,139,255,0.2)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              }}
              onClick={() => handleAnswer(deg)}
              style={{
                left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)',
                background: 'rgba(17,31,54,0.9)',
                border: '1px solid rgba(61,139,255,0.2)',
                color: 'var(--text)',
              } as React.CSSProperties}
            >
              {GAP_LABELS[deg]}
            </button>
          )
        })}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-center" style={{ color: 'var(--text-muted)', lineHeight: 1.3 }}>Gap<br/>direction</span>
        </div>
      </div>

      <button
        onClick={() => handleAnswer(-1)}
        className="mt-6 text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        Cannot see the gap
      </button>
    </div>
  )
}