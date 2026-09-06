import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNavigation, InlineSpinner, Splash, ToastViewport } from '@/components'
import { SessionProvider, useSession } from '@/hooks/useSession'
import { LibraryProvider, useLibrary } from '@/hooks/useLibrary'
import { PreferencesProvider } from '@/hooks/usePreferences'
import { ToastProvider } from '@/hooks/useToast'
import { HomePage } from '@/pages/HomePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { AddPage } from '@/pages/AddPage'
import { BookFormPage } from '@/pages/BookFormPage'
import { BookDetailPage } from '@/pages/BookDetailPage'
import { AddedPage } from '@/pages/AddedPage'
import { StatsPage } from '@/pages/StatsPage'
import { YouPage } from '@/pages/YouPage'
import { SignInPage } from '@/pages/SignInPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ScrollToTop } from './ScrollToTop'

// The scanner pulls in ZXing; keep it out of the initial bundle.
const ScannerPage = lazy(() => import('@/pages/ScannerPage').then((m) => ({ default: m.ScannerPage })))

/** Tab roots show the bottom navigation; pushed screens (details, forms, scanner) do not. */
const TAB_ROOTS = new Set(['/', '/library', '/add', '/stats', '/you'])

function Shell() {
  const location = useLocation()
  const { state, books } = useLibrary()
  const firstSync = (state === 'idle' || state === 'loading') && books.length === 0
  if (firstSync) return <Splash />
  const showNav = TAB_ROOTS.has(location.pathname)
  return (
    <>
      <Outlet />
      {showNav && <BottomNavigation />}
      <ToastViewport />
    </>
  )
}

function Gate() {
  const { session, signedIn } = useSession()
  if (!signedIn || !session) return <SignInPage />
  return (
    // Keyed on the session so signing out and back in drops the cached books and re-syncs.
    <LibraryProvider key={session.token}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="add" element={<AddPage />} />
          <Route
            path="scan"
            element={
              <Suspense fallback={<InlineSpinner label="Loading scanner" />}>
                <ScannerPage />
              </Suspense>
            }
          />
          <Route path="stats" element={<StatsPage />} />
          <Route path="you" element={<YouPage />} />
          <Route path="books/new" element={<BookFormPage />} />
          <Route path="books/:id" element={<BookDetailPage />} />
          <Route path="books/:id/edit" element={<BookFormPage />} />
          <Route path="books/:id/added" element={<AddedPage />} />
          <Route path="index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </LibraryProvider>
  )
}

export function App() {
  return (
    <PreferencesProvider>
      <BrowserRouter>
        <ScrollToTop />
        <ToastProvider>
          <SessionProvider>
            <Gate />
          </SessionProvider>
        </ToastProvider>
      </BrowserRouter>
    </PreferencesProvider>
  )
}
