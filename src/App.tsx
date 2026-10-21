import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { FocusTab } from './pages/focus/FocusTab'
import { HistoryTab } from './pages/focus/HistoryTab'
import { ReviewsTab } from './pages/focus/ReviewsTab'
import { KnowledgeVaultPage } from './pages/KnowledgeVaultPage'
import { NoteDetailPage } from './pages/NoteDetailPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SettingsPage } from './pages/SettingsPage'
import { AppDataProvider } from './state/AppDataContext'
import { AuthProvider } from './state/AuthContext'

function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/vault" element={<KnowledgeVaultPage />} />
              <Route path="/vault/:id" element={<NoteDetailPage />} />
              <Route path="/focus" element={<FocusTab />} />
              <Route path="/focus/history" element={<HistoryTab />} />
              <Route path="/focus/reviews" element={<ReviewsTab />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </AppDataProvider>
    </AuthProvider>
  )
}

export default App
