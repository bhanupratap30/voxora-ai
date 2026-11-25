import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Plus, XCircle } from 'lucide-react';
import {
  cancelAppointment,
  createAppointment,
  getAppointments,
  updateAppointment,
} from '../services/api.js';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [meetingType, setMeetingType] = useState('online');

  const loadAppointments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getAppointments();
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load appointments.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !appointmentDate || !startTime || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const created = await createAppointment({
        customer_name: customerName.trim(),
        company_name: companyName.trim() || null,
        appointment_date: appointmentDate,
        start_time: startTime,
        meeting_type: meetingType,
      });
      setSuccess(
        `Scheduled demo for ${created.customer_name} on ${created.appointment_date} at ${created.start_time}.`
      );
      setCustomerName('');
      setCompanyName('');
      setAppointmentDate('');
      setStartTime('');
      await loadAppointments();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to create appointment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (id) => {
    setError('');
    setSuccess('');
    try {
      await updateAppointment(id, { status: 'completed' });
      setSuccess('Appointment marked as completed.');
      await loadAppointments();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to update appointment.'
      );
    }
  };

  const handleCancel = async (id) => {
    setError('');
    setSuccess('');
    try {
      await cancelAppointment(id);
      setSuccess('Appointment cancelled.');
      await loadAppointments();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to cancel appointment.'
      );
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Appointments</h2>
        <p>Schedule and manage AI-booked sales demos.</p>
      </div>

      <section className="panel-card kb-upload-card" aria-label="Schedule appointment">
        <form className="kb-upload-form" onSubmit={handleCreate}>
          <input
            type="text"
            className="kb-file-input"
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
          <input
            type="text"
            className="kb-file-input"
            placeholder="Company (optional)"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <input
            type="date"
            className="kb-file-input"
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
            required
          />
          <input
            type="time"
            className="kb-file-input"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <select
            className="kb-file-input"
            value={meetingType}
            onChange={(e) => setMeetingType(e.target.value)}
            aria-label="Meeting type"
          >
            <option value="online">Online</option>
            <option value="phone">Phone</option>
          </select>
          <button
            type="submit"
            className="primary-button"
            disabled={isSubmitting}
          >
            <Plus size={16} aria-hidden="true" />
            <span>{isSubmitting ? 'Booking...' : 'Schedule'}</span>
          </button>
        </form>

        {error && (
          <div className="voice-error-banner" role="alert" style={{ marginTop: '0.75rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div className="kb-success-banner" role="status">
            {success}
          </div>
        )}
      </section>

      <section className="panel-card" aria-label="Appointments list">
        <div className="panel-header">
          <h3 className="panel-title">
            <Calendar size={18} aria-hidden="true" />
            <span>Scheduled Demos</span>
          </h3>
          <span className="status-pill">{appointments.length} total</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Company</th>
                <th>Date</th>
                <th>Time</th>
                <th>Meeting Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    Loading appointments...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No appointments scheduled yet.
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => (
                  <tr key={appt.id}>
                    <td>{appt.customer_name}</td>
                    <td>{appt.company_name || '--'}</td>
                    <td>{appt.appointment_date}</td>
                    <td>
                      {appt.start_time} – {appt.end_time}
                    </td>
                    <td>{appt.meeting_type}</td>
                    <td>
                      <span className="status-pill">{appt.status}</span>
                    </td>
                    <td>
                      {appt.status === 'scheduled' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleComplete(appt.id)}
                          >
                            <CheckCircle2 size={14} aria-hidden="true" />
                            <span>Complete</span>
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleCancel(appt.id)}
                          >
                            <XCircle size={14} aria-hidden="true" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      ) : (
                        '--'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
