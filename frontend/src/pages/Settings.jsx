export default function Settings() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Settings</h2>
        <p>Configure workspace, voice, and API preferences.</p>
      </div>
      <section className="empty-state-card">
        <span className="empty-state-badge">System</span>
        <h3>Settings not configured</h3>
        <p>Workspace and integration settings will appear here.</p>
      </section>
    </div>
  );
}
