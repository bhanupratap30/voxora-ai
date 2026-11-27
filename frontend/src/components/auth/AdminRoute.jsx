import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminRoute() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-container" style={{ padding: '3rem', textAlign: 'center' }}>
        Verifying admin privileges...
      </div>
    );
  }

  if (!profile?.is_super_admin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
