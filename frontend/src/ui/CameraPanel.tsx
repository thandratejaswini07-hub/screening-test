import { FaceData } from '../hooks/useCamera'

interface BadgeProps {
  label: string
  value: string
  ok:    boolean
}

function Badge({ label, value, ok }: BadgeProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={
        ok
          ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }
          : { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }
      }
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: ok ? '#22c55e' : '#ef4444' }}
      />
      <span>{label}: {value}</span>
    </div>
  )
}

interface CameraPanelProps {
  canvasRef:    React.RefObject<HTMLCanvasElement>
  videoRef:     React.RefObject<HTMLVideoElement>
  faceData:     FaceData
  cameraActive: boolean
  cameraError:  string | null
  onStart:      () => void
  onStop:       () => void
  compact?:     boolean
  testName?:    string
}

export default function CameraPanel({
  canvasRef, videoRef, faceData,
  cameraActive, cameraError,
  onStart, onStop,
  compact = false, testName,
}: CameraPanelProps) {

  const idealDistance = faceData.distanceCm !== null
    ? faceData.distanceCm >= 50 && faceData.distanceCm <= 75
    : true

  return (
    <div className="flex flex-col gap-2">

      {/*
        FIX: video element is ALWAYS in the DOM — never conditionally rendered.
        If it unmounts, videoRef.current becomes null and the stream breaks.
        We hide it off-screen; the canvas shows the mirrored feed to the user.
      */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position:      'fixed',
          top:           -9999,
          left:          -9999,
          width:         640,
          height:        480,
          opacity:       0,
          pointerEvents: 'none',
        }}
      />

      {/* Not started */}
      {!cameraActive && !cameraError && (
        <div
          className={`rounded-2xl flex flex-col items-center justify-center gap-3 ${
            compact ? 'p-4 min-h-[120px]' : 'p-8 min-h-[180px]'
          }`}
          style={{
            background: 'rgba(17,31,54,0.7)',
            border: '1px solid rgba(61,139,255,0.12)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(61,139,255,0.12)', border: '1px solid rgba(61,139,255,0.2)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#3d8bff" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Camera monitoring</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {compact ? 'Eye tracking' : 'Tracks eye position and distance for accurate results'}
            </p>
          </div>
          <button
            onClick={onStart}
            className="btn-accent text-xs font-medium px-4 py-2 rounded-lg"
          >
            Enable camera
          </button>
        </div>
      )}

      {/* Error */}
      {cameraError && (
        <div
          className={`rounded-2xl flex flex-col items-center justify-center gap-3 ${compact ? 'p-4' : 'p-6'}`}
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#f59e0b" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-sm text-center leading-relaxed" style={{ color: '#f59e0b' }}>{cameraError}</p>
          <button
            onClick={onStart}
            className="text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            Try again
          </button>
          <p className="text-xs text-center" style={{ color: 'rgba(245,158,11,0.6)' }}>
            Tests still work without camera — accuracy may be lower
          </p>
        </div>
      )}

      {/* Active — canvas feed */}
      {cameraActive && (
        <div className="flex flex-col gap-2">
          <div className="relative rounded-xl overflow-hidden" style={{ background: '#000' }}>
            <canvas
              ref={canvasRef}
              className="w-full block"
              style={{ maxHeight: compact ? 140 : 220 }}
            />

            {!faceData.detected && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                <div className="text-center">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto mb-2"
                  />
                  <p className="text-white text-xs font-medium">Position your face in view</p>
                </div>
              </div>
            )}

            {testName && (
              <div
                className="absolute top-2 left-2 text-white text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                {testName}
              </div>
            )}

            <button
              onClick={onStop}
              className="absolute top-2 right-2 text-white text-xs px-2 py-0.5 rounded-full transition-colors"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              title="Disable camera"
            >
              x
            </button>
          </div>

          {faceData.detected && (
            <div className="flex flex-wrap gap-1.5">
              {faceData.distanceCm != null && (
                <Badge label="Dist" value={`${faceData.distanceCm}cm`} ok={idealDistance}/>
              )}
              <Badge label="L" value={faceData.leftEyeOpen  ? 'Open' : 'Closed'} ok={faceData.leftEyeOpen}/>
              <Badge label="R" value={faceData.rightEyeOpen ? 'Open' : 'Closed'} ok={faceData.rightEyeOpen}/>
              <Badge label="Gaze" value={faceData.gazeOnScreen ? 'OK' : 'Off'} ok={faceData.gazeOnScreen}/>
              {!compact && faceData.blinkRate > 0 && (
                <Badge label="Blinks" value={`${faceData.blinkRate}/min`} ok={faceData.blinkRate >= 8}/>
              )}
            </div>
          )}

          {faceData.detected && faceData.distanceCm != null && !idealDistance && (
            <div
              className="rounded-lg px-3 py-2"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>
                {faceData.distanceCm < 50
                  ? `Too close (${faceData.distanceCm}cm) — move back`
                  : `Too far (${faceData.distanceCm}cm) — move closer`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}