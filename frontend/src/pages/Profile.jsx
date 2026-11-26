import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user, profile, workspaces, activeWorkspace, switchWorkspace, signOut } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Profile & Workspaces</h2>
        <p>Manage your account, active workspace, and role.</p>
      </div>

      <section className="panel-card">
        <ul className="qualification-fields" style={{ borderTop: 'none', paddingTop: 0 }}>
          <li><strong>Name:</strong> {profile?.full_name || user?.user_metadata?.full_name || '--'}</li>
          <li><strong>Email:</strong> {profile?.email || user?.email || '--'}</li>
          <li><strong>Active Workspace:</strong> {activeWorkspace?.name || '--'}</li>
          <li><strong>Role:</strong> {activeWorkspace?.role || '--'}</li>
        </ul>

        {workspaces.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="ws-select" style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
              Switch Workspace
            </label>
            <select
              id="ws-select"
              className="kb-file-input"
              value={activeWorkspace?.id || ''}
              onChange={(e) => switchWorkspace(e.target.value)}
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.role})
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginTop: '1.25rem' }}>
          <button type="button" className="secondary-button" onClick={signOut}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </section>
    </div>
  );
}
