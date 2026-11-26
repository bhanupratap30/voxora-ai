import { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { getMe, onboardUser, setAuthHeaders } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncBackendProfile = async (currentSession, onboardPayload = null) => {
    if (!currentSession?.access_token) {
      setAuthHeaders(null, null);
      setProfile(null);
      setWorkspaces([]);
      setActiveWorkspace(null);
      return;
    }

    setAuthHeaders(currentSession.access_token, null);
    try {
      const data = onboardPayload
        ? await onboardUser(onboardPayload)
        : await getMe();
      setProfile(data);
      const list = data.workspaces || [];
      setWorkspaces(list);
      const savedId = Number(localStorage.getItem('voxora_workspace_id'));
      const matched = list.find((w) => w.id === savedId) || list[0] || null;
      setActiveWorkspace(matched);
      if (matched) {
        setAuthHeaders(currentSession.access_token, matched.id);
      }
    } catch {
      // Backend may be offline; keep Supabase session
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await syncBackendProfile(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        await syncBackendProfile(newSession);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const switchWorkspace = (workspaceId) => {
    const found = workspaces.find((w) => w.id === Number(workspaceId));
    if (!found) return;
    setActiveWorkspace(found);
    localStorage.setItem('voxora_workspace_id', String(found.id));
    setAuthHeaders(session?.access_token || null, found.id);
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('voxora_workspace_id');
    setAuthHeaders(null, null);
    setSession(null);
    setProfile(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        profile,
        workspaces,
        activeWorkspace,
        loading,
        isSupabaseConfigured,
        syncBackendProfile,
        switchWorkspace,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
