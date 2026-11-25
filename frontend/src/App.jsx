import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import VoiceAgent from './pages/VoiceAgent.jsx';
import Leads from './pages/Leads.jsx';
import KnowledgeBase from './pages/KnowledgeBase.jsx';
import Appointments from './pages/Appointments.jsx';
import CallHistory from './pages/CallHistory.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/voice-agent" element={<VoiceAgent />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/call-history" element={<CallHistory />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
