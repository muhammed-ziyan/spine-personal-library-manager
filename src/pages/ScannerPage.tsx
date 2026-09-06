import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Icon, IconButton } from '@/components'
import { DuplicateSheet } from '@/features/books/DuplicateSheet'
import { isCameraSupported, unsupportedCameraMessage, useBarcodeScanner } from '@/features/scanner/useBarcodeScanner'
import { usePreferences } from '@/hooks/usePreferences'
import { api, describeError } from '@/services/api'
import { openLibrary } from '@/services/openLibrary'
import type { DuplicateMatch } from '@/types'
import { formatIsbn, isBooklandEan, parseIsbn } from '@/utils/isbn'
import styles from './ScannerPage.module.css'

type Phase =
  | { kind: 'scanning' }
  | { kind: 'checking'; isbn: string }
  | { kind: 'duplicate'; isbn: string; duplicate: DuplicateMatch }
  | { kind: 'invalid'; code: string }
  | { kind: 'check-failed'; isbn: string; message: string }

export function ScannerPage() {
  const navigate = useNavigate()
  const { haptics } = usePreferences()
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' })
  const supported = isCameraSupported()

  const checkIsbn = useCallback(
    async (isbn: string) => {
      setPhase({ kind: 'checking', isbn })
      try {
        const result = await api.checkIsbn(isbn)
        if (result.duplicate) {
          setPhase({ kind: 'duplicate', isbn: result.isbn, duplicate: result.duplicate })
        } else {
          navigate(`/books/new?isbn=${result.isbn}`, { replace: true })
        }
      } catch (error) {
        setPhase({ kind: 'check-failed', isbn, message: describeError(error) })
      }
    },
    [navigate],
  )

  const onDetected = useCallback(
    (code: string) => {
      if (haptics && navigator.vibrate) navigator.vibrate(40)
      const parsed = parseIsbn(code)
      // Accept valid ISBN-13 (which all Bookland EANs are) and ISBN-10.
      if (parsed.valid && (parsed.kind === 'isbn10' || isBooklandEan(parsed.isbn))) {
        // Warm the Open Library record while the duplicate check runs, so the
        // add form is usually already filled in by the time it opens.
        openLibrary.prefetch(parsed.isbn)
        void checkIsbn(parsed.isbn)
      } else {
        setPhase({ kind: 'invalid', code })
      }
    },
    [checkIsbn, haptics],
  )

  const scanner = useBarcodeScanner({ onDetected })
  const started = useRef(false)

  const beginScan = useCallback(async () => {
    setPhase({ kind: 'scanning' })
    await scanner.start()
  }, [scanner])

  const scanAgain = () => {
    scanner.reset()
    void beginScan()
  }

  // The camera opens as soon as the screen does; the browser asks for permission the first time.
  useEffect(() => {
    if (started.current || !supported) return
    started.current = true
    void beginScan()
  }, [beginScan, supported])

  // Leaving the screen stops the camera (handled by the hook's unmount cleanup too).
  useEffect(() => {
    return () => scanner.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate('/add'))
  const cameraError = phase.kind === 'scanning' && scanner.status === 'error' && scanner.error
  const showVideo = supported && phase.kind !== 'duplicate' && !cameraError

  let card: React.ReactNode = null
  if (!supported) {
    card = (
      <ScanCard icon="camera-off" title="Camera not available" text={unsupportedCameraMessage()}>
        <Button to="/add?enter=isbn" icon="keyboard" block replace>
          Enter ISBN Manually
        </Button>
        <Button to="/books/new" variant="ghost" block replace>
          Add Without ISBN
        </Button>
      </ScanCard>
    )
  } else if (cameraError) {
    card = (
      <ScanCard
        icon="camera-off"
        title={cameraError.kind === 'denied' ? 'Camera access needed' : cameraError.kind === 'unsupported' ? 'Camera not supported' : "Couldn't start the camera"}
        text={cameraError.message}
      >
        {cameraError.kind !== 'unsupported' && (
          <Button icon="refresh" block onClick={scanAgain}>
            Try Again
          </Button>
        )}
        <Button to="/add?enter=isbn" variant="secondary" icon="keyboard" block replace>
          Enter ISBN Manually
        </Button>
      </ScanCard>
    )
  } else if (phase.kind === 'checking') {
    card = (
      <div className={styles.detected} aria-live="polite">
        <span className={styles.detectedTick}>
          <Icon name="check" size={22} strokeWidth={3} />
        </span>
        <div className={styles.detectedText}>
          <div className={styles.detectedLabel}>ISBN detected</div>
          <div className={styles.detectedIsbn}>{formatIsbn(phase.isbn)}</div>
        </div>
        <span className={styles.detectedSpinner} role="status" aria-label="Checking your library" />
      </div>
    )
  } else if (phase.kind === 'invalid') {
    card = (
      <ScanCard icon="alert" title="That isn't a book barcode" text={`We read ${phase.code}, which isn't a valid ISBN. Book barcodes usually start with 978 or 979.`}>
        <Button icon="scan" block onClick={scanAgain}>
          Scan Again
        </Button>
        <Button to="/add?enter=isbn" variant="secondary" icon="keyboard" block replace>
          Enter ISBN Manually
        </Button>
      </ScanCard>
    )
  } else if (phase.kind === 'check-failed') {
    card = (
      <ScanCard icon="alert" title="Couldn't check your library" text={phase.message}>
        <Button icon="refresh" block onClick={() => void checkIsbn(phase.isbn)}>
          Try Again
        </Button>
        <Button to={`/books/new?isbn=${phase.isbn}`} variant="secondary" block replace>
          Continue Anyway
        </Button>
        <Button variant="ghost" block onClick={scanAgain} className={styles.ghostOnDark}>
          Scan Again
        </Button>
      </ScanCard>
    )
  }

  return (
    <main className={styles.screen}>
      <span className={styles.glow} aria-hidden="true" />
      {/* The video element is always mounted so the scanner can attach to it. */}
      <video ref={scanner.videoRef} className={styles.video} playsInline muted autoPlay hidden={!showVideo} aria-label="Camera preview" />

      <header className={styles.topBar}>
        <IconButton icon="close" label="Close scanner" tone="dim" onClick={close} />
        <h1 className={[styles.heading, phase.kind === 'duplicate' && styles.headingDim].filter(Boolean).join(' ')}>Scan ISBN</h1>
        {scanner.torchSupported ? (
          <IconButton icon="torch" label={scanner.torchOn ? 'Turn torch off' : 'Turn torch on'} tone="dim" onClick={() => void scanner.toggleTorch()} aria-pressed={scanner.torchOn} className={scanner.torchOn ? styles.torchOn : undefined} />
        ) : (
          <span className={styles.spacer} />
        )}
      </header>

      <div className={styles.viewport}>
        {showVideo && (
          <>
            <div className={styles.reticle} aria-hidden="true">
              <span className={styles.cornerTL} />
              <span className={styles.cornerTR} />
              <span className={styles.cornerBL} />
              <span className={styles.cornerBR} />
              {scanner.status === 'scanning' && phase.kind === 'scanning' && <span className={styles.laser} />}
            </div>
            <p className={styles.hint} role="status">
              {scanner.status === 'starting' ? 'Starting the camera…' : 'Point your camera at the barcode on the back of the book.'}
            </p>
          </>
        )}
      </div>

      <div className={styles.bottom}>
        {card}
        {(phase.kind === 'scanning' || phase.kind === 'checking') && !cameraError && supported && (
          <Link to="/add?enter=isbn" replace className={styles.manualLink}>
            Enter ISBN manually
          </Link>
        )}
      </div>

      <DuplicateSheet
        duplicate={phase.kind === 'duplicate' ? phase.duplicate : null}
        onClose={scanAgain}
        onAddAnother={() => {
          if (phase.kind === 'duplicate') navigate(`/books/new?isbn=${phase.isbn}&copy=1`, { replace: true })
        }}
      />
    </main>
  )
}

function ScanCard({ icon, title, text, children }: { icon: 'alert' | 'camera-off'; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className={styles.card} role="alert">
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>
          <Icon name={icon} size={22} />
        </span>
        <div>
          <div className={styles.cardTitle}>{title}</div>
          <div className={styles.cardText}>{text}</div>
        </div>
      </div>
      <div className={styles.cardActions}>{children}</div>
    </div>
  )
}
