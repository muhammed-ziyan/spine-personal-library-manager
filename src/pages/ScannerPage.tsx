import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon, IconButton, InlineSpinner } from '@/components'
import { DuplicateSheet } from '@/features/books/DuplicateSheet'
import { isCameraSupported, useBarcodeScanner } from '@/features/scanner/useBarcodeScanner'
import { api, describeError } from '@/services/api'
import type { DuplicateMatch } from '@/types'
import { formatIsbn, isBooklandEan, parseIsbn } from '@/utils/isbn'
import styles from './ScannerPage.module.css'

type Phase =
  | { kind: 'intro' }
  | { kind: 'scanning' }
  | { kind: 'checking'; isbn: string }
  | { kind: 'duplicate'; isbn: string; duplicate: DuplicateMatch }
  | { kind: 'invalid'; code: string }
  | { kind: 'check-failed'; isbn: string; message: string }

export function ScannerPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })

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
      if (navigator.vibrate) navigator.vibrate(40)
      const parsed = parseIsbn(code)
      // Accept valid ISBN-13 (which all Bookland EANs are) and ISBN-10.
      if (parsed.valid && (parsed.kind === 'isbn10' || isBooklandEan(parsed.isbn))) {
        void checkIsbn(parsed.isbn)
      } else {
        setPhase({ kind: 'invalid', code })
      }
    },
    [checkIsbn],
  )

  const scanner = useBarcodeScanner({ onDetected })

  const beginScan = async () => {
    setPhase({ kind: 'scanning' })
    await scanner.start()
  }

  const scanAgain = () => {
    scanner.reset()
    void beginScan()
  }

  // Leaving the screen stops the camera (handled by the hook's unmount cleanup).
  useEffect(() => {
    return () => scanner.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showVideo = phase.kind === 'scanning' && scanner.status !== 'error'
  const supported = isCameraSupported()

  return (
    <main className={styles.screen}>
      <header className={styles.topBar}>
        <IconButton icon="close" label="Close scanner" tone="surface" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/add'))} />
        <h1 className={styles.heading}>Scan ISBN</h1>
        <span className={styles.spacer} />
      </header>

      <div className={styles.viewport}>
        {/* The video element is always mounted so the scanner can attach to it. */}
        <video ref={scanner.videoRef} className={styles.video} playsInline muted autoPlay hidden={!showVideo} aria-label="Camera preview" />

        {showVideo && (
          <>
            <div className={styles.reticle} aria-hidden="true">
              <span className={styles.cornerTL} />
              <span className={styles.cornerTR} />
              <span className={styles.cornerBL} />
              <span className={styles.cornerBR} />
              {scanner.status === 'scanning' && <span className={styles.laser} />}
            </div>
            <p className={styles.hint} role="status">
              {scanner.status === 'starting' ? 'Starting camera…' : 'Line up the barcode inside the frame'}
            </p>
          </>
        )}

        {phase.kind === 'intro' && (
          <div className={styles.panel}>
            <span className={styles.panelIcon}>
              <Icon name="scan" size={32} />
            </span>
            <h2 className={styles.panelTitle}>Scan the barcode</h2>
            <p className={styles.panelText}>
              {supported
                ? "Spine will ask to use your camera the first time. Barcodes are read on your device — nothing is recorded or uploaded."
                : "This browser can't access the camera. You can still enter the ISBN by hand."}
            </p>
            <div className={styles.panelActions}>
              {supported && (
                <Button size="lg" block icon="scan" onClick={beginScan}>
                  Start Scanning
                </Button>
              )}
              <Button to="/add?enter=isbn" variant="secondary" block icon="keyboard">
                Enter ISBN Manually
              </Button>
              <Button to="/books/new" variant="ghost" block>
                Add Without ISBN
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'scanning' && scanner.status === 'error' && scanner.error && (
          <div className={styles.panel} role="alert">
            <span className={[styles.panelIcon, styles.panelIconDanger].join(' ')}>
              <Icon name="camera-off" size={30} />
            </span>
            <h2 className={styles.panelTitle}>
              {scanner.error.kind === 'denied' ? 'Camera access needed' : scanner.error.kind === 'unsupported' ? 'Camera not supported' : "Couldn't start the camera"}
            </h2>
            <p className={styles.panelText}>{scanner.error.message}</p>
            <div className={styles.panelActions}>
              {scanner.error.kind !== 'unsupported' && (
                <Button size="lg" block icon="refresh" onClick={scanAgain}>
                  Try Again
                </Button>
              )}
              <Button to="/add?enter=isbn" variant="secondary" block icon="keyboard">
                Enter ISBN Manually
              </Button>
              <Button to="/books/new" variant="ghost" block>
                Add Without ISBN
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'checking' && (
          <div className={styles.panel} aria-live="polite">
            <InlineSpinner label="Checking your library" />
            <h2 className={styles.panelTitle}>{formatIsbn(phase.isbn)}</h2>
            <p className={styles.panelText}>Checking whether you already own this book…</p>
          </div>
        )}

        {phase.kind === 'invalid' && (
          <div className={styles.panel} role="alert">
            <span className={[styles.panelIcon, styles.panelIconWarning].join(' ')}>
              <Icon name="alert" size={30} />
            </span>
            <h2 className={styles.panelTitle}>That isn't a book barcode</h2>
            <p className={styles.panelText}>
              We read <strong className={styles.code}>{phase.code}</strong>, which isn't a valid ISBN. Book barcodes usually start with 978 or 979.
            </p>
            <div className={styles.panelActions}>
              <Button size="lg" block icon="scan" onClick={scanAgain}>
                Scan Again
              </Button>
              <Button to="/add?enter=isbn" variant="secondary" block icon="keyboard">
                Enter ISBN Manually
              </Button>
              <Button to="/books/new" variant="ghost" block>
                Add Without ISBN
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'check-failed' && (
          <div className={styles.panel} role="alert">
            <span className={[styles.panelIcon, styles.panelIconDanger].join(' ')}>
              <Icon name="alert" size={30} />
            </span>
            <h2 className={styles.panelTitle}>Couldn't check your library</h2>
            <p className={styles.panelText}>{phase.message}</p>
            <div className={styles.panelActions}>
              <Button size="lg" block icon="refresh" onClick={() => void checkIsbn(phase.isbn)}>
                Try Again
              </Button>
              <Button to={`/books/new?isbn=${phase.isbn}`} variant="secondary" block>
                Continue Anyway
              </Button>
              <Button variant="ghost" block onClick={scanAgain}>
                Scan Again
              </Button>
            </div>
          </div>
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
