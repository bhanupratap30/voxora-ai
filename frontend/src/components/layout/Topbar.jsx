import { Bell, Menu, User } from 'lucide-react';

export default function Topbar({ title, onMenuClick }) {
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
        <div className="profile-chip">
          <span className="profile-avatar" aria-hidden="true">
            <User size={16} />
          </span>
          <span className="profile-name">Sales Team</span>
        </div>
      </div>
    </header>
  );
}
