import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bot,
  Calendar,
  Mic,
  PhoneCall,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import AnimatedNumber from '../components/animations/AnimatedNumber.jsx';
import AudioWaveform from '../components/voice/AudioWaveform.jsx';
import { getDashboardSummary, getHealthStatus } from '../services/api.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      try {
        const [health, dash] = await Promise.all([
          getHealthStatus().catch(() => null),
          getDashboardSummary().catch(() => null),
        ]);
        if (!active) return;
        setAgentOnline(health?.status === 'ok');
        setSummary(dash);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const recentCalls = summary?.recent_calls || [];
  const recentActivity = summary?.recent_activity || [];
  const callsOverTime = summary?.calls_over_time || [];
  const qualifiedCount = summary?.lead_breakdown?.qualified ?? 0;
  const unqualifiedCount = summary?.lead_breakdown?.unqualified ?? 0;
  const totalBreakdown = qualifiedCount + unqualifiedCount;
  const maxCalls = Math.max(...callsOverTime.map((d) => d.calls), 1);

  return (
    <div className="page-container command-centre">
      {/* Hero Experience */}
      <section className="hero-command-card" aria-label="Voxora AI Hero">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            <span>AI Sales Command Centre</span>
            <span className="status-pill" style={{ marginLeft: '0.5rem' }}>
              <span
                className={`status-dot ${agentOnline ? 'status-dot-online' : ''}`}
                aria-hidden="true"
              />
              <span>{agentOnline ? 'Agent Online' : 'Agent Offline'}</span>
            </span>
          </div>

          <h2 className="hero-headline">Your sales, on autopilot.</h2>
          <p className="hero-subtitle">
            Autonomous voice conversations in English and Hindi, grounded in
            your product knowledge base, with real-time lead scoring and demo
            scheduling.
          </p>

          <div className="hero-actions">
            <Link to="/voice-agent" className="primary-button hero-cta">
              <Mic size={18} aria-hidden="true" />
              <span>Start Voice Agent</span>
            </Link>
            <Link to="/analytics" className="secondary-button">
              <BarChart3 size={16} aria-hidden="true" />
              <span>View Analytics</span>
            </Link>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-purple-aura" />
          <div className="hero-orb">
            <Bot size={28} />
            <AudioWaveform active={agentOnline} />
          </div>
        </div>
      </section>

      {/* Asymmetric KPI Bento Grid */}
      <section className="bento-kpi-grid" aria-label="Key metrics">
        <article className="metric-card bento-kpi-featured">
          <div className="metric-card-top">
            <span className="metric-label">Total Calls</span>
            <span className="metric-icon" aria-hidden="true">
              <PhoneCall size={18} />
            </span>
          </div>
          <div className="bento-kpi-number">
            {isLoading ? '...' : summary ? <AnimatedNumber value={summary.total_calls} /> : '--'}
          </div>
          <p className="bento-kpi-meta">Completed voice & chat sessions</p>
        </article>

        <article className="metric-card bento-kpi-beige">
          <div className="metric-card-top">
            <span className="metric-label">Total Leads</span>
            <span className="metric-icon" aria-hidden="true">
              <Users size={18} />
            </span>
          </div>
          <div className="bento-kpi-number">
            {isLoading ? '...' : summary ? <AnimatedNumber value={summary.total_leads} /> : '--'}
          </div>
          <p className="bento-kpi-meta">Captured in CRM</p>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Qualified Leads</span>
            <span className="metric-icon" aria-hidden="true">
              <UserCheck size={18} />
            </span>
          </div>
          <div className="bento-kpi-number">
            {isLoading ? '...' : summary ? <AnimatedNumber value={summary.qualified_leads} /> : '--'}
          </div>
          <p className="bento-kpi-meta">Score 40+ or complete</p>
        </article>

        <article className="metric-card bento-kpi-beige">
          <div className="metric-card-top">
            <span className="metric-label">Appointments</span>
            <span className="metric-icon" aria-hidden="true">
              <Calendar size={18} />
            </span>
          </div>
          <div className="bento-kpi-number">
            {isLoading ? '...' : summary ? <AnimatedNumber value={summary.total_appointments} /> : '--'}
          </div>
          <p className="bento-kpi-meta">Scheduled demos</p>
        </article>
      </section>

      {/* Sales Intelligence + AI Intelligence */}
      <div className="dashboard-grid">
        <section className="panel-card" aria-label="Sales intelligence">
          <div className="panel-header">
            <h3 className="panel-title">
              <BarChart3 size={18} aria-hidden="true" />
              <span>Sales Intelligence</span>
            </h3>
            <Link to="/analytics" className="status-pill" style={{ textDecoration: 'none' }}>
              <span>Deep Dive</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {callsOverTime.length === 0 && totalBreakdown === 0 ? (
            <div className="activity-empty">
              No call or lead data recorded yet. Start a voice session to
              populate live intelligence.
            </div>
          ) : (
            <div className="intelligence-grid">
              <div>
                <div className="intelligence-sublabel">Calls Over Time</div>
                <div className="mini-bar-chart">
                  {callsOverTime.map((pt) => (
                    <div key={pt.date} className="mini-bar-col">
                      <div
                        className="mini-bar-fill"
                        style={{ height: `${Math.max(16, (pt.calls / maxCalls) * 100)}%` }}
                        title={`${pt.date}: ${pt.calls} call(s)`}
                      />
                      <span className="mini-bar-label">{pt.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="intelligence-sublabel">Lead Qualification</div>
                <div className="qualification-fields" style={{ borderTop: 'none', paddingTop: 0 }}>
                  <div>
                    <strong>Qualified:</strong> {qualifiedCount}
                  </div>
                  <div>
                    <strong>Unqualified:</strong> {unqualifiedCount}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="panel-card" aria-label="AI intelligence">
          <div className="panel-header">
            <h3 className="panel-title">
              <Bot size={18} aria-hidden="true" />
              <span>AI Intelligence</span>
            </h3>
            <span className="status-pill">
              <span
                className={`status-dot ${agentOnline ? 'status-dot-online' : ''}`}
                aria-hidden="true"
              />
              <span>{agentOnline ? 'Ready' : 'Offline'}</span>
            </span>
          </div>
          <p className="agent-status-note">
            {agentOnline
              ? 'Groq LLM, ChromaDB RAG, and sentiment analysis are online and ready.'
              : 'Backend API is offline. Start FastAPI to enable live AI intelligence.'}
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link to="/analytics" className="secondary-button">
              <span>Open Full Analytics</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
      </div>

      {/* Recent Conversations Timeline + Activity */}
      <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
        <section className="panel-card" aria-label="Recent conversations">
          <div className="panel-header">
            <h3 className="panel-title">
              <PhoneCall size={18} aria-hidden="true" />
              <span>Recent Conversations</span>
            </h3>
          </div>
          {recentCalls.length === 0 ? (
            <div className="activity-empty">No conversations recorded yet.</div>
          ) : (
            <div className="timeline-feed">
              {recentCalls.map((call) => (
                <div
                  key={call.id}
                  className="timeline-item"
                  onClick={() => navigate('/call-history')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate('/call-history');
                  }}
                >
                  <div className="timeline-dot" aria-hidden="true" />
                  <div className="timeline-body">
                    <div className="timeline-top">
                      <strong>{call.customer_name}</strong>
                      <span className="status-pill">{call.outcome}</span>
                    </div>
                    <div className="timeline-meta">
                      {call.company_name} • {call.date} • {call.duration} •{' '}
                      {call.sentiment}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel-card" aria-label="Recent activity">
          <div className="panel-header">
            <h3 className="panel-title">
              <Activity size={18} aria-hidden="true" />
              <span>Recent Activity</span>
            </h3>
          </div>
          {recentActivity.length === 0 ? (
            <div className="activity-empty">No recent activity yet.</div>
          ) : (
            <ul className="qualification-fields" style={{ borderTop: 'none', paddingTop: 0 }}>
              {recentActivity.map((act, idx) => (
                <li key={idx}>
                  <strong>{act.type}:</strong> {act.title}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
