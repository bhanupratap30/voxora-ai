import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export async function sendChatMessage(
  message,
  language = 'English',
  sessionId = 'default'
) {
  const response = await apiClient.post('/api/chat', {
    message,
    language,
    session_id: sessionId,
  });
  return response.data;
}

export async function uploadKnowledgeBasePdf(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/api/knowledge-base/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return response.data;
}

export async function getKnowledgeBaseDocuments() {
  const response = await apiClient.get('/api/knowledge-base/documents');
  return response.data;
}

export async function deleteKnowledgeBaseDocument(documentId) {
  const response = await apiClient.delete(
    `/api/knowledge-base/documents/${documentId}`
  );
  return response.data;
}

export async function getLeads({ skip = 0, limit = 20, search = '', category = '' } = {}) {
  const params = { skip, limit };
  if (search) params.search = search;
  if (category) params.category = category;
  const response = await apiClient.get('/api/leads', { params });
  return response.data;
}

export async function getLeadById(leadId) {
  const response = await apiClient.get(`/api/leads/${leadId}`);
  return response.data;
}

export async function updateLead(leadId, payload) {
  const response = await apiClient.patch(`/api/leads/${leadId}`, payload);
  return response.data;
}

export async function getAppointments({ status = '', skip = 0, limit = 50 } = {}) {
  const params = { skip, limit };
  if (status) params.status = status;
  const response = await apiClient.get('/api/appointments', { params });
  return response.data;
}

export async function createAppointment(payload) {
  const response = await apiClient.post('/api/appointments', payload);
  return response.data;
}

export async function updateAppointment(appointmentId, payload) {
  const response = await apiClient.patch(
    `/api/appointments/${appointmentId}`,
    payload
  );
  return response.data;
}

export async function cancelAppointment(appointmentId) {
  const response = await apiClient.delete(
    `/api/appointments/${appointmentId}`
  );
  return response.data;
}

export async function getHealthStatus() {
  const response = await apiClient.get('/api/health');
  return response.data;
}

export async function getDashboardSummary() {
  const response = await apiClient.get('/api/dashboard');
  return response.data;
}

export async function startCallSession(sessionId) {
  const response = await apiClient.post('/api/calls/start', {
    session_id: sessionId,
  });
  return response.data;
}

export async function appendCallMessage(sessionId, speaker, message, time) {
  const response = await apiClient.post(`/api/calls/${sessionId}/messages`, {
    speaker,
    message,
    time,
  });
  return response.data;
}

export async function endCallSession(sessionId, status = 'completed') {
  const response = await apiClient.post(`/api/calls/${sessionId}/end`, {
    status,
  });
  return response.data;
}

export async function getCalls({ search = '', status = '', skip = 0, limit = 50 } = {}) {
  const params = { skip, limit };
  if (search) params.search = search;
  if (status) params.status = status;
  const response = await apiClient.get('/api/calls', { params });
  return response.data;
}

export async function getCallById(callId) {
  const response = await apiClient.get(`/api/calls/${callId}`);
  return response.data;
}

export async function getAnalytics({ startDate = '', endDate = '' } = {}) {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  const response = await apiClient.get('/api/analytics', { params });
  return response.data;
}

export default apiClient;
