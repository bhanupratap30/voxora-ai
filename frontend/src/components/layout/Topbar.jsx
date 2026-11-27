import { Bell, Menu, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Topbar({ title, onMenuClick }) {
  const { profile, user, activeWorkspace } = useAuth() || {};
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    profile?.email ||
    user?.email ||
    'Sales Team';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-button mobile-only"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-button"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>
        <Link to="/profile" className="profile-chip" style={{ textDecoration: 'none' }}>
          <span className="profile-avatar" aria-hidden="true">
            <User size={16} />
          </span>
          <span className="profile-name">
            {displayName}
            {activeWorkspace ? ` (${activeWorkspace.role})` : ''}
          </span>
        </Link>
      </div>
    </header>
  );
}
