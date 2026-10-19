import { useEffect, useState } from 'react';
import { getFactures, envoyerFacture, telechargerUbl, erreur } from '../api/plateforme';
import { montant } from './Integration';

const CLASSE_ETAT = { BROUILLON: 'warn', ENVOYEE: 'info', VALIDEE: 'ok', PAYEE: 'ok', REJETEE: 'ko' };
const jour = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

export default function Recuperation({ subsystem, contexte }) {
  const [factures, setFactures] = useState([]);
  const [filtre, setFiltre] = useState('');
  const [chargement, setChargement] = useState(false);
  const [action, setAction] = useState('');
  const [message, setMessage] = useState(null);

  const charger = async () => {
    if (!contexte) return;
    setChargement(true);
    try { setFactures(await getFactures(subsystem)); }
    catch (e) { setMessage({ type: 'ko', texte: erreur(e) }); }
    finally { setChargement(false); }
  };

  useEffect(() => { setFactures([]); setMessage(null); charger(); }, [subsystem, contexte]); // eslint-disable-line react-hooks/exhaustive-deps

  const envoyer = async (f) => {
    setAction(f.id); setMessage(null);
    try {
      const r = await envoyerFacture(subsystem, f.id);
      setMessage({ type: 'ok', texte: r.message });
      await charger();
    } catch (e) { setMessage({ type: 'ko', texte: erreur(e) }); }
    finally { setAction(''); }
  };

  const xml = async (f) => {
    setAction(`${f.id}:xml`);
    try { await telechargerUbl(subsystem, f.id, f.numero); }
    catch (e) { setMessage({ type: 'ko', texte: erreur(e) }); }
    finally { setAction(''); }
  };

  if (!contexte) return <div className="carte vide">Sélectionnez un fournisseur enrôlé.</div>;

  const etats = [...new Set(factures.map((f) => f.etat).filter(Boolean))];
  const visibles = factures.filter((f) => !filtre || f.etat === filtre);

  return (
    <div className="carte">
      <div className="entete-carte">
        <h2>Factures de {contexte.nom || subsystem} — {visibles.length}/{factures.length}</h2>
        <div className="actions" style={{ marginTop: 0 }}>
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)} style={{ width: 180 }}>
            <option value="">Tous les états</option>
            {etats.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <button className="btn" onClick={charger} disabled={chargement}>
            {chargement ? 'Chargement…' : 'Actualiser'}
          </button>
        </div>
      </div>
      {message && <div className={`alerte ${message.type}`}>{message.texte}</div>}
      {!chargement && !visibles.length && <div className="vide">Aucune facture.</div>}
      {visibles.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Numéro</th><th>Client</th><th style={{ textAlign: 'right' }}>Montant</th>
                <th>Émission</th><th>Envoi</th><th>État</th><th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.numero}</strong></td>
                  <td>{f.client || '—'}</td>
                  <td className="num">{montant(f.montantTotal, f.devise)}</td>
                  <td>{jour(f.dateEmission)}</td>
                  <td>{jour(f.dateEnvoi)}</td>
                  <td><span className={`badge ${CLASSE_ETAT[f.etat] || ''}`}>{f.etat}</span></td>
                  <td>{f.statut}</td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      {f.peutEtreEnvoyee && (
                        <button className="btn petit primaire" disabled={!!action} onClick={() => envoyer(f)}>
                          {action === f.id ? 'Envoi…' : 'Envoyer'}
                        </button>
                      )}
                      <button className="btn petit" disabled={!!action} onClick={() => xml(f)}>
                        {action === `${f.id}:xml` ? '…' : 'XML UBL'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
