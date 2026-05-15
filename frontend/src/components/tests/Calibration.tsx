import { useEffect, useRef, useState } from 'react'
import { useScreeningStore } from '../../store/useScreeningStore'
import { useCamera } from '../../hooks/useCamera'
import CameraPanel from '../../ui/CameraPanel'

const SNELLEN_ROWS = [
  { snellen: '6/60',  logmar:  1.0, letters: ['E'],                                     size: 72 },
  { snellen: '6/36',  logmar:  0.8, letters: ['F', 'P'],                                size: 56 },
  { snellen: '6/24',  logmar:  0.6, letters: ['T', 'O', 'Z'],                           size: 44 },
  { snellen: '6/18',  logmar:  0.5, letters: ['L', 'P', 'E', 'D'],                      size: 36 },
  { snellen: '6/12',  logmar:  0.3, letters: ['P', 'E', 'C', 'F', 'D'],               size: 28 },
  { snellen: '6/9',   logmar:  0.2, letters: ['E', 'D', 'F', 'C', 'Z', 'P'],          size: 22 },
  { snellen: '6/6',   logmar:  0.0, letters: ['F', 'E', 'L', 'O', 'P', 'Z', 'D'],     size: 17 },
  { snellen: '6/5',   logmar: -0.1, letters: ['D', 'E', 'F', 'P', 'O', 'T', 'E', 'C'], size: 14 },
]

const LOGMAR_TO_NORM: Record<string, number> = {
  '-0.1': 100, '0': 95, '0.2': 85, '0.3': 75,
   '0.5':  60, '0.6': 50, '0.8': 35, '1.0': 20,
}

type TestEye   = 'right' | 'left' | 'both'
type TestPhase = 'intro' | 'setup' | 'testing' | 'done'

interface RowResult {
  snellen: string; logmar: number
  score: number; heard: string; skipped: boolean
}

function matchLetters(spoken: string, expected: string[]) {
  const cleaned  = spoken.toUpperCase().replace(/[^A-Z\s]/g, '').trim()
  const words    = cleaned.split(/\s+/).filter(Boolean)
  const chars    = cleaned.replace(/\s/g, '').split('')
  const strategy = words.length >= expected.length ? words : chars
  const matched  = expected.map((l, i) =>
    strategy[i] === l || words.includes(l) || chars.includes(l)
  )
  return {
    score: Math.round((matched.filter(Boolean).length / expected.length) * 100),
    heard: words.join(' ') || chars.join(''),
  }
}

function getAcuityScore(results: RowResult[]) {
  let best = -1
  results.forEach((r, i) => { if (r.score >= 60) best = i })
  const row = SNELLEN_ROWS[best >= 0 ? best : 0]
  return {
    normalizedScore: LOGMAR_TO_NORM[String(row.logmar)] ?? 50,
    logmar: row.logmar, snellen: row.snellen,
  }
}

function useSpeech(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim,   setInterim]   = useState('')
  const [supported, setSupported] = useState(true)
  const recRef   = useRef<any>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setSupported(false); return }
    const rec = new SR()
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'
    rec.onresult = (e: any) => {
      let interimT = '', finalT = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalT += t; else interimT += t
      }
      if (interimT) setInterim(interimT.toUpperCase())
      if (finalT) {
        setInterim('')
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          rec.stop(); setListening(false); onResult(finalT.trim())
        }, 500)
      }
    }
    rec.onerror = () => { setListening(false); setInterim('') }
    rec.onend   = () => { setListening(false); setInterim('') }
    recRef.current = rec
    return () => clearTimeout(timerRef.current)
  }, [onResult])

  const listen = () => {
    if (!recRef.current || listening) return
    setInterim(''); setListening(true)
    try { recRef.current.start() } catch (_) {}
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      recRef.current?.stop(); setListening(false); setInterim('')
    }, 8000)
  }

  const stop = () => {
    clearTimeout(timerRef.current)
    recRef.current?.stop(); setListening(false); setInterim('')
  }

  return { listening, interim, supported, listen, stop }
}

export default function Calibration() {
  const { setTestResult, nextStep } = useScreeningStore()
  const camera = useCamera()

  const [phase,       setPhase]       = useState<TestPhase>('intro')
  const [testEye,     setTestEye]     = useState<TestEye>('both')
  const [rowIdx,      setRowIdx]      = useState(0)
  const [rowResults,  setRowResults]  = useState<RowResult[]>([])
  const [feedback,    setFeedback]    = useState<{ text: string; ok: boolean } | null>(null)
  const [showButtons, setShowButtons] = useState(false)
  const [distanceOk,  setDistanceOk]  = useState(true)
  const rowIdxRef = useRef(0)

  useEffect(() => { rowIdxRef.current = rowIdx }, [rowIdx])
  useEffect(() => { return () => { camera.stopCamera() } }, [])
  useEffect(() => {
    if (!camera.faceData.distanceCm) return
    setDistanceOk(camera.faceData.distanceCm >= 45 && camera.faceData.distanceCm <= 80)
  }, [camera.faceData.distanceCm])

  const handleVoiceResult = useRef((spoken: string) => {
    const row = SNELLEN_ROWS[rowIdxRef.current]
    const { score, heard } = matchLetters(spoken, row.letters)
    const result: RowResult = { snellen: row.snellen, logmar: row.logmar, score, heard, skipped: false }
    setRowResults(prev => {
      const updated = [...prev, result]
      setFeedback({ text: `${score >= 60 ? '✓' : '✗'} Heard "${heard}" — ${score}% correct`, ok: score >= 60 })
      setTimeout(() => {
        setFeedback(null)
        const next   = rowIdxRef.current + 1
        const last2  = updated.slice(-2)
        const tooBad = last2.length === 2 && last2.every(r => r.score < 40)
        if (next >= SNELLEN_ROWS.length || tooBad) finishTest(updated)
        else setRowIdx(next)
      }, 1500)
      return updated
    })
  }).current

  const finishTest = (results: RowResult[]) => {
    const { normalizedScore, logmar, snellen } = getAcuityScore(results)
    let corrected = normalizedScore
    if (camera.faceData.distanceCm) {
      const ratio = 60 / camera.faceData.distanceCm
      corrected = Math.min(100, Math.round(normalizedScore * (1 + (ratio - 1) * 0.3)))
    }
    setTestResult('calibration', {
      testId: 'calibration', normalizedScore: corrected,
      flags: [
        ...(logmar >= 0.5 ? ['acuity_reduced']   : []),
        ...(logmar >= 0.8 ? ['referral_advised']  : []),
        ...(logmar >= 1.0 ? ['urgent_referral']   : []),
        ...(camera.faceData.blinkRate < 8 ? ['low_blink_rate'] : []),
      ],
      rawData: { results, logmar, snellen, eye: testEye, distanceCm: camera.faceData.distanceCm, corrected },
      completedAt: new Date().toISOString(),
    })
    camera.stopCamera()
    setPhase('done')
    setTimeout(() => nextStep(), 1500)
  }

  const skipRow = () => {
    const row = SNELLEN_ROWS[rowIdxRef.current]
    const result: RowResult = { snellen: row.snellen, logmar: row.logmar, score: 0, heard: '', skipped: true }
    setRowResults(prev => {
      const updated = [...prev, result]
      const next = rowIdxRef.current + 1
      if (next >= SNELLEN_ROWS.length) finishTest(updated)
      else setRowIdx(next)
      return updated
    })
  }

  const { listening, interim, supported, listen, stop } = useSpeech(handleVoiceResult)
  const currentRow = SNELLEN_ROWS[rowIdx]


  return (
    <>
      <video
        ref={camera.videoRef}
        autoPlay
        muted
        playsInline
        style={{ position: 'fixed', top: -9999, left: -9999, width: 640, height: 480, opacity: 0, pointerEvents: 'none' }}
      />

      {phase === 'intro' && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="max-w-lg w-full">
            <div className="text-center mb-6">
              <span className="inline-block bg-green-50 text-green-700 text-xs font-medium px-3 py-1 rounded-full mb-4">
                Test 1 of 5 · Visual Acuity
              </span>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Snellen Vision Test</h2>
              <p className="text-gray-500 leading-relaxed text-sm">
                Read each row of letters aloud. Camera monitors your position for accurate results.
                Letters get smaller — stop when you can't read them.
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-5 space-y-3">
              {[
                { icon: '', text: 'Sit 50–70cm from your screen' },
                { icon: '', text: 'Camera will track your eye position and distance' },
                { icon: '', text: 'Read each row aloud — say all letters you can see' },
                { icon: '', text: 'Wear glasses or contacts if you normally do' },
              ].map((tip, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="text-xl">{tip.icon}</span>
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setPhase('setup')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-2xl transition-colors text-lg"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ══ SETUP ══ */}
      {phase === 'setup' && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="max-w-lg w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Set up camera</h2>
            <div className="mb-6">
              <CameraPanel
                canvasRef={camera.canvasRef}
                videoRef={camera.videoRef}
                faceData={camera.faceData}
                cameraActive={camera.cameraActive}
                cameraError={camera.cameraError}
                onStart={camera.startCamera}
                onStop={camera.stopCamera}
                testName="Acuity setup"
              />
            </div>
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Which eyes are you testing?</p>
              <div className="grid grid-cols-3 gap-3">
                {(['both', 'right', 'left'] as TestEye[]).map(eye => (
                  <button
                    key={eye}
                    onClick={() => setTestEye(eye)}
                    className={`py-3 rounded-xl text-sm font-medium border-2 transition-colors ${
                      testEye === eye
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
                    }`}
                  >
                    {eye === 'both' ? 'Both eyes' : `${eye.charAt(0).toUpperCase() + eye.slice(1)} eye only`}
                  </button>
                ))}
              </div>
              {testEye !== 'both' && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  Cover your {testEye === 'right' ? 'left' : 'right'} eye with your palm — do not press on it
                </p>
              )}
            </div>
            {camera.faceData.detected && (
              <div className={`rounded-xl p-3 mb-4 text-center text-sm ${
                distanceOk
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-amber-50 border border-amber-200 text-amber-700'
              }`}>
                {distanceOk
                  ? `✓ Good position — ${camera.faceData.distanceCm}cm from screen`
                  : `Move ${camera.faceData.distanceCm! < 50 ? 'back' : 'closer'} — ${camera.faceData.distanceCm}cm (aim 50–70cm)`
                }
              </div>
            )}
            <button
              onClick={() => setPhase('testing')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-2xl transition-colors"
            >
              Start test →
            </button>
          </div>
        </div>
      )}

      {/* ══ DONE ══ */}
      {phase === 'done' && (
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Visual acuity complete</h3>
            <p className="text-gray-500 mt-2 text-sm">Moving to next test…</p>
          </div>
        </div>
      )}

      {/* ══ TESTING ══ */}
      {phase === 'testing' && (
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex gap-4">

            {/* Left — chart + controls */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between text-xs text-gray-400 mb-3">
                <span>Row {rowIdx + 1}/{SNELLEN_ROWS.length} · {currentRow.snellen}</span>
                <div className="flex gap-1">
                  {SNELLEN_ROWS.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full ${
                      i < rowIdx ? 'w-4 bg-green-400' :
                      i === rowIdx ? 'w-6 bg-green-600' : 'w-1.5 bg-gray-200'
                    }`}/>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm
                              flex-1 flex flex-col items-center justify-center gap-2">
                {SNELLEN_ROWS.map((row, i) => (
                  <div
                    key={i}
                    className={`font-black font-mono tracking-widest select-none transition-all ${
                      i === rowIdx ? 'text-gray-900' :
                      i < rowIdx   ? 'text-gray-300' : 'text-gray-200'
                    }`}
                    style={{ fontSize: row.size }}
                  >
                    {row.letters.join('  ')}
                  </div>
                ))}
              </div>

              {/* Feedback */}
              {feedback && (
                <div className={`rounded-xl p-3 mb-3 text-center text-sm font-medium ${
                  feedback.ok
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-orange-50 text-orange-700 border border-orange-200'
                }`}>
                  {feedback.text}
                </div>
              )}

              {/* Interim */}
              {interim && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 text-center">
                  <p className="text-xs text-blue-400 mb-1">Hearing...</p>
                  <p className="font-mono font-bold text-blue-700 text-xl tracking-widest">{interim}</p>
                </div>
              )}

              {/* Distance warning */}
              {camera.faceData.detected && !distanceOk && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 mb-3 text-center">
                  <p className="text-xs text-amber-700">
                    {camera.faceData.distanceCm! < 50 ? '↩ Move back' : '→ Move closer'} — {camera.faceData.distanceCm}cm
                  </p>
                </div>
              )}

              {/* Gaze warning */}
              {camera.faceData.detected && !camera.faceData.gazeOnScreen && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-2 mb-3 text-center">
                  <p className="text-xs text-red-700">👁 Look at the chart</p>
                </div>
              )}

              {/* Voice controls */}
              <div className="flex gap-2 mb-2">
                {!listening ? (
                  <button
                    onClick={listen}
                    disabled={!supported}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600
                               hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold
                               py-3.5 rounded-2xl transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                    </svg>
                    Read row aloud
                  </button>
                ) : (
                  <button
                    onClick={stop}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500
                               hover:bg-red-600 text-white font-semibold py-3.5 rounded-2xl
                               animate-pulse transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="8"/>
                    </svg>
                    Listening... tap to stop
                  </button>
                )}
                <button
                  onClick={skipRow}
                  className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-500
                             text-sm font-medium hover:bg-gray-50"
                >
                  Skip
                </button>
              </div>

              {/* Letter buttons fallback */}
              <button
                onClick={() => setShowButtons(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 py-1"
              >
                {showButtons ? '▲ Hide' : '▼ Show'} letter buttons
              </button>
              {showButtons && (
                <div className="flex flex-wrap gap-2 justify-center mt-2 p-3 bg-gray-50 rounded-xl">
                  {currentRow.letters.map((l, i) => (
                    <button
                      key={i}
                      onClick={() => handleVoiceResult(l)}
                      className="w-11 h-11 rounded-xl bg-white border-2 border-gray-200
                                 hover:border-green-500 font-bold text-lg transition-colors"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right — camera panel */}
            <div className="w-48 flex-shrink-0">
              <CameraPanel
                canvasRef={camera.canvasRef}
                videoRef={camera.videoRef}
                faceData={camera.faceData}
                cameraActive={camera.cameraActive}
                cameraError={camera.cameraError}
                onStart={camera.startCamera}
                onStop={camera.stopCamera}
                compact={true}
                testName="Acuity"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}