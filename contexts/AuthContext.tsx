import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, clearTokens, setTokens } from '../lib/auth/apiClient';
import { cancellaSessione, getSessione, salvaSessione } from '../lib/db/sqlite';
import { API_BASE } from '../constants/api';

export type Utente = {
  id: number;
  nome: string;
  email: string;
  ruolo: 'trasportatore' | 'admin';
};

type AuthCtx = {
  utente: Utente | null;
  isAdmin: boolean;
  idTrasportatore: number | undefined;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [utente, setUtente]   = useState<Utente | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Prova a caricare utente dal server
      try {
        const res = await apiFetch('/auth/me');
        if (res.ok) {
          const u = await res.json();
          setUtente(u);
          salvaSessione(u);
          return;
        }
      } catch {}
      // Fallback offline: leggi da SQLite
      const sessione = getSessione();
      if (sessione) setUtente(sessione as Utente);
      setLoading(false);
    })().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Credenziali non valide');
    const data = await res.json();
    await setTokens(data.accessToken, data.refreshToken);
    setUtente(data.utente);
    salvaSessione(data.utente);
  };

  const logout = async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
    await clearTokens();
    cancellaSessione();
    setUtente(null);
  };

  return (
    <AuthContext.Provider value={{
      utente,
      isAdmin: utente?.ruolo === 'admin',
      idTrasportatore: utente?.ruolo === 'trasportatore' ? utente.id : undefined,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() { return useContext(AuthContext)!; }
