import { useEffect, useState } from 'react';
import { Search, Users, X } from 'lucide-react';
import { getLeadById, getLeads } from '../services/api.js';

const CATEGORIES = ['All', 'Hot', 'Warm', 'Cold'];

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);

  const loadLeads = async (activeCategory = category, activeSearch = search) => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getLeads({
        category: activeCategory === 'All' ? '' : activeCategory,
        search: activeSearch.trim(),
      });
      setLeads(data.leads || []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load leads from the backend.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeads(category, search);
  }, [category]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadLeads(category, search);
  };

  const handleSelectLead = async (leadId) => {
    try {
      const detail = await getLeadById(leadId);
      setSelectedLead(detail);
    } catch {
      const fallback = leads.find((item) => item.id === leadId) || null;
      setSelectedLead(fallback);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Leads</h2>
        <p>Persistent CRM leads captured and scored by Voxora AI.</p>
      </div>

      <section className="panel-card leads-toolbar-card" aria-label="Filter leads">
        <div className="leads-toolbar">
          <div className="voice-status-bar" style={{ marginBottom: 0 }}>
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className={`status-chip-btn ${
                  category === item ? 'status-chip-btn-active' : ''
                }`}
                onClick={() => setCategory(item)}
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
                placeholder="Search name, company, or business..."
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

      <div className={selectedLead ? 'leads-split-grid' : ''}>
        <section className="panel-card" aria-label="Leads table">
          <div className="panel-header">
            <h3 className="panel-title">
              <Users size={18} aria-hidden="true" />
              <span>CRM Leads</span>
            </h3>
            <span className="status-pill">{total} total</span>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Score</th>
                  <th>Category</th>
                  <th>Sentiment</th>
                  <th>Buying Signal</th>
                  <th>Progress</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      Loading leads...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      No leads found. Start a conversation in Voice Agent to
                      capture and qualify leads.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="lead-row-clickable"
                      onClick={() => handleSelectLead(lead.id)}
                    >
                      <td>{lead.customer_name || 'Unknown'}</td>
                      <td>{lead.company_name || '--'}</td>
                      <td>{lead.lead_score}/100</td>
                      <td>
                        <span className="status-pill">{lead.lead_category}</span>
                      </td>
                      <td>{lead.sentiment || 'neutral'}</td>
                      <td>{lead.buying_signal || 'low'}</td>
                      <td>{lead.qualification_progress}%</td>
                      <td>
                        {lead.updated_at
                          ? new Date(lead.updated_at).toLocaleDateString()
                          : '--'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedLead && (
          <aside className="panel-card lead-detail-card" aria-label="Lead details">
            <div className="panel-header">
              <h3 className="panel-title">Lead Details</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedLead(null)}
                aria-label="Close lead details"
              >
                <X size={16} />
              </button>
            </div>
            {selectedLead.requires_human && (
              <div className="voice-error-banner" role="alert">
                Human intervention recommended
              </div>
            )}
            <ul className="qualification-fields">
              <li>
                <strong>Name:</strong> {selectedLead.customer_name || '--'}
              </li>
              <li>
                <strong>Company:</strong> {selectedLead.company_name || '--'}
              </li>
              <li>
                <strong>Business Type:</strong> {selectedLead.business_type || '--'}
              </li>
              <li>
                <strong>Requirements:</strong> {selectedLead.requirements || '--'}
              </li>
              <li>
                <strong>Call Volume:</strong>{' '}
                {selectedLead.monthly_call_volume || '--'}
              </li>
              <li>
                <strong>Budget:</strong> {selectedLead.budget || '--'}
              </li>
              <li>
                <strong>Timeline:</strong>{' '}
                {selectedLead.purchase_timeline || '--'}
              </li>
              <li>
                <strong>Authority:</strong>{' '}
                {selectedLead.decision_authority || '--'}
              </li>
              <li>
                <strong>Score:</strong> {selectedLead.lead_score}/100 (
                {selectedLead.lead_category})
              </li>
              <li>
                <strong>Progress:</strong> {selectedLead.qualification_progress}%
              </li>
              <li>
                <strong>Status:</strong> {selectedLead.status}
              </li>
              <li>
                <strong>Sentiment:</strong> {selectedLead.sentiment || 'neutral'} (
                {selectedLead.emotion || 'unknown'})
              </li>
              <li>
                <strong>Intent:</strong>{' '}
                {(selectedLead.intent || 'general_inquiry').replace(/_/g, ' ')}
              </li>
              <li>
                <strong>Buying Signal:</strong>{' '}
                {selectedLead.buying_signal || 'low'}
              </li>
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
