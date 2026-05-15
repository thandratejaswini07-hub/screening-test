import { FaceData } from '../hooks/useCamera'

interface BadgeProps {
  label: string
  value: string
  ok:    boolean
}

function Badge({ label, value, ok }: BadgeProps) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      ok
        ? 'bg-green-50 text-green-700 border border-green-200'
        : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}/>
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

      {/* ── Not started ── */}
      {!cameraActive && !cameraError && (
        <div className={`bg-gray-50 border border-gray-200 rounded-2xl flex flex-col
                         items-center justify-center gap-3 ${
          compact ? 'p-4 min-h-[120px]' : 'p-8 min-h-[200px]'
        }`}>
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Camera monitoring</p>
            <p className="text-xs text-gray-400 mt-1">
              {compact ? 'Eye tracking' : 'Tracks eye position and distance for accurate results'}
            </p>
          </div>
          <button
            onClick={onStart}
            className="bg-green-600 hover:bg-green-700 text-white text-sm
                       font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Enable camera
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {cameraError && (
        <div className={`bg-orange-50 border border-orange-200 rounded-2xl flex flex-col
                         items-center justify-center gap-3 ${compact ? 'p-4' : 'p-6'}`}>
          <span className="text-2xl">⚠️</span>
          <p className="text-sm text-orange-700 text-center leading-relaxed">{cameraError}</p>
          <button
            onClick={onStart}
            className="text-sm bg-orange-100 hover:bg-orange-200 text-orange-800
                       font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Try again
          </button>
          <p className="text-xs text-orange-500 text-center">
            Tests still work without camera — accuracy may be lower
          </p>
        </div>
      )}

      {/* ── Active — canvas feed ── */}
      {cameraActive && (
        <div className="flex flex-col gap-2">
          <div className="relative rounded-xl overflow-hidden bg-black">
            <canvas
              ref={canvasRef}
              className="w-full block"
              style={{ maxHeight: compact ? 140 : 220 }}
            />

            {!faceData.detected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full border-2 border-white/50
                                  border-t-white animate-spin mx-auto mb-2"/>
                  <p className="text-white text-xs font-medium">
                    Position your face in view
                  </p>
                </div>
              </div>
            )}

            {testName && (
              <div className="absolute top-2 left-2 bg-black/50 text-white
                              text-xs px-2 py-0.5 rounded-full font-medium">
                {testName}
              </div>
            )}

            <button
              onClick={onStop}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70
                         text-white text-xs px-2 py-0.5 rounded-full transition-colors"
              title="Disable camera"
            >
              ✕
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700 font-medium">
                {faceData.distanceCm < 50
                  ? `↩ Too close (${faceData.distanceCm}cm) — move back`
                  : `→ Too far (${faceData.distanceCm}cm) — move closer`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}