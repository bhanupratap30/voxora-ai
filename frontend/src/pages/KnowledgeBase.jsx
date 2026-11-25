import { useEffect, useRef, useState } from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';
import {
  deleteKnowledgeBaseDocument,
  getKnowledgeBaseDocuments,
  uploadKnowledgeBasePdf,
} from '../services/api.js';

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getKnowledgeBaseDocuments();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load Knowledge Base documents.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setError('');
    setSuccess('');
    setSelectedFile(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      const result = await uploadKnowledgeBasePdf(selectedFile);
      setSuccess(
        `Uploaded "${result.filename}" (${result.chunk_count} chunks stored).`
      );
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadDocuments();
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to upload PDF.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    if (deletingId) return;
    const confirmed = window.confirm(
      `Delete "${doc.filename}" and all ${doc.chunk_count} chunks?`
    );
    if (!confirmed) return;

    setDeletingId(doc.document_id);
    setError('');
    setSuccess('');

    try {
      await deleteKnowledgeBaseDocument(doc.document_id);
      setSuccess(`Deleted "${doc.filename}".`);
      setDocuments((prev) =>
        prev.filter((item) => item.document_id !== doc.document_id)
      );
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to delete document.'
      );
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Knowledge Base</h2>
        <p>Upload PDF product docs and sales playbooks to ChromaDB.</p>
      </div>

      <section className="panel-card kb-upload-card" aria-label="Upload PDF">
        <form className="kb-upload-form" onSubmit={handleUpload}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="kb-file-input"
            onChange={handleFileChange}
            disabled={isUploading}
            aria-label="Select PDF file"
          />
          <button
            type="submit"
            className="primary-button"
            disabled={!selectedFile || isUploading}
          >
            <Upload size={16} aria-hidden="true" />
            <span>{isUploading ? 'Uploading...' : 'Upload PDF'}</span>
          </button>
        </form>
        <p className="kb-hint">
          PDF files only, up to 10 MB. Text is extracted and chunked
          automatically.
        </p>

        {error && (
          <div className="voice-error-banner" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="kb-success-banner" role="status">
            {success}
          </div>
        )}
      </section>

      <section className="panel-card" aria-label="Uploaded documents">
        <div className="panel-header">
          <h3 className="panel-title">
            <FileText size={18} aria-hidden="true" />
            <span>Uploaded Documents</span>
          </h3>
          <span className="status-pill">{documents.length} total</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Chunks</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    Loading documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No documents uploaded yet. Upload a PDF above to get started.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.document_id}>
                    <td>{doc.filename}</td>
                    <td>{doc.chunk_count}</td>
                    <td>
                      <span className="status-pill">{doc.status}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleDelete(doc)}
                        disabled={deletingId === doc.document_id}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        <span>
                          {deletingId === doc.document_id
                            ? 'Deleting...'
                            : 'Delete'}
                        </span>
                      </button>
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
