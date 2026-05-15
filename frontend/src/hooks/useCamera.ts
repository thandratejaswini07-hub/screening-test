import { useEffect, useRef, useState, useCallback } from 'react'

const LEFT_EYE_TOP     = 159
const LEFT_EYE_BOTTOM  = 145
const LEFT_EYE_LEFT    = 33
const LEFT_EYE_RIGHT   = 133
const RIGHT_EYE_TOP    = 386
const RIGHT_EYE_BOTTOM = 374
const RIGHT_EYE_LEFT   = 362
const RIGHT_EYE_RIGHT  = 263
const NOSE_TIP         = 4
const LEFT_EAR         = 234
const RIGHT_EAR        = 454

export interface FaceData {
  detected:     boolean
  distanceCm:   number | null
  leftEyeOpen:  boolean
  rightEyeOpen: boolean
  gazeOnScreen: boolean
  blinkRate:    number
  leftEAR:      number
  rightEAR:     number
  faceWidth:    number | null
}

export interface UseCameraReturn {
  videoRef:     React.RefObject<HTMLVideoElement>
  canvasRef:    React.RefObject<HTMLCanvasElement>
  faceData:     FaceData
  cameraActive: boolean
  cameraError:  string | null
  startCamera:  () => Promise<void>
  stopCamera:   () => void
  captureFrame: () => string | null
}

const DEFAULT_FACE: FaceData = {
  detected: false, distanceCm: null,
  leftEyeOpen: true, rightEyeOpen: true,
  gazeOnScreen: true, blinkRate: 0,
  leftEAR: 0, rightEAR: 0, faceWidth: null,
}

function computeEAR(
  landmarks: any[],
  topIdx: number, bottomIdx: number,
  leftIdx: number, rightIdx: number,
): number {
  if (!landmarks[topIdx] || !landmarks[bottomIdx]) return 0.3
  const top    = landmarks[topIdx]
  const bottom = landmarks[bottomIdx]
  const left   = landmarks[leftIdx]
  const right  = landmarks[rightIdx]
  const vertical   = Math.hypot(top.x - bottom.x, top.y - bottom.y)
  const horizontal = Math.hypot(left.x - right.x, left.y - right.y)
  return horizontal > 0 ? vertical / horizontal : 0.3
}

function estimateDistance(faceWidthPx: number, videoWidth: number): number {
  const focalLength  = videoWidth * 0.85
  const knownWidthMm = 150
  const distanceMm   = (knownWidthMm * focalLength) / faceWidthPx
  return Math.round(distanceMm / 10)
}

export function useCamera(): UseCameraReturn {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const faceMeshRef  = useRef<any>(null)
  const animFrameRef = useRef<number>(0)
  const mountedRef   = useRef(true)
  // FIX: track whether startCamera has been called so we don't double-start
  const startingRef  = useRef(false)

  const [faceData,     setFaceData]     = useState<FaceData>(DEFAULT_FACE)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError,  setCameraError]  = useState<string | null>(null)

  const blinkTimesRef   = useRef<number[]>([])
  const eyeWasClosedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancelAnimationFrame(animFrameRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      // FIX: safely null out srcObject only if video element still exists
      if (videoRef.current) {
        try { videoRef.current.srcObject = null } catch (_) {}
      }
      faceMeshRef.current = null
    }
  }, [])

  const drawVideoToCanvas = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.restore()
  }, [])

  const processFaceResults = useCallback((results: any) => {
    if (!mountedRef.current) return
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.restore()

    if (!results.multiFaceLandmarks?.length) {
      if (mountedRef.current) setFaceData(prev => ({ ...prev, detected: false }))
      return
    }

    const landmarks = results.multiFaceLandmarks[0]
    const W = canvas.width
    const H = canvas.height

    const leftEAR  = computeEAR(landmarks, LEFT_EYE_TOP,  LEFT_EYE_BOTTOM,  LEFT_EYE_LEFT,  LEFT_EYE_RIGHT)
    const rightEAR = computeEAR(landmarks, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, RIGHT_EYE_LEFT, RIGHT_EYE_RIGHT)
    const EAR_CLOSED = 0.20
    const leftOpen   = leftEAR  > EAR_CLOSED
    const rightOpen  = rightEAR > EAR_CLOSED

    const eitherClosed = !leftOpen || !rightOpen
    if (eitherClosed && !eyeWasClosedRef.current) {
      eyeWasClosedRef.current = true
    } else if (!eitherClosed && eyeWasClosedRef.current) {
      eyeWasClosedRef.current = false
      const now = Date.now()
      blinkTimesRef.current.push(now)
      blinkTimesRef.current = blinkTimesRef.current.filter(t => now - t < 60000)
    }

    const leftEarLm   = landmarks[LEFT_EAR]
    const rightEarLm  = landmarks[RIGHT_EAR]
    const faceWidthPx = Math.abs(rightEarLm.x - leftEarLm.x) * W
    const distanceCm  = faceWidthPx > 10 ? estimateDistance(faceWidthPx, W) : null

    const noseTip      = landmarks[NOSE_TIP]
    const gazeOnScreen = noseTip
      ? noseTip.x > 0.25 && noseTip.x < 0.75 &&
        noseTip.y > 0.15 && noseTip.y < 0.85
      : true

    const drawDot = (x: number, y: number, open: boolean) => {
      ctx.beginPath()
      ctx.arc(x * W, y * H, 6, 0, Math.PI * 2)
      ctx.fillStyle = open ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)'
      ctx.fill()
    }
    if (landmarks[LEFT_EYE_TOP] && landmarks[RIGHT_EYE_TOP]) {
      drawDot(1 - landmarks[LEFT_EYE_TOP].x,  landmarks[LEFT_EYE_TOP].y,  leftOpen)
      drawDot(1 - landmarks[RIGHT_EYE_TOP].x, landmarks[RIGHT_EYE_TOP].y, rightOpen)
    }
    if (distanceCm) {
      const ideal = distanceCm >= 50 && distanceCm <= 75
      ctx.fillStyle = ideal ? 'rgba(34,197,94,1)' : 'rgba(239,68,68,1)'
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText(`${distanceCm}cm`, 8, 18)
    }

    if (mountedRef.current) {
      setFaceData({
        detected: true, distanceCm,
        leftEyeOpen: leftOpen, rightEyeOpen: rightOpen,
        gazeOnScreen,
        blinkRate: blinkTimesRef.current.length,
        leftEAR, rightEAR, faceWidth: faceWidthPx,
      })
    }
  }, [])

  const startLoop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    const loop = async () => {
      if (!mountedRef.current) return
      const video    = videoRef.current
      const faceMesh = faceMeshRef.current
      if (video && video.readyState >= 2) {
        if (faceMesh) {
          try { await faceMesh.send({ image: video }) }
          catch (_) { drawVideoToCanvas() }
        } else {
          drawVideoToCanvas()
        }
      }
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
  }, [drawVideoToCanvas])

  const loadFaceMesh = useCallback(async () => {
    try {
      const { FaceMesh } = await import('@mediapipe/face_mesh')
      const faceMesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      })
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      })
      faceMesh.onResults(processFaceResults)
      await faceMesh.initialize()
      if (mountedRef.current) {
        faceMeshRef.current = faceMesh
        console.log('[Camera] MediaPipe loaded')
      }
    } catch (err) {
      console.warn('[Camera] MediaPipe unavailable — running without face tracking:', err)
    }
  }, [processFaceResults])

  const startCamera = useCallback(async () => {
    // FIX: prevent double-start race condition
    if (startingRef.current || streamRef.current) return
    startingRef.current = true
    setCameraError(null)

    try {
      // FIX: check permissions API first on supported browsers
      if (navigator.permissions) {
        try {
          const perm = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (perm.state === 'denied') {
            setCameraError('Camera permission denied. Click the camera icon in your browser address bar to allow access.')
            startingRef.current = false
            return
          }
        } catch (_) { /* permissions API not supported — continue */ }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        // FIX: stream was acquired but video element not ready — clean up and report
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        setCameraError('Camera setup failed — video element not ready. Please refresh.')
        startingRef.current = false
        return
      }

      video.srcObject = stream

      // FIX: wait for metadata before setting canvas size
      await new Promise<void>((resolve) => {
        if (video.readyState >= 1) { resolve(); return }
        video.onloadedmetadata = () => resolve()
      })

      try { await video.play() }
      catch (e) { console.warn('[Camera] play() warning:', e) }

      if (canvasRef.current) {
        canvasRef.current.width  = video.videoWidth  || 640
        canvasRef.current.height = video.videoHeight || 480
      }

      if (mountedRef.current) setCameraActive(true)

      startLoop()
      loadFaceMesh()

    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError'  ? 'Camera permission denied. Allow camera access in your browser settings and try again.' :
        err.name === 'NotFoundError'    ? 'No camera found. Connect a webcam and try again.' :
        err.name === 'NotReadableError' ? 'Camera is in use by another app. Close it and try again.' :
        err.name === 'OverconstrainedError' ? 'Camera does not support the required resolution. Try a different camera.' :
        `Camera error: ${err.message}`
      if (mountedRef.current) setCameraError(msg)
    } finally {
      startingRef.current = false
    }
  }, [loadFaceMesh, startLoop])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    startingRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null } catch (_) {}
    }
    faceMeshRef.current = null
    if (mountedRef.current) {
      setCameraActive(false)
      setFaceData(DEFAULT_FACE)
    }
  }, [])

  const captureFrame = useCallback((): string | null => {
    return canvasRef.current?.toDataURL('image/jpeg', 0.8) ?? null
  }, [])

  return {
    videoRef, canvasRef, faceData,
    cameraActive, cameraError,
    startCamera, stopCamera, captureFrame,
  }
}