import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { BatchDetail } from './pages/BatchDetail'
import { Dashboard } from './pages/Dashboard'
import { ImportPage } from './pages/ImportPage'
import { Settings } from './pages/Settings'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/batch/:batchId" element={<BatchDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
