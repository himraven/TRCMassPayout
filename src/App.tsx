import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DisclaimerModal } from './components/DisclaimerModal'
import './modules/receipt'

const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })),
)
const ImportPage = lazy(() =>
  import('./pages/ImportPage').then((module) => ({ default: module.ImportPage })),
)
const BatchDetail = lazy(() =>
  import('./pages/BatchDetail').then((module) => ({ default: module.BatchDetail })),
)
const Settings = lazy(() =>
  import('./pages/Settings').then((module) => ({ default: module.Settings })),
)

function App() {
  return (
    <AppShell>
      <DisclaimerModal />
      <Suspense
        fallback={
          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-300">
            Loading page…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/batch/:batchId" element={<BatchDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}

export default App
