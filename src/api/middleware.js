// src/api/middleware.js
import axios from 'axios';

const API_KEY = 'mw-force-n-erp';

const MIDDLEWARE_URL = 'http://51.38.224.210/api/v1';
const KEYCLOAK_URL = '/keycloak/realms/fayma/protocol/openid-connect/token';

// ── Authentification Keycloak ─────────────────────────────────────────────
// Accepte username Keycloak OU email — Keycloak accepte les deux
// si "Email as username" est activé dans le realm, sinon username seulement
export async function login(username, password) {
  const params = new URLSearchParams({
    grant_type:    'password',
    client_id:     'abi-api',
    client_secret: '9cUkA1J1X1TSFUmGytneDf4qXaF84U9H',
    username,
    password,
  });

  try {
    const res = await axios.post(KEYCLOAK_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  } catch (e) {
    // Si l'identifiant contient @ et que ça échoue,
    // retenter avec la partie avant le @ comme username
    if (username.includes('@') && e.response?.status === 401) {
      const usernameFromEmail = username
        .split('@')[0]
        .replace(/\./g, '.')
        .toLowerCase();
      const params2 = new URLSearchParams({
        grant_type:    'password',
        client_id:     'abi-api',
        client_secret: '9cUkA1J1X1TSFUmGytneDf4qXaF84U9H',
        username: usernameFromEmail,
        password,
      });
      const res2 = await axios.post(KEYCLOAK_URL, params2, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return res2.data;
    }
    throw e;
  }
}

function hdrs(userToken) {
  return {
    'X-API-Key': API_KEY,
    ...(userToken ? { 'X-Fournisseur-Token': userToken } : {}),
  };
}

// ── Contrats disponibles ──────────────────────────────────────────────────
export async function getContrats(activeClient, userToken) {
  const res = await axios.get(`${MIDDLEWARE_URL}/import/contrats`, {
    params: { active_client: activeClient },
    headers: hdrs(userToken),
  });
  return res.data.contrats || [];
}

// ── OP d'un contrat ───────────────────────────────────────────────────────
export async function getOP(numeroContrat, activeClient, userToken) {
  const res = await axios.get(
    `${MIDDLEWARE_URL}/import/contrats/${numeroContrat}/op`,
    { params: { active_client: activeClient }, headers: hdrs(userToken) }
  );
  return res.data.op || [];
}

// ── Import facture UBL 2.1 ────────────────────────────────────────────────
export async function importerFacture({
  contrat, op, activeClient, file, dryRun, userToken,
}) {
  const form = new FormData();
  form.append('file', file);
  const res = await axios.post(
    `${MIDDLEWARE_URL}/import/facture`,
    form,
    {
      params: { contrat, op, active_client: activeClient, dry_run: dryRun },
      headers: { ...hdrs(userToken), 'Content-Type': 'multipart/form-data' },
    }
  );
  return res.data;
}

// ── Factures existantes ───────────────────────────────────────────────────
export async function getFactures(userToken) {
  const res = await axios.get(`${MIDDLEWARE_URL}/factures/bdc`, {
    headers: hdrs(userToken),
  });
  return res.data.factures || [];
}

// ── Télécharger XML UBL d'une facture ────────────────────────────────────
export async function downloadXML(factureId, userToken) {
  const res = await axios.get(
    `${MIDDLEWARE_URL}/factures/bdc/transform/${factureId}/xml`,
    { headers: hdrs(userToken), responseType: 'blob' }
  );
  return res.data;
}