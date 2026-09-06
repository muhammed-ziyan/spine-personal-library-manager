import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNavigation, InlineSpinner, Splash, ToastViewport } from '@/components'
import { ConnectionProvider, useConnection } from '@/hooks/useConnection'
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
import { ConnectPage } from '@/pages/ConnectPage'
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
  const { active } = useConnection()
  if (!active) return <ConnectPage />
  return (
    // Keyed on the connection so switching libraries drops the cached books and re-syncs.
    <LibraryProvider key={active.id}>
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
          <ConnectionProvider>
            <Gate />
          </ConnectionProvider>
        </ToastProvider>
      </BrowserRouter>
    </PreferencesProvider>
  )
}
