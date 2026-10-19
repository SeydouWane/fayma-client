import { useCallback, useEffect, useState } from 'react';
import './plateforme.css';
import { getFournisseurs, getContexte, erreur } from './api/plateforme';
import Integration from './pages/Integration';
import Recuperation from './pages/Recuperation';
import Fournisseurs from './pages/Fournisseurs';

const ONGLETS = [
  { id: 'integration', label: 'Intégration' },
  { id: 'recuperation', label: 'Récupération' },
  { id: 'fournisseurs', label: 'Fournisseurs' },
];

export default function App() {
  const [onglet, setOnglet] = useState('integration');
  const [fournisseurs, setFournisseurs] = useState([]);
  const [subsystem, setSubsystem] = useState('');
  const [contexte, setContexte] = useState(null);
  const [erreurCtx, setErreurCtx] = useState('');
  const [version, setVersion] = useState(0);

  const chargerFournisseurs = useCallback(async () => {
    try {
      const liste = await getFournisseurs();
      setFournisseurs(liste);
      setSubsystem((s) => (s && liste.some((f) => f.subsystem === s)
        ? s
        : liste.find((f) => f.statut === 'ACTIF')?.subsystem || ''));
      setVersion((v) => v + 1);
    } catch (e) {
      setErreurCtx(erreur(e));
    }
  }, []);

  useEffect(() => { chargerFournisseurs(); }, [chargerFournisseurs]);

  useEffect(() => {
    setContexte(null); setErreurCtx('');
    if (!subsystem) return undefined;
    let annule = false;
    getContexte(subsystem)
      .then((c) => { if (!annule) setContexte(c); })
      .catch((e) => { if (!annule) setErreurCtx(erreur(e)); });
    return () => { annule = true; };
  }, [subsystem, version]);

  return (
    <>
      <header className="entete">
        <div>
          <h1>Plateforme de test — Fayma × X-Road ABI</h1>
          <div className="sous">Intégration et récupération de factures UBL 2.1 · identité fournisseur résolue via MOSIP / Keycloak</div>
        </div>
        <div>
          <label>Fournisseur (subsystem X-Road)</label>
          <select value={subsystem} onChange={(e) => setSubsystem(e.target.value)}>
            <option value="">— choisir —</option>
            {fournisseurs.map((f) => (
              <option key={f.subsystem} value={f.subsystem}>
                {f.subsystem} · {f.raison_sociale || ''}{f.statut !== 'ACTIF' ? ' (INACTIF)' : ''}
              </option>
            ))}
          </select>
        </div>
      </header>

      {contexte && (
        <div className="contexte">
          <span>Fournisseur : <b>{contexte.nom}</b></span>
          <span>NINEA : <b>{contexte.ninea || '—'}</b></span>
          <span>Client Fayma : <b>{contexte.client_name} (#{contexte.active_client})</b></span>
          <span>X-Road-Client : <b>{contexte.xroad_client}</b></span>
          <span>UIN : <b>{contexte.uin || '—'}</b></span>
        </div>
      )}
      {erreurCtx && <div className="contexte erreur">{erreurCtx}</div>}

      <nav className="onglets">
        {ONGLETS.map((o) => (
          <button key={o.id} className={onglet === o.id ? 'actif' : ''} onClick={() => setOnglet(o.id)}>
            {o.label}
          </button>
        ))}
      </nav>

      <main>
        {onglet === 'integration' && <Integration subsystem={subsystem} contexte={contexte} />}
        {onglet === 'recuperation' && <Recuperation subsystem={subsystem} contexte={contexte} />}
        {onglet === 'fournisseurs' && (
          <Fournisseurs
            fournisseurs={fournisseurs}
            onChange={chargerFournisseurs}
            onSelect={(s) => { setSubsystem(s); setOnglet('integration'); }}
          />
        )}
      </main>
    </>
  );
}
