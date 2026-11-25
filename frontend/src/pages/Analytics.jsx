import { useEffect, useState } from 'react';
import { BarChart3, Bot, Calendar, PhoneCall, TrendingUp, Users } from 'lucide-react';
import { getAnalytics } from '../services/api.js';

function BarRow({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: '0.625rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.8125rem',
          marginBottom: '0.25rem',
        }}
      >
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="qualification-bar">
        <div className="qualification-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = async (sDate = startDate, eDate = endDate) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await getAnalytics({ startDate: sDate, endDate: eDate });
      setData(res);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load analytics.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics('', '');
  }, []);

  const handleFilter = (e) => {
    e.preventDefault();
    loadAnalytics(startDate, endDate);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    loadAnalytics('', '');
  };

  const cp = data?.call_performance;
  const lp = data?.lead_performance;
  const sa = data?.sentiment_analysis;
  const ap = data?.appointment_performance;
  const si = data?.sales_insights;

  const kpis = [
    { label: 'Total Calls', value: cp ? cp.total_calls : '--', icon: PhoneCall },
    {
      label: 'Avg Call Duration',
      value: cp ? `${cp.avg_duration_seconds}s` : '--',
      icon: TrendingUp,
    },
    {
      label: 'Qualification Rate',
      value: lp ? `${lp.qualification_rate}%` : '--',
      icon: Users,
    },
    {
      label: 'Booking Rate',
      value: ap ? `${ap.booking_rate}%` : '--',
      icon: Calendar,
    },
  ];

  const leadMax = lp
    ? Math.max(
        lp.category_distribution.Hot,
        lp.category_distribution.Warm,
        lp.category_distribution.Cold,
        1
      )
    : 1;

  const sentMax = sa
    ? Math.max(
        sa.sentiment_distribution.positive,
        sa.sentiment_distribution.neutral,
        sa.sentiment_distribution.negative,
        1
      )
    : 1;

  const funnelMax = si?.conversion_funnel?.[0]?.count || 1;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Analytics</h2>
        <p>Real-time sales performance, conversion funnel, and AI insights.</p>
      </div>

      <section className="panel-card leads-toolbar-card" aria-label="Date filter">
        <form className="kb-upload-form" onSubmit={handleFilter}>
          <input
            type="date"
            className="kb-file-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
          />
          <input
            type="date"
            className="kb-file-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
          />
          <button type="submit" className="primary-button">
            Apply
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleReset}
          >
            Reset
          </button>
        </form>
      </section>

      {error && (
        <div className="voice-error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="metrics-grid" aria-label="Analytics KPIs">
        {kpis.map(({ label, value, icon: Icon }) => (
          <article key={label} className="metric-card">
            <div className="metric-card-top">
              <span className="metric-label">{label}</span>
              <span className="metric-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
            </div>
            <div className="metric-value">{isLoading ? '...' : value}</div>
          </article>
        ))}
      </section>

      {data && (
        <div className="dashboard-grid">
          <div className="dashboard-side-stack">
            <section className="panel-card" aria-label="Conversion funnel">
              <div className="panel-header">
                <h3 className="panel-title">
                  <BarChart3 size={18} aria-hidden="true" />
                  <span>Sales Conversion Funnel</span>
                </h3>
              </div>
              {(si?.conversion_funnel || []).map((item) => (
                <BarRow
                  key={item.stage}
                  label={item.stage}
                  value={item.count}
                  max={funnelMax}
                />
              ))}
            </section>

            <section className="panel-card" aria-label="Lead categories">
              <div className="panel-header">
                <h3 className="panel-title">Lead Categories</h3>
                <span className="status-pill">
                  Avg Score: {lp?.avg_lead_score ?? 0}
                </span>
              </div>
              <BarRow
                label="Hot"
                value={lp?.category_distribution?.Hot ?? 0}
                max={leadMax}
              />
              <BarRow
                label="Warm"
                value={lp?.category_distribution?.Warm ?? 0}
                max={leadMax}
              />
              <BarRow
                label="Cold"
                value={lp?.category_distribution?.Cold ?? 0}
                max={leadMax}
              />
            </section>
          </div>

          <div className="dashboard-side-stack">
            <section className="panel-card" aria-label="Sentiment distribution">
              <div className="panel-header">
                <h3 className="panel-title">Sentiment Distribution</h3>
                <span className="status-pill">
                  Human Alerts: {sa?.human_intervention_count ?? 0}
                </span>
              </div>
              <BarRow
                label="Positive"
                value={sa?.sentiment_distribution?.positive ?? 0}
                max={sentMax}
              />
              <BarRow
                label="Neutral"
                value={sa?.sentiment_distribution?.neutral ?? 0}
                max={sentMax}
              />
              <BarRow
                label="Negative"
                value={sa?.sentiment_distribution?.negative ?? 0}
                max={sentMax}
              />
            </section>

            <section className="panel-card" aria-label="AI business insights">
              <div className="panel-header">
                <h3 className="panel-title">
                  <Bot size={18} aria-hidden="true" />
                  <span>AI Business Insights</span>
                </h3>
              </div>
              <p className="agent-status-note">{data.ai_insights}</p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
