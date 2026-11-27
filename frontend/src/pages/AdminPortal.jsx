import { useEffect, useState } from 'react';
import { Eye, Search, Shield, Users } from 'lucide-react';
import {
  getAdminAuditLogs,
  getAdminOverview,
  getAdminUsers,
  getAdminWorkspaces,
  inspectAdminUser,
  toggleAdminUserStatus,
} from '../services/api.js';

export default function AdminPortal() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [inspected, setInspected] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = async (q = search) => {
    setIsLoading(true);
    setError('');
    try {
      const [ov, us, ws, lg] = await Promise.all([
        getAdminOverview(),
        getAdminUsers(q),
        getAdminWorkspaces(),
        getAdminAuditLogs(),
      ]);
      setOverview(ov);
      setUsers(us.users || []);
      setWorkspaces(ws.workspaces || []);
      setLogs(lg.logs || []);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load Admin Portal.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll('');
  }, []);

  const handleToggleStatus = async (user) => {
    try {
      await toggleAdminUserStatus(user.user_id, !user.is_active);
      await loadAll(search);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to update user status.');
    }
  };

  const handleInspect = async (userId) => {
    try {
      const data = await inspectAdminUser(userId);
      setInspected(data);
      const lg = await getAdminAuditLogs();
      setLogs(lg.logs || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to inspect user.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>
          <Shield size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Super Admin Portal
        </h2>
        <p>Platform-wide users, workspaces, data inspection, and audit logs.</p>
      </div>

      {error && <div className="voice-error-banner" role="alert">{error}</div>}

      {overview && (
        <section className="metrics-grid" aria-label="Platform overview">
          <article className="metric-card">
            <div className="metric-label">Total Users</div>
            <div className="metric-value">{overview.total_users}</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">Active Users</div>
            <div className="metric-value">{overview.active_users}</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">Workspaces</div>
            <div className="metric-value">{overview.total_workspaces}</div>
          </article>
          <article className="metric-card">
            <div className="metric-label">Total Leads / Calls</div>
            <div className="metric-value">
              {overview.total_leads} / {overview.total_calls}
            </div>
          </article>
        </section>
      )}

      <section className="panel-card" style={{ marginBottom: '1rem' }}>
        <div className="panel-header">
          <h3 className="panel-title">
            <Users size={18} />
            <span>User Management</span>
          </h3>
          <form
            className="leads-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              loadAll(search);
            }}
          >
            <div className="leads-search-wrap">
              <Search size={16} />
              <input
                type="text"
                className="leads-search-input"
                placeholder="Search name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="secondary-button">Search</button>
          </form>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Workspaces</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="table-empty">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="table-empty">No users found.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id}>
                    <td>{u.full_name || '--'}</td>
                    <td>{u.email}</td>
                    <td>
                      {(u.workspaces || []).map((w) => `${w.name} (${w.role})`).join(', ') || '--'}
                    </td>
                    <td>
                      <span className="status-pill">{u.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleInspect(u.user_id)}
                      >
                        <Eye size={14} />
                        <span>Inspect</span>
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {inspected && (
        <section className="panel-card" style={{ marginBottom: '1rem' }}>
          <div className="panel-header">
            <h3 className="panel-title">
              Inspecting: {inspected.user.full_name || inspected.user.email}
            </h3>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setInspected(null)}
            >
              Close
            </button>
          </div>
          <p className="agent-status-note">
            Leads: {inspected.leads.length} | Calls: {inspected.calls.length} (Action logged to audit trail)
          </p>
        </section>
      )}

      <div className="dashboard-grid">
        <section className="panel-card">
          <div className="panel-header">
            <h3 className="panel-title">Workspaces ({workspaces.length})</h3>
          </div>
          <ul className="qualification-fields" style={{ borderTop: 'none', paddingTop: 0 }}>
            {workspaces.map((ws) => (
              <li key={ws.id}>
                <strong>{ws.name}</strong> ({ws.workspace_type}) — {ws.member_count} members, {ws.lead_count} leads, {ws.call_count} calls
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <h3 className="panel-title">Audit Logs</h3>
          </div>
          <ul className="qualification-fields" style={{ borderTop: 'none', paddingTop: 0 }}>
            {logs.length === 0 ? (
              <li>No administrative actions logged yet.</li>
            ) : (
              logs.map((log) => (
                <li key={log.id}>
                  <strong>{log.action}</strong> by {log.admin_email} — {log.details}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
