// src/pages/Login.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    await login(username, password);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>F</div>
          <span style={styles.logoText}>Fayma</span>
          <span style={styles.logoSub}>e-Invoice</span>
        </div>

        <h1 style={styles.title}>Connexion</h1>
        <p style={styles.subtitle}>
          Accédez à votre espace de facturation électronique
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Identifiant ou email</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username ou email@example.com"
              required
              autoComplete="username"
              style={styles.input}
            />
            <span style={styles.fieldHint}>
              Utilisez votre email ou votre identifiant Fayma
            </span>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p style={styles.hint}>
          Vos identifiants sont ceux de votre compte Fayma fournisseur
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #042C53 0%, #185FA5 100%)',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '32px',
  },
  logoIcon: {
    width: '36px', height: '36px',
    background: '#185FA5', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: '700', fontSize: '18px',
  },
  logoText: { fontSize: '20px', fontWeight: '700', color: '#042C53' },
  logoSub: { fontSize: '13px', color: '#888', marginLeft: '-4px' },
  title: { fontSize: '24px', fontWeight: '600', color: '#042C53', marginBottom: '8px' },
  subtitle: { fontSize: '14px', color: '#666', marginBottom: '32px' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '500', color: '#444' },
  fieldHint: { fontSize: '12px', color: '#999' },
  input: {
    padding: '11px 14px',
    border: '1.5px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '15px',
    outline: 'none',
  },
  error: {
    padding: '12px 14px',
    background: '#FCEBEB',
    color: '#A32D2D',
    borderRadius: '8px',
    fontSize: '14px',
  },
  btn: {
    padding: '13px',
    background: '#185FA5',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
  },
  hint: {
    marginTop: '24px',
    fontSize: '13px',
    color: '#999',
    textAlign: 'center',
  },
};