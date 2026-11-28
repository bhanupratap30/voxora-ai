import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MagneticCursor from '../animations/MagneticCursor.jsx';
import PageTransition from '../animations/PageTransition.jsx';
import ParticleNetwork from '../animations/ParticleNetwork.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/voice-agent': 'Voice Agent',
  '/leads': 'Leads',
  '/knowledge-base': 'Knowledge Base',
  '/appointments': 'Appointments',
  '/call-history': 'Call History',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const title = ROUTE_TITLES[pathname] || 'Voxora AI';

  return (
    <div className="app-layout">
      <ParticleNetwork />
      <MagneticCursor />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
