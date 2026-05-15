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
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-lg w-full text-center">
        <span className="inline-block bg-blue-50 text-blue-600 text-xs font-medium px-3 py-1 rounded-full mb-6">
          Test 1 of 5 · Visual Acuity
        </span>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Visual Acuity Test</h2>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-8 text-left space-y-3">
          <p className="text-sm text-gray-600">You will see a <strong>Landolt C</strong> — a circle with a gap. Tap the button showing which direction the gap faces.</p>
          <p className="text-sm text-gray-600">The C gets smaller each row. Stop when you can no longer read it.</p>
          <p className="text-sm text-gray-600">Sit approximately <strong>60 cm</strong> from your screen. Wear glasses if you normally use them.</p>
        </div>
        <button onClick={() => setPhase('testing')}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-10 py-3.5 rounded-xl transition-colors">
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
        <h3 className="text-xl font-semibold text-gray-900">Acuity test complete</h3>
        <p className="text-gray-500 mt-2">Moving to contrast test...</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col items-center min-h-[70vh] px-6 py-10">
      <div className="w-full max-w-lg mb-8">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Row {rowIdx + 1}/{SNELLEN.length} · {row.label}</span>
          <span>Letter {optIdx + 1}/{PER_ROW}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${((rowIdx * PER_ROW + optIdx) / (SNELLEN.length * PER_ROW)) * 100}%` }}/>
        </div>
      </div>

      <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-100 flex items-center justify-center mb-10" style={{ minHeight: 220 }}>
        <LandoltC sizeMm={Math.max(sizeMm, 5)} gapDeg={gap} ppm={ppm}/>
      </div>

      <div className="relative w-48 h-48">
        {GAP_POSITIONS.map(deg => {
          const rad = (deg - 90) * (Math.PI / 180)
          const x   = 50 + 43 * Math.cos(rad)
          const y   = 50 + 43 * Math.sin(rad)
          return (
            <button key={deg}
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
              className="absolute w-12 h-12 rounded-xl bg-white border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 text-lg font-bold transition-colors flex items-center justify-center"
              onClick={() => handleAnswer(deg)}>
              {GAP_LABELS[deg]}
            </button>
          )
        })}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-gray-400 text-center">Gap<br/>direction</span>
        </div>
      </div>
      <button onClick={() => handleAnswer(-1)} className="mt-6 text-sm text-gray-400 hover:text-gray-600">
        Can't see the gap
      </button>
    </div>
  )
}