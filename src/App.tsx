import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Clips } from '@/pages/Clips'
import { Queue } from '@/pages/Queue'
import { Settings } from '@/pages/Settings'
import { Connect } from '@/pages/Connect'
import { AuthCallback } from '@/pages/AuthCallback'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clips" element={<Clips />} />
        <Route path="queue" element={<Queue />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/connect" element={<Connect />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  )
}

export default App
