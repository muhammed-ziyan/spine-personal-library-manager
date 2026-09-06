/**
 * Camera barcode scanning built on ZXing (Apache-2.0). Decoding happens
 * entirely in the browser — frames never leave the device and nothing is
 * stored. The camera is only started when `start()` is called and is always
 * released on `stop()`, on a successful read, or when the hook unmounts.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

export type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'detected' | 'error'

export type ScannerErrorKind = 'unsupported' | 'denied' | 'unavailable' | 'busy' | 'unknown'

export interface ScannerError {
  kind: ScannerErrorKind
  message: string
}

interface Options {
  onDetected: (code: string) => void
}

export function isCameraSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext
}

function classifyError(error: unknown): ScannerError {
  const name = error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return { kind: 'denied', message: 'Camera access was blocked. Allow camera access for Spine in your browser settings, then try again.' }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return { kind: 'unavailable', message: "We couldn't find a camera on this device." }
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return { kind: 'busy', message: 'The camera is in use by another app. Close it and try again.' }
    default:
      return { kind: 'unknown', message: "The camera couldn't be started. Please try again." }
  }
}

export function useBarcodeScanner({ onDetected }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const detectedRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const [status, setStatus] = useState<ScannerStatus>('idle')
  const [error, setError] = useState<ScannerError | null>(null)

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  const stop = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    const video = videoRef.current
    const stream = video?.srcObject
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
    if (video) video.srcObject = null
    setStatus((current) => (current === 'detected' || current === 'error' ? current : 'idle'))
  }, [])

  const start = useCallback(async () => {
    if (!isCameraSupported()) {
      setError({ kind: 'unsupported', message: "This browser can't access the camera. Try Chrome or Safari, or enter the ISBN by hand." })
      setStatus('error')
      return
    }
    stop()
    detectedRef.current = false
    setError(null)
    setStatus('starting')

    if (!readerRef.current) {
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128])
      hints.set(DecodeHintType.TRY_HARDER, true)
      readerRef.current = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })
    }

    const video = videoRef.current
    if (!video) return

    try {
      const controls = await readerRef.current.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        video,
        (result) => {
          if (!result || detectedRef.current) return
          detectedRef.current = true
          setStatus('detected')
          // Release the camera immediately after a successful read.
          controls.stop()
          controlsRef.current = null
          const stream = video.srcObject
          if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
          onDetectedRef.current(result.getText())
        },
      )
      controlsRef.current = controls
      setStatus('scanning')
    } catch (err) {
      setError(classifyError(err))
      setStatus('error')
    }
  }, [stop])

  const reset = useCallback(() => {
    stop()
    detectedRef.current = false
    setError(null)
    setStatus('idle')
  }, [stop])

  // Always release the camera when the scanner screen unmounts.
  useEffect(() => stop, [stop])

  // Also release it when the tab is hidden (backgrounded PWA).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') reset()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [reset])

  return { videoRef, status, error, start, stop, reset }
}
