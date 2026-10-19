import { useState } from 'react';
import { webhookMosip, erreur } from '../api/plateforme';

const VIDE = { subsystem: '', raison_sociale: '', email: '', password: '', ninea: '' };

export default function Fournisseurs({ fournisseurs, onChange, onSelect }) {
  const [form, setForm] = useState(VIDE);
  const [enCours, setEnCours] = useState('');
  const [message, setMessage] = useState(null);

  const maj = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const subsystem = (form.subsystem || (form.ninea ? `FRN_${form.ninea}` : ''))
    .toUpperCase().replace(/[^A-Z0-9_]/g, '');

  const enroler = async () => {
    if (!subsystem || !form.email || !form.password) {
      setMessage({ type: 'ko', texte: 'Subsystem (ou NINEA), email et mot de passe Keycloak sont requis.' });
      return;
    }
    const existe = fournisseurs.some((f) => f.subsystem === subsystem);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setEnCours('enrolement'); setMessage(null);
    try {
      const r = await webhookMosip({
        type: existe ? 'FOURNISSEUR_REACTIVATED' : 'FOURNISSEUR_CREATED',
        uin: `FRN-${date}-${form.ninea || subsystem}`,
        xroad_subsystem: subsystem,
        keycloak_username: form.email,
        keycloak_password: form.password,
        raison_sociale: form.raison_sociale || subsystem,
        email: form.email,
        ninea: form.ninea || null,
      });
      setMessage({ type: 'ok', texte: `${r.type} — ${r.message}` });
      setForm(VIDE);
      await onChange();
      onSelect(subsystem);
    } catch (e) {
      setMessage({ type: 'ko', texte: erreur(e) });
    } finally {
      setEnCours('');
    }
  };

  const desactiver = async (f) => {
    setEnCours(f.subsystem); setMessage(null);
    try {
      const r = await webhookMosip({
        type: 'FOURNISSEUR_DEACTIVATED',
        uin: f.uin || f.subsystem,
        xroad_subsystem: f.subsystem,
        keycloak_username: f.email || '',
        keycloak_password: '',
      });
      setMessage({ type: 'info', texte: `${r.message} — toute soumission X-Road de ce fournisseur est désormais refusée (403).` });
      await onChange();
    } catch (e) {
      setMessage({ type: 'ko', texte: erreur(e) });
    } finally {
      setEnCours('');
    }
  };

  const preparerReactivation = (f) => {
    setForm({ ...VIDE, subsystem: f.subsystem, raison_sociale: f.raison_sociale || '', email: f.email || '' });
    setMessage({ type: 'info', texte: `Saisissez le mot de passe Keycloak de ${f.subsystem} puis cliquez sur « Enrôler / réactiver ».` });
  };

  return (
    <>
      <div className="carte">
        <h2>Registre des fournisseurs (MOSIP → Redis)</h2>
        {!fournisseurs.length && <div className="vide">Aucun fournisseur enrôlé.</div>}
        {fournisseurs.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Subsystem X-Road</th><th>Raison sociale</th><th>Email</th><th>UIN</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {fournisseurs.map((f) => (
                  <tr key={f.subsystem}>
                    <td><strong>{f.subsystem}</strong></td>
                    <td>{f.raison_sociale || '—'}</td>
                    <td>{f.email || '—'}</td>
                    <td>{f.uin || '—'}</td>
                    <td><span className={`badge ${f.statut === 'ACTIF' ? 'ok' : 'ko'}`}>{f.statut}</span></td>
                    <td>
                      <div className="actions" style={{ marginTop: 0 }}>
                        {f.statut === 'ACTIF' ? (
                          <>
                            <button className="btn petit" onClick={() => onSelect(f.subsystem)}>Utiliser</button>
                            <button className="btn petit danger" disabled={!!enCours} onClick={() => desactiver(f)}>
                              {enCours === f.subsystem ? '…' : 'Désactiver'}
                            </button>
                          </>
                        ) : (
                          <button className="btn petit" onClick={() => preparerReactivation(f)}>Réactiver</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {message && <div className={`alerte ${message.type}`}>{message.texte}</div>}
      </div>

      <div className="carte">
        <h2>Enrôler / réactiver un fournisseur</h2>
        <div className="detail">
          Simule l'événement que Fayma émettra à la création d'un fournisseur. Sans subsystem saisi, il est
          généré depuis le NINEA (FRN_&lt;NINEA&gt;).
        </div>
        <div className="form-grille">
          <div><label>NINEA</label><input value={form.ninea} onChange={maj('ninea')} placeholder="123456789" /></div>
          <div><label>Subsystem X-Road</label><input value={form.subsystem} onChange={maj('subsystem')} placeholder={subsystem || 'FRN_<NINEA>'} /></div>
          <div><label>Raison sociale</label><input value={form.raison_sociale} onChange={maj('raison_sociale')} /></div>
          <div><label>Email Keycloak</label><input value={form.email} onChange={maj('email')} /></div>
          <div><label>Mot de passe Keycloak</label><input type="password" value={form.password} onChange={maj('password')} /></div>
        </div>
        <div className="actions">
          <button className="btn primaire" disabled={!!enCours} onClick={enroler}>
            {enCours === 'enrolement' ? 'Enrôlement…' : 'Enrôler / réactiver'}
          </button>
          {subsystem && <span className="detail">→ X-Road-Client : ABI/ABI/{subsystem}/ERP</span>}
        </div>
      </div>
    </>
  );
}
