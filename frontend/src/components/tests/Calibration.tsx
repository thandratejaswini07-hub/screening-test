import { useEffect, useRef, useState, useCallback } from 'react'
import { useScreeningStore } from '../../store/useScreeningStore'

const SNELLEN_ROWS = [
  { snellen: '6/60',  logmar:  1.0, letters: ['E'],                                        size: 72 },
  { snellen: '6/36',  logmar:  0.8, letters: ['F', 'P'],                                   size: 56 },
  { snellen: '6/24',  logmar:  0.6, letters: ['T', 'O', 'Z'],                              size: 44 },
  { snellen: '6/18',  logmar:  0.5, letters: ['L', 'P', 'E', 'D'],                         size: 36 },
  { snellen: '6/12',  logmar:  0.3, letters: ['P', 'E', 'C', 'F', 'D'],                    size: 28 },
  { snellen: '6/9',   logmar:  0.2, letters: ['E', 'D', 'F', 'C', 'Z', 'P'],              size: 22 },
  { snellen: '6/6',   logmar:  0.0, letters: ['F', 'E', 'L', 'O', 'P', 'Z', 'D'],         size: 17 },
  { snellen: '6/5',   logmar: -0.1, letters: ['D', 'E', 'F', 'P', 'O', 'T', 'E', 'C'],    size: 14 },
]

const LOGMAR_TO_NORM: Record<string, number> = {
  '-0.1': 100, '0': 95, '0.2': 85, '0.3': 75,
  '0.5':  60,  '0.6': 50, '0.8': 35, '1.0': 20,
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDIAPIPE LANDMARK INDICES
// ─────────────────────────────────────────────────────────────────────────────
const L_EYE_TOP   = 159
const L_EYE_BOT   = 145
const L_EYE_LEFT  = 33
const L_EYE_RIGHT = 133
const R_EYE_TOP   = 386
const R_EYE_BOT   = 374
const R_EYE_LEFT  = 362
const R_EYE_RIGHT = 263
const LEFT_EAR    = 234
const RIGHT_EAR   = 454
const NOSE_TIP    = 4

function calcEAR(lm: any[], top: number, bot: number, l: number, r: number): number {
  if (!lm[top] || !lm[bot] || !lm[l] || !lm[r]) return 0.3
  const vert  = Math.hypot(lm[top].x - lm[bot].x, lm[top].y - lm[bot].y)
  const horiz = Math.hypot(lm[l].x  - lm[r].x,   lm[l].y  - lm[r].y)
  return horiz > 0 ? vert / horiz : 0.3
}

function estimateDistance(faceWidthPx: number, videoWidth: number): number {
  const focal   = videoWidth * 0.85
  const distMm  = (150 * focal) / faceWidthPx
  return Math.round(distMm / 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type TestEye   = 'both' | 'right' | 'left'
type TestPhase = 'intro' | 'setup' | 'testing' | 'done'

interface FaceMetrics {
  detected:    boolean
  distanceCm:  number | null
  leftOpen:    boolean
  rightOpen:   boolean
  gazeOk:      boolean
  blinkRate:   number
}

interface RowResult {
  snellen:  string
  logmar:   number
  score:    number
  heard:    string
  skipped:  boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function matchLetters(spoken: string, expected: string[]): { score: number; heard: string } {
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
  let bestIdx = -1
  results.forEach((r, i) => { if (r.score >= 60) bestIdx = i })
  const row = bestIdx >= 0 ? SNELLEN_ROWS[bestIdx] : SNELLEN_ROWS[0]
  return {
    normalizedScore: LOGMAR_TO_NORM[String(row.logmar)] ?? 50,
    logmar:  row.logmar,
    snellen: row.snellen,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEECH HOOK
// ─────────────────────────────────────────────────────────────────────────────
function useSpeech(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim,   setInterim]   = useState('')
  const [supported, setSupported] = useState(true)
  const recRef   = useRef<any>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setSupported(false); return }
    const rec          = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-US'
    rec.onresult = (e: any) => {
      let interimT = '', finalT = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalT += t
        else interimT += t
      }
      if (interimT) setInterim(interimT.toUpperCase())
      if (finalT) {
        setInterim('')
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          rec.stop()
          setListening(false)
          onResult(finalT.trim())
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
    setInterim('')
    setListening(true)
    try { recRef.current.start() } catch (_) {}
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      recRef.current?.stop()
      setListening(false)
      setInterim('')
    }, 8000)
  }

  const stop = () => {
    clearTimeout(timerRef.current)
    recRef.current?.stop()
    setListening(false)
    setInterim('')
  }

  return { listening, interim, supported, listen, stop }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────
function Badge({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
      ok ? 'bg-green-50 text-green-700 border-green-200'
         : 'bg-red-50 text-red-600 border-red-200'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500'}`}/>
      {label}: {value}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Calibration() {
  const { setTestResult, nextStep } = useScreeningStore()

  // ── Phase & test state ────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState<TestPhase>('intro')
  const [testEye,     setTestEye]     = useState<TestEye>('both')
  const [rowIdx,      setRowIdx]      = useState(0)
  const [rowResults,  setRowResults]  = useState<RowResult[]>([])
  const [feedback,    setFeedback]    = useState<{ text: string; ok: boolean } | null>(null)
  const [showButtons, setShowButtons] = useState(false)
  const rowIdxRef = useRef(0)
  useEffect(() => { rowIdxRef.current = rowIdx }, [rowIdx])

  // ── Camera state ──────────────────────────────────────────────────────────
  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const faceMeshRef  = useRef<any>(null)
  const animRef      = useRef<number>(0)
  const blinkRef     = useRef<number[]>([])
  const eyeClosedRef = useRef(false)

  const [faceMetrics, setFaceMetrics] = useState<FaceMetrics>({
    detected: false, distanceCm: null,
    leftOpen: true, rightOpen: true,
    gazeOk: true, blinkRate: 0,
  })
  const [camActive, setCamActive] = useState(false)
  const [camError,  setCamError]  = useState<string | null>(null)

  const distanceOk = faceMetrics.distanceCm !== null
    ? faceMetrics.distanceCm >= 45 && faceMetrics.distanceCm <= 80
    : true

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // ── Face processing ───────────────────────────────────────────────────────
  const processFace = useCallback((results: any) => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw mirrored video
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
    ctx.restore()

    if (!results.multiFaceLandmarks?.length) {
      setFaceMetrics(p => ({ ...p, detected: false }))
      return
    }

    const lm = results.multiFaceLandmarks[0]
    const W  = canvas.width
    const H  = canvas.height

    const leftEAR  = calcEAR(lm, L_EYE_TOP, L_EYE_BOT, L_EYE_LEFT, L_EYE_RIGHT)
    const rightEAR = calcEAR(lm, R_EYE_TOP, R_EYE_BOT, R_EYE_LEFT, R_EYE_RIGHT)
    const EAR_THRESHOLD = 0.20
    const leftOpen  = leftEAR  > EAR_THRESHOLD
    const rightOpen = rightEAR > EAR_THRESHOLD

    // Blink detection
    const closed = !leftOpen || !rightOpen
    if (closed && !eyeClosedRef.current) {
      eyeClosedRef.current = true
    } else if (!closed && eyeClosedRef.current) {
      eyeClosedRef.current = false
      const now = Date.now()
      blinkRef.current.push(now)
      blinkRef.current = blinkRef.current.filter(t => now - t < 60000)
    }

    // Distance
    const faceWidthPx = lm[RIGHT_EAR] && lm[LEFT_EAR]
      ? Math.abs(lm[RIGHT_EAR].x - lm[LEFT_EAR].x) * W
      : 0
    const distanceCm = faceWidthPx > 10 ? estimateDistance(faceWidthPx, W) : null

    // Gaze
    const nose   = lm[NOSE_TIP]
    const gazeOk = nose
      ? nose.x > 0.25 && nose.x < 0.75 && nose.y > 0.15 && nose.y < 0.85
      : true

    // Draw eye indicators
    const drawEye = (lmIdx: number, open: boolean) => {
      if (!lm[lmIdx]) return
      const ex = (1 - lm[lmIdx].x) * W
      const ey = lm[lmIdx].y * H
      ctx.beginPath()
      ctx.arc(ex, ey, 7, 0, Math.PI * 2)
      ctx.fillStyle = open ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)'
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    drawEye(L_EYE_TOP, leftOpen)
    drawEye(R_EYE_TOP, rightOpen)

    // Distance label on canvas
    if (distanceCm) {
      const ideal = distanceCm >= 45 && distanceCm <= 80
      ctx.fillStyle = ideal ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)'
      ctx.font = 'bold 13px Inter, sans-serif'
      ctx.fillText(`${distanceCm}cm`, 8, 18)
    }

    if (!gazeOk) {
      ctx.fillStyle = 'rgba(239,68,68,0.95)'
      ctx.font = 'bold 11px Inter, sans-serif'
      ctx.fillText('Look at chart', 8, 36)
    }

    setFaceMetrics({
      detected:   true,
      distanceCm,
      leftOpen,
      rightOpen,
      gazeOk,
      blinkRate:  blinkRef.current.length,
    })
  }, [])

  // ── Animation loop ────────────────────────────────────────────────────────
  const animate = useCallback(async () => {
    const video = videoRef.current
    const fm    = faceMeshRef.current
    if (video && video.readyState === 4) {
      if (fm) {
        try { await fm.send({ image: video }) } catch (_) {}
      } else {
        // No face mesh — just draw video
        const canvas = canvasRef.current
        const ctx    = canvas?.getContext('2d')
        if (ctx && canvas) {
          ctx.save()
          ctx.scale(-1, 1)
          ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
          ctx.restore()
        }
      }
    }
    animRef.current = requestAnimationFrame(animate)
  }, [])

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:      { ideal: 640 },
          height:     { ideal: 480 },
          facingMode: 'user',
          frameRate:  { ideal: 30 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if (canvasRef.current) {
        canvasRef.current.width  = 640
        canvasRef.current.height = 480
      }

      // Load MediaPipe — non-blocking, won't crash if unavailable
      try {
        const { FaceMesh } = await import('@mediapipe/face_mesh')
        const fm = new FaceMesh({
          locateFile: (f: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${f}`,
        })
        fm.setOptions({
          maxNumFaces:            1,
          refineLandmarks:        true,
          minDetectionConfidence: 0.7,
          minTrackingConfidence:  0.7,
        })
        fm.onResults(processFace)
        faceMeshRef.current = fm
      } catch (mpErr) {
        console.warn('MediaPipe unavailable — camera running without face tracking:', mpErr)
        faceMeshRef.current = null
      }

      setCamActive(true)
      animate()

    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setCamError('Camera permission denied. Allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setCamError('No camera detected. Tests still work without camera.')
      } else {
        setCamError('Camera unavailable — tests still work without it.')
      }
    }
  }, [processFace, animate])

  // ── Stop camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    faceMeshRef.current = null
    setCamActive(false)
    setFaceMetrics({
      detected: false, distanceCm: null,
      leftOpen: true, rightOpen: true,
      gazeOk: true, blinkRate: 0,
    })
  }, [])

  // ── Inline camera box ─────────────────────────────────────────────────────
  const CameraBox = ({ compact = false }: { compact?: boolean }) => (
    <div className="flex flex-col gap-2">
      {/* Hidden video element — source for canvas */}
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        muted
        playsInline
      />

      {!camActive && !camError && (
        <div className={`bg-gray-50 border border-gray-200 rounded-xl flex flex-col items-center
                         justify-center gap-2 ${compact ? 'p-3 min-h-[110px]' : 'p-6 min-h-[160px]'}`}>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10
                   a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
            </svg>
          </div>
          <p className="text-xs text-gray-500 text-center font-medium">Camera monitoring</p>
          <button
            onClick={startCamera}
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium
                       px-3 py-1.5 rounded-lg transition-colors"
          >
            Enable camera
          </button>
        </div>
      )}

      {camError && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
          <p className="text-xs text-orange-700 mb-2">{camError}</p>
          <button onClick={startCamera} className="text-xs text-orange-700 underline">
            Try again
          </button>
        </div>
      )}

      {camActive && (
        <>
          <div className="relative rounded-xl overflow-hidden bg-black">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ maxHeight: compact ? 130 : 190, objectFit: 'cover' }}
            />
            {!faceMetrics.detected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <p className="text-white text-xs font-medium text-center px-2">
                  Position face in camera
                </p>
              </div>
            )}
            <button
              onClick={stopCamera}
              className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/70
                         text-white text-xs px-1.5 py-0.5 rounded-full"
            >
              ✕
            </button>
          </div>

          {faceMetrics.detected && (
            <div className="flex flex-wrap gap-1">
              {faceMetrics.distanceCm && (
                <Badge label="Dist" value={`${faceMetrics.distanceCm}cm`} ok={distanceOk}/>
              )}
              <Badge label="L" value={faceMetrics.leftOpen  ? 'Open' : 'Closed'} ok={faceMetrics.leftOpen}/>
              <Badge label="R" value={faceMetrics.rightOpen ? 'Open' : 'Closed'} ok={faceMetrics.rightOpen}/>
              <Badge label="Gaze" value={faceMetrics.gazeOk ? '✓' : '!'} ok={faceMetrics.gazeOk}/>
              <Badge label="Blinks" value={String(faceMetrics.blinkRate)} ok={faceMetrics.blinkRate >= 8}/>
            </div>
          )}

          {faceMetrics.detected && faceMetrics.distanceCm && !distanceOk && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              <p className="text-xs text-amber-700 font-medium">
                {faceMetrics.distanceCm < 50
                  ? `↩ Move back (${faceMetrics.distanceCm}cm)`
                  : `→ Move closer (${faceMetrics.distanceCm}cm)`}
              </p>
            </div>
          )}

          {faceMetrics.detected && !faceMetrics.gazeOk && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
              <p className="text-xs text-red-700 font-medium">👁 Look at the chart</p>
            </div>
          )}
        </>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE RESULT HANDLER
  // ─────────────────────────────────────────────────────────────────────────
  const handleVoiceResult = useRef((spoken: string) => {
    const row = SNELLEN_ROWS[rowIdxRef.current]
    const { score, heard } = matchLetters(spoken, row.letters)

    const result: RowResult = {
      snellen: row.snellen, logmar: row.logmar,
      score, heard, skipped: false,
    }

    setRowResults(prev => {
      const updated = [...prev, result]
      setFeedback({
        text: `${score >= 60 ? '✓' : '✗'} Heard "${heard || '—'}" — ${score}% correct`,
        ok:   score >= 60,
      })
      setTimeout(() => {
        setFeedback(null)
        const next   = rowIdxRef.current + 1
        const last2  = updated.slice(-2)
        const tooBad = last2.length === 2 && last2.every(r => r.score < 40)
        if (next >= SNELLEN_ROWS.length || tooBad) {
          finishRef.current(updated)
        } else {
          setRowIdx(next)
        }
      }, 1500)
      return updated
    })
  }).current

  // ─────────────────────────────────────────────────────────────────────────
  // FINISH TEST
  // ─────────────────────────────────────────────────────────────────────────
  const finishRef = useRef((results: RowResult[]) => {
    const { normalizedScore, logmar, snellen } = getAcuityScore(results)

    let corrected = normalizedScore
    if (faceMetrics.distanceCm) {
      const ratio = 60 / faceMetrics.distanceCm
      corrected   = Math.min(100, Math.round(normalizedScore * (1 + (ratio - 1) * 0.3)))
    }

    setTestResult('calibration', {
      testId:          'calibration',
      normalizedScore: corrected,
      flags: [
        ...(logmar >= 0.5 ? ['acuity_reduced']   : []),
        ...(logmar >= 0.8 ? ['referral_advised']  : []),
        ...(logmar >= 1.0 ? ['urgent_referral']   : []),
        ...(faceMetrics.blinkRate < 8 ? ['low_blink_rate'] : []),
      ],
      rawData: {
        rows:          results,
        logmar,
        snellen,
        eye:           testEye,
        distanceCm:    faceMetrics.distanceCm,
        blinkRate:     faceMetrics.blinkRate,
        corrected,
        method:        'voice_snellen_camera',
      },
      completedAt: new Date().toISOString(),
    })
    stopCamera()
    setPhase('done')
    setTimeout(() => nextStep(), 1500)
  })

  const skipRow = () => {
    const row = SNELLEN_ROWS[rowIdxRef.current]
    const result: RowResult = {
      snellen: row.snellen, logmar: row.logmar,
      score: 0, heard: '', skipped: true,
    }
    setRowResults(prev => {
      const updated = [...prev, result]
      const next    = rowIdxRef.current + 1
      if (next >= SNELLEN_ROWS.length) finishRef.current(updated)
      else setRowIdx(next)
      return updated
    })
  }

  const { listening, interim, supported, listen, stop } = useSpeech(handleVoiceResult)
  const currentRow = SNELLEN_ROWS[rowIdx]

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — INTRO
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'intro') return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-6">
          <span className="inline-block bg-green-50 text-green-700 text-xs font-medium px-3 py-1 rounded-full mb-4">
            Test 1 of 5 · Visual Acuity
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Snellen Vision Test</h2>
          <p className="text-gray-500 leading-relaxed text-sm">
            Read each row of letters aloud. Camera monitors your eye position and distance
            for accurate results. Letters get smaller — stop when you can't read them.
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-5 space-y-3">
          {[
            { icon: '📏', text: 'Sit 50–70cm from your screen' },
            { icon: '📷', text: 'Camera tracks your eye position and distance' },
            { icon: '🎤', text: 'Read each row aloud — say all letters you can see' },
            { icon: '👓', text: 'Wear glasses or contacts if you normally do' },
            { icon: '⏭',  text: 'Tap Skip if a row is too small to read' },
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
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — SETUP
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'setup') return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
      <div className="max-w-lg w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Camera setup</h2>

        <div className="mb-5">
          <CameraBox/>
        </div>

        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Which eyes are you testing?</p>
          <div className="grid grid-cols-3 gap-2">
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
                {eye === 'both' ? 'Both eyes' : `${eye.charAt(0).toUpperCase() + eye.slice(1)} eye`}
              </button>
            ))}
          </div>
          {testEye !== 'both' && (
            <p className="text-xs text-amber-600 mt-2 text-center">
              Cover your {testEye === 'right' ? 'left' : 'right'} eye with your palm — do not press on it
            </p>
          )}
        </div>

        {faceMetrics.detected && (
          <div className={`rounded-xl p-3 mb-4 text-center text-sm font-medium ${
            distanceOk
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            {distanceOk
              ? `✓ Good position — ${faceMetrics.distanceCm}cm from screen`
              : `Adjust distance — ${faceMetrics.distanceCm}cm (aim 50–70cm)`
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
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — DONE
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'done') return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Visual acuity complete</h3>
        <p className="text-gray-500 mt-2 text-sm">Moving to contrast test...</p>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — TESTING
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="flex gap-4">

        {/* ── LEFT: chart + controls ── */}
        <div className="flex-1 flex flex-col">

          {/* Progress */}
          <div className="flex justify-between text-xs text-gray-400 mb-3">
            <span>Row {rowIdx + 1}/{SNELLEN_ROWS.length} · {currentRow.snellen}</span>
            <div className="flex gap-1 items-center">
              {SNELLEN_ROWS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${
                  i < rowIdx   ? 'w-4 bg-green-400' :
                  i === rowIdx ? 'w-6 bg-green-600' :
                                 'w-1.5 bg-gray-200'
                }`}/>
              ))}
            </div>
          </div>

          {/* Snellen chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 shadow-sm
                          flex flex-col items-center justify-center gap-1.5 flex-1"
            style={{ minHeight: 200 }}
          >
            {SNELLEN_ROWS.map((row, i) => (
              <div
                key={i}
                className={`font-black font-mono tracking-widest select-none transition-all ${
                  i === rowIdx ? 'text-gray-900 opacity-100' :
                  i < rowIdx   ? 'text-gray-300'             :
                                 'text-gray-200'
                }`}
                style={{ fontSize: row.size }}
              >
                {row.letters.join('  ')}
              </div>
            ))}
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`rounded-xl p-2.5 mb-2 text-center text-sm font-medium ${
              feedback.ok
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-orange-50 text-orange-700 border border-orange-200'
            }`}>
              {feedback.text}
            </div>
          )}

          {/* Interim transcript */}
          {interim && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 mb-2 text-center">
              <p className="text-xs text-blue-400 mb-0.5">Hearing...</p>
              <p className="font-mono font-bold text-blue-700 text-xl tracking-widest">{interim}</p>
            </div>
          )}

          {/* Distance warning */}
          {faceMetrics.detected && faceMetrics.distanceCm && !distanceOk && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 mb-2 text-center">
              <p className="text-xs text-amber-700">
                {faceMetrics.distanceCm < 50 ? '↩ Move back' : '→ Move closer'} — {faceMetrics.distanceCm}cm
              </p>
            </div>
          )}

          {/* Gaze warning */}
          {faceMetrics.detected && !faceMetrics.gazeOk && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2 mb-2 text-center">
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
                {supported ? 'Read row aloud' : 'Voice not available — use buttons below'}
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
                         text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Skip
            </button>
          </div>

          {/* Letter buttons fallback */}
          <button
            onClick={() => setShowButtons(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 py-1 text-center transition-colors"
          >
            {showButtons ? '▲ Hide' : '▼ Show'} letter buttons (if voice fails)
          </button>

          {showButtons && (
            <div className="mt-2 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 text-center mb-2">
                Tap each letter you can see on row {rowIdx + 1}:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {currentRow.letters.map((l, i) => (
                  <button
                    key={i}
                    onClick={() => handleVoiceResult(l)}
                    className="w-11 h-11 rounded-xl bg-white border-2 border-gray-200
                               hover:border-green-500 hover:bg-green-50 font-bold text-lg
                               transition-colors"
                  >
                    {l}
                  </button>
                ))}
                <button
                  onClick={skipRow}
                  className="px-3 h-11 rounded-xl bg-white border-2 border-gray-200
                             hover:border-gray-400 text-gray-400 text-xs transition-colors"
                >
                  Can't see
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: camera panel ── */}
        <div className="w-48 flex-shrink-0">
          <CameraBox compact={true}/>
        </div>

      </div>
    </div>
  )
}