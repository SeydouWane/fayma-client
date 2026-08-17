import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFactures, downloadXML } from '../api/middleware';

const ETATS = {
  BROUILLON: { color: '#888', bg: '#f0f0f0' },
  ENVOYEE: { color: '#185FA5', bg: '#E6F1FB' },
  EN_VALIDATION: { color: '#BA7517', bg: '#FAEEDA' },
  VALIDEE: { color: '#0F6E56', bg: '#E1F5EE' },
  PAYEE: { color: '#042C53', bg: '#B5D4F4' },
  REJETEE: { color: '#A32D2D', bg: '#FCEBEB' },
};

export default function ExportFacture() {
  const { user } = useAuth();
  const [factures, setFactures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getFactures(user.token)
      .then(setFactures)
      .catch(() => setError('Impossible de charger les factures'))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownload(facture) {
    setDownloading(facture.id);
    try {
      const blob = await downloadXML(facture.id, user.token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${facture.numero}_UBL.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Erreur téléchargement : ${facture.numero}`);
    } finally {
      setDownloading('');
    }
  }

  const filtered = factures.filter(f =>
    !search ||
    f.numero?.toLowerCase().includes(search.toLowerCase()) ||
    f.fournisseur?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Mes factures</h1>
          <p style={styles.subtitle}>Consultez et téléchargez vos factures au format UBL 2.1</p>
        </div>
        <div style={styles.badge}>{factures.length} facture{factures.length > 1 ? 's' : ''}</div>
      </div>

      <input
        type="text"
        placeholder="Rechercher par numéro ou fournisseur..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={styles.search}
      />

      {error && <div style={styles.errorBox}>{error}</div>}

      {loading ? (
        <div style={styles.loading}>Chargement des factures...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontWeight: '600', marginBottom: '6px' }}>Aucune facture trouvée</div>
          <div style={{ fontSize: '14px', color: '#999' }}>
            {search ? 'Modifiez votre recherche' : 'Aucune facture disponible pour votre compte'}
          </div>
        </div>
      ) : (
        <div style={styles.list}>
          {filtered.map(f => {
            const etat = ETATS[f.etat] || ETATS.BROUILLON;
            return (
              <div key={f.id} style={styles.card}>
                <div style={styles.cardLeft}>
                  <div style={styles.cardIcon}>📄</div>
                  <div>
                    <div style={styles.cardNumero}>{f.numero}</div>
                    <div style={styles.cardMeta}>
                      {f.fournisseur && <span>{f.fournisseur}</span>}
                      {f.client && <span> · {f.client}</span>}
                      {f.dateEmission && (
                        <span> · {new Date(f.dateEmission).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={styles.cardRight}>
                  {f.montantTotal && (
                    <div style={styles.cardMontant}>
                      {f.montantTotal.toLocaleString()} XOF
                    </div>
                  )}
                  <span style={{ ...styles.etatBadge, color: etat.color, background: etat.bg }}>
                    {f.etat}
                  </span>
                  <button
                    onClick={() => handleDownload(f)}
                    disabled={downloading === f.id}
                    style={{
                      ...styles.dlBtn,
                      opacity: downloading === f.id ? 0.6 : 1,
                    }}
                    title="Télécharger en UBL 2.1"
                  >
                    {downloading === f.id ? '...' : '⬇ XML'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: '800px', margin: '0 auto', padding: '32px 24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '22px', fontWeight: '700', color: '#042C53', marginBottom: '4px' },
  subtitle: { color: '#666', fontSize: '14px' },
  badge: {
    background: '#E6F1FB', color: '#185FA5',
    padding: '4px 12px', borderRadius: '20px',
    fontSize: '13px', fontWeight: '600',
  },
  search: {
    width: '100%', padding: '11px 14px',
    border: '1.5px solid #e0e0e0', borderRadius: '8px',
    fontSize: '14px', marginBottom: '20px', outline: 'none',
  },
  errorBox: {
    padding: '12px 14px', background: '#FCEBEB',
    color: '#A32D2D', borderRadius: '8px',
    fontSize: '14px', marginBottom: '16px',
  },
  loading: { textAlign: 'center', padding: '48px', color: '#888' },
  empty: {
    textAlign: 'center', padding: '48px',
    background: '#fff', borderRadius: '12px',
    border: '1px solid #eee',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  card: {
    background: '#fff', borderRadius: '10px',
    border: '1px solid #eee', padding: '16px 20px',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  cardLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  cardIcon: { fontSize: '24px' },
  cardNumero: { fontWeight: '600', fontSize: '15px', color: '#042C53' },
  cardMeta: { fontSize: '13px', color: '#888', marginTop: '2px' },
  cardRight: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
  cardMontant: { fontSize: '14px', fontWeight: '600', color: '#333' },
  etatBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  dlBtn: {
    padding: '7px 14px', background: '#185FA5',
    color: '#fff', border: 'none', borderRadius: '6px',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
  },
};
