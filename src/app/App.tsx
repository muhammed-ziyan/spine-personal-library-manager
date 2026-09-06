import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNavigation, InlineSpinner, ToastViewport } from '@/components'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { LibraryProvider } from '@/hooks/useLibrary'
import { ToastProvider } from '@/hooks/useToast'
import { HomePage } from '@/pages/HomePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { AddPage } from '@/pages/AddPage'
import { BookFormPage } from '@/pages/BookFormPage'
import { BookDetailPage } from '@/pages/BookDetailPage'
import { StatsPage } from '@/pages/StatsPage'
import { SignInPage } from '@/pages/SignInPage'
import { SetupPage } from '@/pages/SetupPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ScrollToTop } from './ScrollToTop'

// The scanner pulls in ZXing; keep it out of the initial bundle.
const ScannerPage = lazy(() => import('@/pages/ScannerPage').then((m) => ({ default: m.ScannerPage })))

function Shell() {
  const location = useLocation()
  const fullScreen = location.pathname === '/scan'
  return (
    <>
      <Outlet />
      {!fullScreen && <BottomNavigation />}
      <ToastViewport />
    </>
  )
}

function Gate() {
  const { status } = useAuth()
  if (status === 'unconfigured') return <SetupPage />
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <InlineSpinner label="Loading Spine" />
      </div>
    )
  }
  if (status === 'signed-out') return <SignInPage />
  return (
    <LibraryProvider>
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
          <Route path="books/new" element={<BookFormPage />} />
          <Route path="books/:id" element={<BookDetailPage />} />
          <Route path="books/:id/edit" element={<BookFormPage />} />
          <Route path="index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </LibraryProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
