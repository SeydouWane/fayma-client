import { useEffect, useState } from 'react';
import { getContrats, getOP, getUblOP, importerFacture, telechargerBlob, erreur } from '../api/plateforme';

const CLASSE = { OK: 'ok', ECHEC: 'ko', ATTENTION: 'warn', SIMULATION: 'info', IGNORE: '' };

export const montant = (n, devise = 'XOF') =>
  n == null ? '—' : `${new Intl.NumberFormat('fr-FR').format(n)} ${devise || ''}`;

export function Timeline({ etapes }) {
  if (!etapes?.length) return null;
  return (
    <ol className="timeline">
      {etapes.map((e, i) => (
        <li key={i} className={CLASSE[e.statut] || ''}>
          <span className="pastille" />
          <strong>{e.etape}</strong> <span className={`badge ${CLASSE[e.statut] || ''}`}>{e.statut}</span>
          {e.detail && <div className="detail">{e.detail}</div>}
        </li>
      ))}
    </ol>
  );
}

export default function Integration({ subsystem, contexte }) {
  const [contrats, setContrats] = useState([]);
  const [contrat, setContrat] = useState('');
  const [ops, setOps] = useState([]);
  const [op, setOp] = useState('');
  const [xml, setXml] = useState('');
  const [envoyer, setEnvoyer] = useState(true);
  const [chargement, setChargement] = useState('');
  const [resultat, setResultat] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setContrats([]); setContrat(''); setOps([]); setOp(''); setXml(''); setResultat(null); setMessage(null);
    if (!contexte) return;
    setChargement('contrats');
    getContrats(subsystem)
      .then(setContrats)
      .catch((e) => setMessage({ type: 'ko', texte: erreur(e) }))
      .finally(() => setChargement(''));
  }, [subsystem, contexte]);

  const chargerOps = async (numero) => {
    setOps([]); setOp(''); setXml(''); setResultat(null); setMessage(null);
    if (!numero) return;
    setChargement('op');
    try { setOps(await getOP(subsystem, numero)); }
    catch (e) { setMessage({ type: 'ko', texte: erreur(e) }); }
    finally { setChargement(''); }
  };

  const choisirOp = async (o) => {
    if (!o.importable || chargement) return;
    setOp(o.numeroBdc); setResultat(null); setMessage(null);
    setChargement('xml');
    try { setXml(await getUblOP(subsystem, o.numeroBdc)); }
    catch (e) { setMessage({ type: 'ko', texte: erreur(e) }); }
    finally { setChargement(''); }
  };

  const chargerFichier = (ev) => {
    const f = ev.target.files?.[0];
    if (f) f.text().then(setXml);
    ev.target.value = '';
  };

  const lancer = async (dryRun) => {
    setChargement(dryRun ? 'simulation' : 'insertion'); setResultat(null); setMessage(null);
    try {
      const r = await importerFacture({
        subsystem, contrat, op, activeClient: contexte.active_client, xml, dryRun, envoyer,
      });
      setResultat(r);
      setMessage({ type: dryRun || r.statut_facture === 'ENVOYEE' ? 'ok' : 'info', texte: r.message });
      if (!dryRun) setOps(await getOP(subsystem, contrat));
    } catch (e) {
      setMessage({ type: 'ko', texte: erreur(e) });
    } finally {
      setChargement('');
    }
  };

  if (!contexte) return <div className="carte vide">Sélectionnez un fournisseur enrôlé pour commencer.</div>;
  const occupe = Boolean(chargement);

  return (
    <div className="grille">
      <div>
        <div className="carte">
          <h2>1. Contrat</h2>
          <select value={contrat} disabled={occupe}
                  onChange={(e) => { setContrat(e.target.value); chargerOps(e.target.value); }}>
            <option value="">
              {chargement === 'contrats' ? 'Chargement…' : `— ${contrats.length} contrat(s) ACTIF —`}
            </option>
            {contrats.map((c) => (
              <option key={c.numeroContrat} value={c.numeroContrat}>{c.numeroContrat} — {c.intitule}</option>
            ))}
          </select>
        </div>

        <div className="carte">
          <h2>2. Ordre de paiement</h2>
          {!contrat && <div className="vide">Choisissez d'abord un contrat.</div>}
          {chargement === 'op' && <div className="vide">Chargement des OP…</div>}
          {contrat && chargement !== 'op' && !ops.length && <div className="vide">Aucun OP sur ce contrat.</div>}
          <ul className="liste-op">
            {ops.map((o) => (
              <li key={o.numeroBdc}
                  className={`${o.numeroBdc === op ? 'choisi' : ''} ${o.importable ? '' : 'bloque'}`}
                  onClick={() => choisirOp(o)}
                  title={o.importable ? 'Générer la facture UBL' : o.facture_existante ? 'Une facture existe déjà' : `OP ${o.statut}`}>
                <div>
                  <strong>{o.numeroBdc}</strong>
                  <div className="detail">{montant(o.montantTotal, o.devise)} · {o.nbLignes} ligne(s)</div>
                </div>
                <span className={`badge ${o.importable ? 'ok' : o.facture_existante ? 'info' : 'warn'}`}>
                  {o.importable ? 'À facturer' : o.facture_existante ? 'Facturé' : o.statut}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="carte">
          <h2>3. Facture UBL 2.1 {op && `— ${op}`}</h2>
          <textarea value={xml} spellCheck={false} onChange={(e) => setXml(e.target.value)}
                    placeholder="Sélectionnez un OP « À facturer » : le XML est généré depuis ses lignes. Vous pouvez aussi charger un fichier." />
          <div className="actions">
            <label className="btn">
              Charger un fichier XML
              <input type="file" accept=".xml,application/xml,text/xml" hidden onChange={chargerFichier} />
            </label>
            <button className="btn" disabled={!xml}
                    onClick={() => telechargerBlob(new Blob([xml], { type: 'application/xml' }), `${op || 'facture'}_UBL.xml`)}>
              Télécharger le XML
            </button>
            <label className="coche">
              <input type="checkbox" checked={envoyer} onChange={(e) => setEnvoyer(e.target.checked)} />
              Envoyer automatiquement après insertion
            </label>
          </div>
          <div className="actions">
            <button className="btn" disabled={!xml || !op || occupe} onClick={() => lancer(true)}>
              {chargement === 'simulation' ? 'Simulation…' : 'Simuler'}
            </button>
            <button className="btn primaire" disabled={!xml || !op || occupe} onClick={() => lancer(false)}>
              {chargement === 'insertion' ? 'Insertion…' : envoyer ? 'Insérer et envoyer' : 'Insérer'}
            </button>
          </div>
          {message && <div className={`alerte ${message.type}`}>{message.texte}</div>}
        </div>

        {resultat && (
          <div className="carte">
            <h2>Résultat — transmis via X-Road ({contexte.xroad_client})</h2>
            <div className="resume">
              <div>Facture<b>{resultat.facture_numero}</b></div>
              <div>Statut<b>{resultat.statut_facture}</b></div>
              <div>Montant<b>{montant(resultat.montant_total, resultat.devise)}</b></div>
              <div>Contrat · OP<b>{resultat.contrat_numero} · {resultat.bdc_numero}</b></div>
            </div>
            <Timeline etapes={resultat.etapes} />
          </div>
        )}
      </div>
    </div>
  );
}
