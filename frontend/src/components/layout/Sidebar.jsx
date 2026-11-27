import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Mic,
  Users,
  BookOpen,
  Calendar,
  PhoneCall,
  BarChart3,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/voice-agent', label: 'Voice Agent', icon: Mic },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { to: '/appointments', label: 'Appointments', icon: Calendar },
  { to: '/call-history', label: 'Call History', icon: PhoneCall },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }) {
  const { profile } = useAuth() || {};
  const items = profile?.is_super_admin
    ? [...NAV_ITEMS, { to: '/admin', label: 'Admin Portal', icon: Shield }]
    : NAV_ITEMS;

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-dot" aria-hidden="true" />
            <span className="brand-name">Voxora AI</span>
          </div>
          <button
            type="button"
            className="icon-button mobile-only"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
