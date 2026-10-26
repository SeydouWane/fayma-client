// src/pages/FactureOCR.jsx — dépôt d'une facture PDF / image, lecture OCR,
// correction par le fournisseur, puis insertion et envoi via X-Road.
import { useEffect, useRef, useState } from 'react';
import { getContrats, getOP, importerFacture, telechargerBlob, erreur } from '../api/plateforme';
import { analyserFacture, validerFacture, noterResultat, capacitesOcr } from '../api/ocr';
import { Timeline, montant } from './Integration';

const CHAMPS = [
  { cle: 'numero_facture', libelle: 'N° de facture fournisseur', type: 'text' },
  { cle: 'date_emission', libelle: "Date d'émission", type: 'date' },
  { cle: 'date_echeance', libelle: "Date d'échéance", type: 'date' },
  { cle: 'devise', libelle: 'Devise', type: 'text', ref: 'devise' },
  { cle: 'ninea_fournisseur', libelle: 'NINEA du fournisseur', type: 'text', ref: 'ninea' },
  { cle: 'montant_ht', libelle: 'Montant HT', type: 'number', ref: 'montant_ht' },
  { cle: 'montant_tva', libelle: 'TVA', type: 'number', ref: 'montant_tva' },
  { cle: 'montant_ttc', libelle: 'Montant TTC', type: 'number', ref: 'montant_ttc' },
];
const NUMERIQUES = new Set(['montant_ht', 'montant_tva', 'montant_ttc']);
const NIVEAU = { OK: 'ok', INFO: 'info', ATTENTION: 'warn', BLOQUANT: 'ko' };
const GRAVITE = { OK: 0, INFO: 1, ATTENTION: 2, BLOQUANT: 3 };
const METHODE = { texte: 'Couche texte du PDF', ocr: 'OCR Tesseract', mixte: 'Couche texte + OCR' };
const TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/webp'];
const TAILLE_MAX = 10 * 1024 * 1024;
const ETAPES = ["Choisir l'OP", 'Déposer la facture', 'Vérifier et corriger', 'Insérer et envoyer'];

const nombre = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const arrondi = (v) => Math.round(v * 100) / 100;
const egaux = (a, b) => a != null && b != null && Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.001);
const normNinea = (n) => String(n || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

function badge(etat) {
  if (!etat || etat.source === 'absent') return { classe: 'ko', texte: 'à saisir' };
  if (etat.source === 'manuel') return { classe: 'info', texte: 'corrigé' };
  const p = `${Math.round((etat.confiance || 0) * 100)} %`;
  if (etat.source === 'calcul') return { classe: 'warn', texte: `calculé · ${p}` };
  if (etat.source === 'op') return { classe: 'warn', texte: "repris de l'OP" };
  return { classe: etat.confiance >= 0.85 ? 'ok' : etat.confiance >= 0.6 ? 'warn' : 'ko', texte: p };
}

function referenceOk(cle, valeur, op) {
  if (!op) return null;
  if (NUMERIQUES.has(cle)) return op[cle] == null ? null : egaux(nombre(valeur), op[cle]);
  if (cle === 'ninea_fournisseur') {
    const a = normNinea(valeur), b = normNinea(op.ninea);
    return b ? Boolean(a) && (a.startsWith(b.slice(0, 7)) || b.startsWith(a.slice(0, 7))) : null;
  }
  if (cle === 'devise') return (valeur || '') === (op.devise || '');
  return null;
}

function valeurReference(champ, op) {
  if (!op || !champ.ref) return null;
  const v = op[champ.ref];
  if (v == null) return null;
  return NUMERIQUES.has(champ.cle) ? montant(v, op.devise) : v;
}

export default function FactureOCR({ subsystem, contexte }) {
  const [capacites, setCapacites] = useState(null);
  const [contrats, setContrats] = useState([]);
  const [contrat, setContrat] = useState('');
  const [ops, setOps] = useState([]);
  const [op, setOp] = useState(null);
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState('');
  const [progression, setProgression] = useState(0);
  const [analyse, setAnalyse] = useState(null);
  const [valeurs, setValeurs] = useState({});
  const [etats, setEtats] = useState({});
  const [lignes, setLignes] = useState([]);
  const [controles, setControles] = useState([]);
  const [bloquant, setBloquant] = useState(false);
  const [validation, setValidation] = useState(null);
  const [aJour, setAJour] = useState(true);
  const [joindre, setJoindre] = useState(true);
  const [envoyer, setEnvoyer] = useState(true);
  const [forcer, setForcer] = useState(false);
  const [voirXml, setVoirXml] = useState(false);
  const [voirTexte, setVoirTexte] = useState(false);
  const [survol, setSurvol] = useState(false);
  const [chargement, setChargement] = useState('');
  const [message, setMessage] = useState(null);
  const [resultat, setResultat] = useState(null);
  const entree = useRef(null);

  useEffect(() => { capacitesOcr().then(setCapacites).catch(() => setCapacites(null)); }, []);
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);

  const reinitialiserDocument = () => {
    setFichier(null); setApercu(''); setProgression(0); setAnalyse(null); setValeurs({}); setEtats({});
    setLignes([]); setControles([]); setBloquant(false); setValidation(null); setAJour(true);
    setForcer(false); setVoirXml(false); setVoirTexte(false); setResultat(null);
  };

  useEffect(() => {
    setContrats([]); setContrat(''); setOps([]); setOp(null); setMessage(null);
    reinitialiserDocument();
    if (!contexte) return;
    setChargement('contrats');
    getContrats(subsystem)
      .then(setContrats)
      .catch((e) => setMessage({ type: 'ko', texte: erreur(e) }))
      .finally(() => setChargement(''));
  }, [subsystem, contexte]);

  const chargerOps = async (numero) => {
    setOps([]); setOp(null); setMessage(null); reinitialiserDocument();
    if (!numero) return;
    setChargement('op');
    try { setOps(await getOP(subsystem, numero)); }
    catch (e) { setMessage({ type: 'ko', texte: erreur(e) }); }
    finally { setChargement(''); }
  };

  const choisirOp = (o) => {
    if (!o.importable || chargement) return;
    setOp(o); setMessage(null); reinitialiserDocument();
  };

  // ── Dépôt et analyse ─────────────────────────────────────────────────
  const deposer = async (f) => {
    if (!f || !op) return;
    if (!TYPES.includes(f.type)) {
      setMessage({ type: 'ko', texte: `Format non pris en charge (${f.type || 'inconnu'}) : PDF, PNG, JPEG, TIFF ou WEBP.` });
      return;
    }
    if (f.size > TAILLE_MAX) {
      setMessage({ type: 'ko', texte: 'Fichier trop volumineux (10 Mo maximum).' });
      return;
    }
    reinitialiserDocument();
    setFichier(f);
    setApercu(URL.createObjectURL(f));
    setMessage(null);
    setChargement('analyse');
    try {
      const r = await analyserFacture(subsystem, op.numeroBdc, f, setProgression);
      setAnalyse(r);
      setValeurs(Object.fromEntries(Object.entries(r.champs).map(([k, v]) => [k, v.valeur ?? ''])));
      setEtats(r.champs);
      setLignes(r.lignes.map((l) => ({ ...l })));
      setControles(r.controles);
      setBloquant(r.bloquant);
      setAJour(true);
    } catch (e) {
      setMessage({ type: 'ko', texte: erreur(e) });
    } finally {
      setChargement('');
    }
  };

  const surDepot = (ev) => {
    ev.preventDefault();
    setSurvol(false);
    deposer(ev.dataTransfer.files?.[0]);
  };

  // ── Corrections ──────────────────────────────────────────────────────
  const modifie = () => { setAJour(false); setValidation(null); };

  const majValeur = (cle, v) => {
    setValeurs((s) => ({ ...s, [cle]: v }));
    setEtats((s) => ({ ...s, [cle]: { ...(s[cle] || {}), source: 'manuel' } }));
    modifie();
  };

  const majLigne = (i, cle, v) => {
    setLignes((ls) => ls.map((l, k) => {
      if (k !== i) return l;
      const n = { ...l, [cle]: v, confiance: undefined };
      if (['quantite', 'prix_unitaire', 'remise'].includes(cle)) {
        const q = nombre(n.quantite), pu = nombre(n.prix_unitaire), r = nombre(n.remise) || 0;
        if (q != null && pu != null) n.montant_ht = arrondi(q * pu * (1 - r / 100));
      }
      return n;
    }));
    modifie();
  };

  const ajouterLigne = () => {
    setLignes((ls) => [...ls, { designation: '', quantite: 1, prix_unitaire: 0, taux_tva: 0, remise: 0, montant_ht: 0 }]);
    modifie();
  };
  const supprimerLigne = (i) => { setLignes((ls) => ls.filter((_, k) => k !== i)); modifie(); };
  const reprendreLignesOp = () => { setLignes((analyse?.op?.lignes || []).map((l) => ({ ...l }))); modifie(); };

  const totauxDepuisLignes = () => {
    const ht = arrondi(lignes.reduce((s, l) => s + (nombre(l.montant_ht) || 0), 0));
    const tva = arrondi(lignes.reduce((s, l) => s + (nombre(l.montant_ht) || 0) * (nombre(l.taux_tva) || 0) / 100, 0));
    ['montant_ht', 'montant_tva', 'montant_ttc'].forEach((k, i) => majValeur(k, [ht, tva, arrondi(ht + tva)][i]));
  };

  const corrections = () => ({
    numero_facture: String(valeurs.numero_facture || '').trim(),
    date_emission: valeurs.date_emission || null,
    date_echeance: valeurs.date_echeance || null,
    devise: (valeurs.devise || analyse?.op?.devise || 'XOF').toUpperCase().slice(0, 3),
    ninea_fournisseur: valeurs.ninea_fournisseur || null,
    montant_ht: nombre(valeurs.montant_ht),
    montant_tva: nombre(valeurs.montant_tva),
    montant_ttc: nombre(valeurs.montant_ttc),
    lignes: lignes
      .filter((l) => String(l.designation || '').trim() && nombre(l.quantite) > 0)
      .map((l) => ({
        designation: String(l.designation).trim(),
        quantite: nombre(l.quantite),
        prix_unitaire: nombre(l.prix_unitaire) || 0,
        taux_tva: nombre(l.taux_tva) || 0,
        remise: nombre(l.remise) || 0,
        montant_ht: nombre(l.montant_ht),
      })),
    joindre_document: joindre,
  });

  const verifier = async () => {
    setChargement('verification'); setMessage(null);
    try {
      const v = await validerFacture(subsystem, op.numeroBdc, analyse.analyse_id, corrections());
      setControles(v.controles); setBloquant(v.bloquant); setValidation(v); setAJour(true);
      return v;
    } catch (e) {
      setMessage({ type: 'ko', texte: erreur(e) });
      return null;
    } finally {
      setChargement('');
    }
  };

  const inserer = async (dryRun) => {
    setResultat(null);
    const v = aJour && validation ? validation : await verifier();
    if (!v) return;
    if (v.bloquant && !dryRun && !forcer) {
      setMessage({ type: 'ko', texte: 'Des contrôles bloquants subsistent : corrigez les champs signalés, ou confirmez explicitement l\u2019insertion.' });
      return;
    }
    setChargement(dryRun ? 'simulation' : 'insertion'); setMessage(null);
    try {
      const r = await importerFacture({
        subsystem, contrat, op: op.numeroBdc, activeClient: contexte.active_client, xml: v.xml, dryRun, envoyer,
      });
      setResultat({ ...r, dryRun });
      setMessage({ type: dryRun || r.statut_facture === 'ENVOYEE' ? 'ok' : 'info', texte: r.message });
      if (!dryRun) {
        noterResultat(subsystem, op.numeroBdc, analyse.analyse_id, {
          facture_id: r.facture_id, facture_numero: r.facture_numero, statut_facture: r.statut_facture,
        }).catch(() => {});
        setOps(await getOP(subsystem, contrat));
      }
    } catch (e) {
      setMessage({ type: 'ko', texte: erreur(e) });
    } finally {
      setChargement('');
    }
  };

  const nouvelleFacture = () => { setOp(null); setMessage(null); reinitialiserDocument(); };

  // ── Rendu ────────────────────────────────────────────────────────────
  if (!contexte) return <div className="carte vide">Sélectionnez un fournisseur enrôlé pour commencer.</div>;

  const occupe = Boolean(chargement);
  const etape = resultat && !resultat.dryRun ? 3 : analyse ? 2 : op ? 1 : 0;
  const gravite = {};
  controles.forEach((c) => {
    if (c.champ && GRAVITE[c.niveau] > (GRAVITE[gravite[c.champ]] ?? -1)) gravite[c.champ] = c.niveau;
  });
  const compte = (n) => controles.filter((c) => c.niveau === n).length;
  const sommeLignes = arrondi(lignes.reduce((s, l) => s + (nombre(l.montant_ht) || 0), 0));
  const estPdf = fichier?.type === 'application/pdf';
  const insere = resultat && !resultat.dryRun;

  return (
    <div>
      <ol className="ocr-etapes">
        {ETAPES.map((e, i) => (
          <li key={e} className={i < etape ? 'fait' : i === etape ? 'actif' : ''}>
            <span>{i < etape ? '✓' : i + 1}</span>{e}
          </li>
        ))}
      </ol>

      {capacites && !capacites.ocr_disponible && (
        <div className="alerte info">OCR indisponible sur le serveur : seuls les PDF possédant une couche texte peuvent être lus.</div>
      )}

      <div className="grille">
        <div className="carte">
          <h2>1. Contrat et ordre de paiement</h2>
          <select value={contrat} disabled={occupe}
                  onChange={(e) => { setContrat(e.target.value); chargerOps(e.target.value); }}>
            <option value="">{chargement === 'contrats' ? 'Chargement…' : `— ${contrats.length} contrat(s) ACTIF —`}</option>
            {contrats.map((c) => <option key={c.numeroContrat} value={c.numeroContrat}>{c.numeroContrat} — {c.intitule}</option>)}
          </select>
          {chargement === 'op' && <div className="vide">Chargement des OP…</div>}
          <ul className="liste-op" style={{ marginTop: 12 }}>
            {ops.map((o) => (
              <li key={o.numeroBdc}
                  className={`${o.numeroBdc === op?.numeroBdc ? 'choisi' : ''} ${o.importable ? '' : 'bloque'}`}
                  onClick={() => choisirOp(o)}
                  title={o.importable ? 'Facturer cet OP' : o.facture_existante ? 'Une facture existe déjà' : `OP ${o.statut}`}>
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

        <div className="carte">
          <h2>2. Facture du fournisseur {op && `— ${op.numeroBdc}`}</h2>
          <div
            className={`ocr-depot ${survol ? 'survol' : ''} ${!op || occupe ? 'inactif' : ''}`}
            onClick={() => op && !occupe && entree.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (op) setSurvol(true); }}
            onDragLeave={() => setSurvol(false)}
            onDrop={(e) => (op && !occupe ? surDepot(e) : e.preventDefault())}
          >
            <input ref={entree} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp"
                   onChange={(e) => { deposer(e.target.files?.[0]); e.target.value = ''; }} />
            {!op && <><strong>Choisissez d'abord un OP « À facturer »</strong><span>à gauche</span></>}
            {op && chargement === 'analyse' && (
              <>
                <div className="ocr-spinner" />
                <strong>{progression < 100 ? `Envoi du document… ${progression} %` : 'Lecture de la facture en cours…'}</strong>
                <span>Les documents scannés passent par l'OCR : comptez quelques secondes par page.</span>
              </>
            )}
            {op && chargement !== 'analyse' && (
              <>
                <strong>{fichier ? `${fichier.name} — déposer une autre facture` : 'Glissez la facture ici ou cliquez pour la choisir'}</strong>
                <span>PDF (numérique ou scanné), PNG, JPEG, TIFF · 10 Mo maximum</span>
              </>
            )}
          </div>
          {capacites?.ocr_disponible && (
            <div className="detail" style={{ marginTop: 8 }}>
              OCR Tesseract {capacites.tesseract} · langues : {capacites.langues.filter((l) => l !== 'osd').join(', ')} · {capacites.dpi} dpi
            </div>
          )}
          {message && !analyse && <div className={`alerte ${message.type}`}>{message.texte}</div>}
        </div>
      </div>

      {analyse && (
        <div className="ocr-revue">
          <div className="carte ocr-apercu">
            <div className="entete-carte">
              <h2>Document déposé</h2>
              <button className="btn petit" onClick={() => setVoirTexte((v) => !v)}>
                {voirTexte ? 'Voir le document' : 'Texte extrait'}
              </button>
            </div>
            <div className="ocr-meta">
              <span className="badge info">{METHODE[analyse.document.methode] || analyse.document.methode}</span>
              <span>{analyse.document.pages} page(s)</span>
              <span>lecture {Math.round(analyse.document.confiance * 100)} %</span>
              <span>{(analyse.document.duree_ms / 1000).toFixed(1)} s</span>
              <span title={analyse.fichier.sha256}>SHA-256 {analyse.fichier.sha256.slice(0, 12)}…</span>
            </div>
            {voirTexte
              ? <pre className="ocr-texte">{analyse.texte}</pre>
              : estPdf
                ? <iframe className="ocr-cadre" src={apercu} title="Facture déposée" />
                : <img className="ocr-cadre" src={apercu} alt="Facture déposée" />}
          </div>

          <div>
            <div className="carte">
              <div className="entete-carte">
                <h2>3. Informations détectées</h2>
                <span className="detail">OP {analyse.op.numero} · {analyse.op.fournisseur} · {montant(analyse.op.montant_ttc, analyse.op.devise)}</span>
              </div>
              <div className="ocr-champs">
                {CHAMPS.map((ch) => {
                  const b = badge(etats[ch.cle]);
                  const ref = valeurReference(ch, analyse.op);
                  const ok = referenceOk(ch.cle, valeurs[ch.cle], analyse.op);
                  return (
                    <div key={ch.cle} className={`ocr-champ ${NIVEAU[gravite[ch.cle]] || ''}`}>
                      <div className="ocr-champ-tete">
                        <label>{ch.libelle}</label>
                        <span className={`badge ${b.classe}`}>{b.texte}</span>
                      </div>
                      <input type={ch.type} step={ch.type === 'number' ? 'any' : undefined}
                             value={valeurs[ch.cle] ?? ''} disabled={insere}
                             onChange={(e) => majValeur(ch.cle, e.target.value)} />
                      {ref != null && (
                        <div className={`ocr-ref ${ok === false ? 'ko' : ok ? 'ok' : ''}`}>
                          {ok === false ? '≠' : '='} OP : {ref}
                        </div>
                      )}
                      {etats[ch.cle]?.extrait && etats[ch.cle].source !== 'manuel' && (
                        <div className="ocr-extrait" title={etats[ch.cle].extrait}>« {etats[ch.cle].extrait.replace(/\t/g, ' ')} »</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="carte">
              <div className="entete-carte">
                <h2>Lignes de la facture ({lignes.length})</h2>
                <div className="actions" style={{ marginTop: 0 }}>
                  <button className="btn petit" disabled={insere} onClick={ajouterLigne}>+ Ligne</button>
                  <button className="btn petit" disabled={insere} onClick={reprendreLignesOp}>Reprendre les lignes de l'OP</button>
                  <button className="btn petit" disabled={insere || !lignes.length} onClick={totauxDepuisLignes}>Totaux depuis les lignes</button>
                </div>
              </div>
              {!lignes.length && <div className="vide">Aucune ligne détectée : Fayma utilisera les lignes de l'OP.</div>}
              {lignes.length > 0 && (
                <div className="table-wrap">
                  <table className="ocr-lignes">
                    <thead>
                      <tr><th>Désignation</th><th>Qté</th><th>PU</th><th>TVA %</th><th>Remise %</th><th>Montant HT</th><th>Lecture</th><th /></tr>
                    </thead>
                    <tbody>
                      {lignes.map((l, i) => (
                        <tr key={i}>
                          <td><input value={l.designation ?? ''} disabled={insere} onChange={(e) => majLigne(i, 'designation', e.target.value)} /></td>
                          {['quantite', 'prix_unitaire', 'taux_tva', 'remise', 'montant_ht'].map((k) => (
                            <td key={k}>
                              <input type="number" step="any" className="num" value={l[k] ?? ''} disabled={insere}
                                     onChange={(e) => majLigne(i, k, e.target.value)} />
                            </td>
                          ))}
                          <td>{l.confiance != null
                            ? <span className={`badge ${l.confiance >= 0.85 ? 'ok' : l.confiance >= 0.6 ? 'warn' : 'ko'}`}>{Math.round(l.confiance * 100)} %</span>
                            : <span className="badge info">corrigé</span>}</td>
                          <td><button className="btn petit danger" disabled={insere} onClick={() => supprimerLigne(i)} title="Supprimer">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'right' }}>Somme des lignes HT</td>
                        <td className={egaux(sommeLignes, nombre(valeurs.montant_ht)) ? 'ok-texte' : 'ko-texte'}>
                          {montant(sommeLignes, valeurs.devise || analyse.op.devise)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="carte">
              <div className="entete-carte">
                <h2>Contrôles {!aJour && <span className="badge warn">à recalculer</span>}</h2>
                <div className="actions" style={{ marginTop: 0 }}>
                  <span className="badge ok">{compte('OK')} OK</span>
                  <span className="badge warn">{compte('ATTENTION')} attention</span>
                  <span className="badge ko">{compte('BLOQUANT')} bloquant</span>
                </div>
              </div>
              <ul className="ocr-controles">
                {[...controles].sort((a, b) => GRAVITE[b.niveau] - GRAVITE[a.niveau]).map((c, i) => (
                  <li key={`${c.code}-${i}`} className={NIVEAU[c.niveau]}>
                    <span className={`badge ${NIVEAU[c.niveau]}`}>{c.niveau}</span>{c.message}
                  </li>
                ))}
              </ul>
            </div>

            <div className="carte">
              <h2>4. Insertion dans Fayma via X-Road</h2>
              <div className="actions">
                <label className="coche">
                  <input type="checkbox" checked={joindre} disabled={insere} onChange={(e) => { setJoindre(e.target.checked); modifie(); }} />
                  Joindre la facture originale à l'UBL (transmise et signée via X-Road)
                </label>
                <label className="coche">
                  <input type="checkbox" checked={envoyer} disabled={insere} onChange={(e) => setEnvoyer(e.target.checked)} />
                  Envoyer automatiquement après insertion
                </label>
                {bloquant && (
                  <label className="coche ko-texte">
                    <input type="checkbox" checked={forcer} disabled={insere} onChange={(e) => setForcer(e.target.checked)} />
                    J'ai vérifié les écarts bloquants et je confirme l'insertion
                  </label>
                )}
              </div>
              <div className="actions">
                <button className="btn" disabled={occupe || insere} onClick={verifier}>
                  {chargement === 'verification' ? 'Vérification…' : 'Vérifier'}
                </button>
                <button className="btn" disabled={occupe || !validation} onClick={() => setVoirXml((v) => !v)}>
                  {voirXml ? 'Masquer le XML' : 'Voir le XML UBL'}
                </button>
                <button className="btn" disabled={!validation}
                        onClick={() => telechargerBlob(new Blob([validation.xml], { type: 'application/xml' }), `${validation.numero_facture}_UBL.xml`)}>
                  Télécharger le XML
                </button>
                <button className="btn" disabled={occupe || insere} onClick={() => inserer(true)}>
                  {chargement === 'simulation' ? 'Simulation…' : 'Simuler'}
                </button>
                <button className="btn primaire" disabled={occupe || insere || (bloquant && !forcer)} onClick={() => inserer(false)}>
                  {chargement === 'insertion' ? 'Insertion…' : envoyer ? 'Insérer et envoyer' : 'Insérer'}
                </button>
              </div>
              {validation && (
                <div className="detail" style={{ marginTop: 8 }}>
                  UBL {validation.numero_facture} · {(validation.taille_xml / 1024).toFixed(0)} Ko
                  {validation.document_joint ? ' · facture originale jointe' : ''}
                </div>
              )}
              {voirXml && validation && (
                <pre className="ocr-texte">
                  {validation.xml.replace(/(<cbc:EmbeddedDocumentBinaryObject[^>]*>)[^<]{80,}(<)/, '$1[… document original encodé en base64 …]$2')}
                </pre>
              )}
              {message && <div className={`alerte ${message.type}`}>{message.texte}</div>}
            </div>

            {resultat && (
              <div className="carte">
                <div className="entete-carte">
                  <h2>{resultat.dryRun ? 'Simulation' : 'Résultat'} — transmis via X-Road ({contexte.xroad_client})</h2>
                  {insere && <button className="btn petit primaire" onClick={nouvelleFacture}>Nouvelle facture</button>}
                </div>
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
      )}
    </div>
  );
}
