import { useEffect, useState } from 'react';
import { PhoneCall, Search, X } from 'lucide-react';
import { getCallById, getCalls } from '../services/api.js';

const CALL_STATUSES = ['All', 'completed', 'abandoned', 'failed'];

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export default function CallHistory() {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);

  const loadCalls = async (activeStatus = statusFilter, activeSearch = search) => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getCalls({
        status: activeStatus === 'All' ? '' : activeStatus,
        search: activeSearch.trim(),
      });
      setCalls(data.calls || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load call history.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalls(statusFilter, search);
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadCalls(statusFilter, search);
  };

  const handleSelectCall = async (callId) => {
    try {
      const detail = await getCallById(callId);
      setSelectedCall(detail);
    } catch {
      const fallback = calls.find((item) => item.id === callId) || null;
      setSelectedCall(fallback);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Call History</h2>
        <p>Review past voice conversations, transcripts, and AI summaries.</p>
      </div>

      <section className="panel-card leads-toolbar-card" aria-label="Filter calls">
        <div className="leads-toolbar">
          <div className="voice-status-bar" style={{ marginBottom: 0 }}>
            {CALL_STATUSES.map((item) => (
              <button
                key={item}
                type="button"
                className={`status-chip-btn ${
                  statusFilter === item ? 'status-chip-btn-active' : ''
                }`}
                onClick={() => setStatusFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <form className="leads-search-form" onSubmit={handleSearchSubmit}>
            <div className="leads-search-wrap">
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                className="leads-search-input"
                placeholder="Search customer, company, or summary..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="secondary-button">
              Search
            </button>
          </form>
        </div>
      </section>

      {error && (
        <div className="voice-error-banner" role="alert">
          {error}
        </div>
      )}

      <div className={selectedCall ? 'leads-split-grid' : ''}>
        <section className="panel-card" aria-label="Calls table">
          <div className="panel-header">
            <h3 className="panel-title">
              <PhoneCall size={18} aria-hidden="true" />
              <span>Recorded Calls</span>
            </h3>
            <span className="status-pill">{total} total</span>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Score / Category</th>
                  <th>Sentiment</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      Loading call history...
                    </td>
                  </tr>
                ) : calls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      No calls recorded yet. End a session in Voice Agent to
                      generate a call record and AI summary.
                    </td>
                  </tr>
                ) : (
                  calls.map((call) => (
                    <tr
                      key={call.id}
                      className="lead-row-clickable"
                      onClick={() => handleSelectCall(call.id)}
                    >
                      <td>{call.customer_name || 'Unknown'}</td>
                      <td>{call.company_name || '--'}</td>
                      <td>
                        {call.created_at
                          ? new Date(call.created_at).toLocaleDateString()
                          : '--'}
                      </td>
                      <td>{formatDuration(call.duration_seconds)}</td>
                      <td>
                        {call.lead_score}/100 ({call.lead_category})
                      </td>
                      <td>{call.sentiment || 'neutral'}</td>
                      <td>
                        <span className="status-pill">{call.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedCall && (
          <aside className="panel-card lead-detail-card" aria-label="Call details">
            <div className="panel-header">
              <h3 className="panel-title">Call Summary & Transcript</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedCall(null)}
                aria-label="Close call details"
              >
                <X size={16} />
              </button>
            </div>

            <ul className="qualification-fields">
              <li>
                <strong>Summary:</strong> {selectedCall.summary || '--'}
              </li>
              <li>
                <strong>Requirements:</strong>{' '}
                {selectedCall.key_requirements || '--'}
              </li>
              <li>
                <strong>Objections:</strong> {selectedCall.objections || '--'}
              </li>
              <li>
                <strong>Next Steps:</strong> {selectedCall.next_steps || '--'}
              </li>
            </ul>

            <div className="qualification-fields" style={{ marginTop: '1rem' }}>
              <strong>Transcript:</strong>
              {(selectedCall.transcript || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  No transcript messages.
                </p>
              ) : (
                (selectedCall.transcript || []).map((entry, idx) => (
                  <div key={idx} style={{ marginTop: '0.375rem' }}>
                    <strong>
                      {entry.speaker === 'ai' ? 'Voxora AI' : 'Customer'}:
                    </strong>{' '}
                    {entry.message}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
