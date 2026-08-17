import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getContrats, getOP, importerFacture } from '../api/middleware';

export default function ImportFacture() {
  const { user, getValidToken } = useAuth();
  const [contrats, setContrats]   = useState([]);
  const [ops, setOps]             = useState([]);
  const [contratSel, setContratSel] = useState('');
  const [opSel, setOpSel]         = useState('');
  const [file, setFile]           = useState(null);
  const [dryRun, setDryRun]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');
  const [step, setStep]           = useState('form');

  useEffect(() => {
    getContrats(user.activeClient, user.token)
      .then(setContrats)
      .catch(() => setError('Impossible de charger les contrats'));
  }, []);

  useEffect(() => {
    if (!contratSel) { setOps([]); setOpSel(''); return; }
    getOP(contratSel, user.activeClient, user.token)
      .then(data => { setOps(data); setOpSel(''); })
      .catch(() => setError('Impossible de charger les OP'));
  }, [contratSel]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file)       { setError('Veuillez sélectionner un fichier XML'); return; }
    if (!contratSel) { setError('Veuillez choisir un contrat'); return; }
    if (!opSel)      { setError('Veuillez choisir un OP'); return; }

    setLoading(true);
    setError('');
    try {
      const token = await getValidToken();
      if (!token) {
        setError('Session expirée, veuillez vous reconnecter');
        return;
      }

      const data = await importerFacture({
        contrat:      contratSel,
        op:           opSel,
        activeClient: user.activeClient,
        file,
        dryRun,
        userToken:    token,
      });
      setResult(data);
      setStep('success');
    } catch (e) {
      const msg = e.response?.data?.detail?.message || e.message;
      setError(msg);
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('form');
    setResult(null);
    setError('');
    setFile(null);
    setOpSel('');
  }

  const opSel_obj = ops.find(o => o.numeroBdc === opSel);

  if (step === 'success') return (
    <div style={styles.resultCard}>
      <div style={styles.successIcon}>✓</div>
      <h2 style={{ color: '#0F6E56', marginBottom: '8px' }}>
        {dryRun ? 'Simulation réussie' : 'Facture insérée dans Fayma'}
      </h2>
      <p style={{ color: '#555', marginBottom: '24px' }}>
        {dryRun
          ? 'Toutes les vérifications sont passées. Relancez sans simulation pour écrire en base.'
          : 'La facture a été créée avec succès dans Fayma.'}
      </p>
      <div style={styles.resultGrid}>
        <ResultRow label="Numéro"  value={result.facture_numero} />
        <ResultRow label="Contrat" value={result.contrat_numero} />
        <ResultRow label="OP"      value={result.bdc_numero} />
        <ResultRow label="Statut"  value={result.statut_facture} />
        <ResultRow label="Montant" value={`${result.montant_total?.toLocaleString()} ${result.devise}`} />
      </div>
      <button onClick={reset} style={styles.btnSecondary}>
        Insérer une autre facture
      </button>
    </div>
  );

  if (step === 'error') return (
    <div style={styles.resultCard}>
      <div style={styles.errorIcon}>✗</div>
      <h2 style={{ color: '#A32D2D', marginBottom: '8px' }}>Échec de l'insertion</h2>
      <p style={{ color: '#555', marginBottom: '24px' }}>{error}</p>
      <button onClick={reset} style={styles.btnSecondary}>Réessayer</button>
    </div>
  );

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Insérer une facture UBL 2.1</h1>
      <p style={styles.subtitle}>
        Choisissez un contrat et un ordre de paiement, puis uploadez votre fichier XML
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>

        <div style={styles.section}>
          <div style={styles.stepBadge}>1</div>
          <div style={styles.sectionContent}>
            <label style={styles.label}>Contrat</label>
            <select
              value={contratSel}
              onChange={e => setContratSel(e.target.value)}
              style={styles.select}
              required
            >
              <option value="">— Sélectionner un contrat —</option>
              {contrats.map(c => (
                <option key={c.numeroContrat} value={c.numeroContrat}>
                  {c.numeroContrat} — {c.intitule || 'Sans intitulé'}
                  {' '}({c.resteAPayer?.toLocaleString()} {c.devise} restants)
                </option>
              ))}
            </select>
            {contrats.length === 0 && (
              <p style={styles.hint}>Chargement des contrats...</p>
            )}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.stepBadge}>2</div>
          <div style={styles.sectionContent}>
            <label style={styles.label}>Ordre de paiement</label>
            <select
              value={opSel}
              onChange={e => setOpSel(e.target.value)}
              style={styles.select}
              disabled={!contratSel}
              required
            >
              <option value="">— Sélectionner un OP —</option>
              {ops.map(op => (
                <option
                  key={op.numeroBdc}
                  value={op.numeroBdc}
                  disabled={!op.pret_pour_import}
                >
                  {op.numeroBdc} — {op.statut}
                  {op.pret_pour_import ? '' : ' (en attente de validation)'}
                  {' '}· {op.montantTotal?.toLocaleString()} {op.devise}
                </option>
              ))}
            </select>
            {contratSel && ops.length === 0 && (
              <p style={styles.hint}>Aucun OP disponible pour ce contrat</p>
            )}
            {opSel_obj && (
              <div style={styles.opInfo}>
                <span style={{
                  ...styles.badge,
                  background: opSel_obj.pret_pour_import ? '#E1F5EE' : '#FAEEDA',
                  color:      opSel_obj.pret_pour_import ? '#0F6E56'  : '#BA7517',
                }}>
                  {opSel_obj.statut}
                </span>
                <span style={styles.opMontant}>
                  {opSel_obj.montantTotal?.toLocaleString()} {opSel_obj.devise}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.stepBadge}>3</div>
          <div style={styles.sectionContent}>
            <label style={styles.label}>Fichier XML UBL 2.1</label>
            <div
              style={{
                ...styles.dropzone,
                borderColor: file ? '#185FA5' : '#ddd',
                background:  file ? '#E6F1FB' : '#fafafa',
              }}
              onClick={() => document.getElementById('file-input').click()}
            >
              {file ? (
                <div>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>📄</div>
                  <div style={{ fontWeight: '600', color: '#185FA5' }}>{file.name}</div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {(file.size / 1024).toFixed(1)} Ko · Cliquer pour changer
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
                  <div style={{ fontWeight: '500' }}>Cliquer ou glisser le fichier XML</div>
                  <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
                    Format UBL 2.1 — .xml uniquement
                  </div>
                </div>
              )}
            </div>
            <input
              id="file-input"
              type="file"
              accept=".xml"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])}
            />
          </div>
        </div>

        <div style={styles.options}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Mode simulation (vérifier sans écrire en base)
          </label>
        </div>

        {error && !['success', 'error'].includes(step) && (
          <div style={styles.errorBox}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !file || !contratSel || !opSel}
          style={{
            ...styles.btn,
            opacity: (loading || !file || !contratSel || !opSel) ? 0.6 : 1,
          }}
        >
          {loading
            ? 'Insertion en cours...'
            : dryRun
            ? 'Vérifier la facture'
            : 'Insérer la facture dans Fayma'}
        </button>
      </form>
    </div>
  );
}

function ResultRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '10px 0', borderBottom: '1px solid #f0f0f0',
    }}>
      <span style={{ color: '#666', fontSize: '14px' }}>{label}</span>
      <span style={{ fontWeight: '600', fontSize: '14px' }}>{value}</span>
    </div>
  );
}

const styles = {
  page:        { maxWidth: '640px', margin: '0 auto', padding: '32px 24px' },
  title:       { fontSize: '22px', fontWeight: '700', color: '#042C53', marginBottom: '8px' },
  subtitle:    { color: '#666', fontSize: '14px', marginBottom: '32px' },
  form:        { display: 'flex', flexDirection: 'column', gap: '24px' },
  section:     { display: 'flex', gap: '16px', alignItems: 'flex-start' },
  stepBadge:   {
    width: '28px', height: '28px', minWidth: '28px',
    background: '#185FA5', color: '#fff', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: '700', fontSize: '14px', marginTop: '22px',
  },
  sectionContent: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  label:       { fontSize: '13px', fontWeight: '600', color: '#444' },
  select:      {
    padding: '10px 12px', border: '1.5px solid #e0e0e0',
    borderRadius: '8px', fontSize: '14px',
    background: '#fff', cursor: 'pointer', outline: 'none',
  },
  hint:        { fontSize: '13px', color: '#999' },
  opInfo:      { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' },
  badge:       { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  opMontant:   { fontSize: '13px', color: '#444', fontWeight: '500' },
  dropzone:    {
    border: '2px dashed', borderRadius: '10px',
    padding: '32px', textAlign: 'center',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  options:     { padding: '14px 16px', background: '#f8f7f4', borderRadius: '8px' },
  checkboxLabel: {
    fontSize: '14px', color: '#444',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
  },
  errorBox:    {
    padding: '12px 14px', background: '#FCEBEB',
    color: '#A32D2D', borderRadius: '8px', fontSize: '14px',
  },
  btn:         {
    padding: '14px', background: '#185FA5',
    color: '#fff', border: 'none', borderRadius: '8px',
    fontSize: '15px', fontWeight: '600', cursor: 'pointer',
  },
  btnSecondary: {
    padding: '11px 24px', background: '#fff',
    color: '#185FA5', border: '1.5px solid #185FA5',
    borderRadius: '8px', fontSize: '14px',
    fontWeight: '600', cursor: 'pointer', marginTop: '8px',
  },
  resultCard:  {
    maxWidth: '480px', margin: '40px auto',
    background: '#fff', borderRadius: '16px',
    padding: '40px', textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
  successIcon: {
    width: '56px', height: '56px', background: '#E1F5EE', color: '#0F6E56',
    borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '24px', fontWeight: '700',
    margin: '0 auto 20px',
  },
  errorIcon:   {
    width: '56px', height: '56px', background: '#FCEBEB', color: '#A32D2D',
    borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '24px', fontWeight: '700',
    margin: '0 auto 20px',
  },
  resultGrid:  { textAlign: 'left', margin: '20px 0' },
};