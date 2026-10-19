import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'X-API-Key': 'mw-xroad-gateway' },
});

export function erreur(e) {
  const d = e?.response?.data?.detail;
  if (d?.message) return d.message;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(' · ');
  return e?.message || 'Erreur inconnue';
}

const P = '/plateforme';
const enc = encodeURIComponent;

export const getFournisseurs = async () => (await api.get(`${P}/fournisseurs`)).data.fournisseurs || [];
export const getContexte = async (s) => (await api.get(`${P}/${enc(s)}/contexte`)).data;
export const getContrats = async (s) => (await api.get(`${P}/${enc(s)}/contrats`)).data.contrats || [];
export const getOP = async (s, c) => (await api.get(`${P}/${enc(s)}/contrats/${enc(c)}/op`)).data.op || [];
export const getUblOP = async (s, op) =>
  (await api.get(`${P}/${enc(s)}/op/${enc(op)}/ubl`, { responseType: 'text' })).data;

export async function importerFacture({ subsystem, contrat, op, activeClient, xml, dryRun, envoyer }) {
  const res = await api.post('/xroad/import-facture', xml, {
    params: { contrat, op, active_client: activeClient, dry_run: dryRun, envoyer },
    headers: { 'Content-Type': 'application/xml', 'X-Road-Client': `ABI/ABI/${subsystem}/ERP` },
  });
  return res.data;
}

export const getFactures = async (s) => (await api.get(`${P}/${enc(s)}/factures`)).data.factures || [];
export const envoyerFacture = async (s, id) =>
  (await api.post(`${P}/${enc(s)}/factures/${enc(id)}/envoyer`)).data;

export async function telechargerUbl(s, id, nom) {
  const res = await api.get(`${P}/${enc(s)}/factures/${enc(id)}/ubl`, { responseType: 'blob' });
  telechargerBlob(res.data, `${nom || id}_UBL.xml`);
}

export function telechargerBlob(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export const webhookMosip = async (payload) => (await api.post('/webhooks/mosip', payload)).data;
