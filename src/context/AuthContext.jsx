import { createContext, useContext, useState, useCallback } from 'react';
import { login as apiLogin } from '../api/middleware';
import axios from 'axios';

const AuthContext = createContext(null);

const KEYCLOAK_URL =
  '/keycloak/realms/fayma/protocol/openid-connect/token';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function login(username, password) {
    setLoading(true);
    setError('');
    try {
      const data = await apiLogin(username, password);

      let payload = {};
      try {
        const b64 = data.access_token.split('.')[1];
        payload = JSON.parse(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)));
      } catch (_) {
        console.warn('Impossible de décoder le JWT');
      }

      let activeClient = '5';
      const clientIds = payload.clientId;
      if (Array.isArray(clientIds) && clientIds.length > 0) {
        activeClient = String(clientIds[0]);
      } else if (typeof clientIds === 'string' || typeof clientIds === 'number') {
        activeClient = String(clientIds);
      }

      setUser({
        token:        data.access_token,
        refreshToken: data.refresh_token,
        username,
        nom:          payload.name || payload.given_name || payload.preferred_username || username,
        activeClient,
        clientName:   payload.client_name || payload.clientName || 'Fayma',
        email:        payload.email || username,
        expiresAt:    Date.now() + (data.expires_in - 30) * 1000,
      });
    } catch (e) {
      console.error('Erreur login :', e.response?.data || e.message);
      const msg =
        e.response?.data?.error_description ||
        e.response?.data?.message ||
        'Identifiant ou mot de passe invalide';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const getValidToken = useCallback(async () => {
    if (!user) return null;

    if (Date.now() < user.expiresAt) {
      return user.token;
    }

    try {
      const params = new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     'abi-api',
        client_secret: '9cUkA1J1X1TSFUmGytneDf4qXaF84U9H',
        refresh_token: user.refreshToken,
      });
      const res = await axios.post(KEYCLOAK_URL, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const refreshed = res.data;
      const newUser = {
        ...user,
        token:        refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt:    Date.now() + (refreshed.expires_in - 30) * 1000,
      };
      setUser(newUser);
      return refreshed.access_token;
    } catch (e) {
      console.error('Refresh token expiré, déconnexion');
      setUser(null);
      return null;
    }
  }, [user]);

  function logout() {
    setUser(null);
    setError('');
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error, getValidToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}