import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { session, loading, isSupabaseConfigured } = useAuth();

  if (loading) {
    return (
      <div className="page-container" style={{ padding: '3rem', textAlign: 'center' }}>
        Loading session...
      </div>
    );
  }

  if (isSupabaseConfigured && !session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
