import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ImportFacture from './pages/ImportFacture';
import ExportFacture from './pages/ExportFacture';
import './index.css';

function Nav({ page, setPage }) {
  const { user, logout } = useAuth();
  return (
    <nav style={styles.nav}>
      <div style={styles.navLeft}>
        <div style={styles.navLogo}>
          <div style={styles.navLogoIcon}>F</div>
          <span style={styles.navLogoText}>Fayma e-Invoice</span>
        </div>
        <div style={styles.navLinks}>
          <button
            onClick={() => setPage('import')}
            style={{ ...styles.navLink, ...(page === 'import' ? styles.navLinkActive : {}) }}
          >
            ↑ Insérer une facture
          </button>
          <button
            onClick={() => setPage('export')}
            style={{ ...styles.navLink, ...(page === 'export' ? styles.navLinkActive : {}) }}
          >
            ↓ Mes factures
          </button>
        </div>
      </div>
      <div style={styles.navRight}>
        <div style={styles.userInfo}>
          <div style={styles.userAvatar}>
            {user.nom?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={styles.userName}>{user.nom}</div>
            <div style={styles.userClient}>{user.clientName}</div>
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtn}>Déconnexion</button>
      </div>
    </nav>
  );
}

function AppInner() {
  const { user } = useAuth();
  const [page, setPage] = useState('import');
  if (!user) return <Login />;
  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4' }}>
      <Nav page={page} setPage={setPage} />
      <main style={styles.main}>
        {page === 'import' && <ImportFacture />}
        {page === 'export' && <ExportFacture />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

const styles = {
  nav: {
    background: '#042C53', padding: '0 32px',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', height: '60px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '32px' },
  navLogo: { display: 'flex', alignItems: 'center', gap: '10px' },
  navLogoIcon: {
    width: '30px', height: '30px', background: '#378ADD',
    borderRadius: '6px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '16px',
  },
  navLogoText: { color: '#fff', fontWeight: '700', fontSize: '16px' },
  navLinks: { display: 'flex', gap: '4px' },
  navLink: {
    padding: '6px 16px', border: 'none', borderRadius: '6px',
    fontSize: '14px', fontWeight: '500', cursor: 'pointer',
    background: 'transparent', color: '#B5D4F4',
  },
  navLinkActive: { background: '#185FA5', color: '#fff' },
  navRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: {
    width: '32px', height: '32px', background: '#378ADD',
    borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '14px',
  },
  userName: { color: '#fff', fontSize: '14px', fontWeight: '500' },
  userClient: { color: '#B5D4F4', fontSize: '12px' },
  logoutBtn: {
    padding: '6px 14px', background: 'rgba(255,255,255,0.1)',
    color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
  },
  main: { padding: '32px 24px' },
};
