// src/api/ocr.js — module OCR des factures fournisseurs (middleware ABI)
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'X-API-Key': 'mw-xroad-gateway' },
  timeout: 180000, // l'OCR d'un scan de plusieurs pages peut prendre du temps
});

const enc = encodeURIComponent;
const base = (s, op) => `/plateforme/${enc(s)}/op/${enc(op)}/ocr`;

export const capacitesOcr = async () => (await api.get('/plateforme/ocr/capacites')).data;

export async function analyserFacture(subsystem, op, fichier, onProgression) {
  const form = new FormData();
  form.append('fichier', fichier);
  const res = await api.post(base(subsystem, op), form, {
    onUploadProgress: (e) => {
      if (onProgression && e.total) onProgression(Math.round((e.loaded * 100) / e.total));
    },
  });
  return res.data;
}

export const validerFacture = async (subsystem, op, analyseId, corrections) =>
  (await api.post(`${base(subsystem, op)}/${enc(analyseId)}/valider`, corrections)).data;

export const noterResultat = async (subsystem, op, analyseId, resultat) =>
  (await api.post(`${base(subsystem, op)}/${enc(analyseId)}/resultat`, resultat)).data;
