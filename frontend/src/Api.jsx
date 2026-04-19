const BASE = "http://127.0.0.1:8000";

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Erreur serveur");
  }
  return res.json();
}

export const api = {
  // health & stats
  health: () => req("GET", "/health"),
  stats:  () => req("GET", "/stats"),

  // vues GAV (lecture)
  auteurs:         (p="") => req("GET", `/auteurs${p}`),
  themes:          (p="") => req("GET", `/themes${p}`),
  livres:          (p="") => req("GET", `/livres${p}`),
  exemplaires:     (p="") => req("GET", `/exemplaires${p}`),
  personnes:       (p="") => req("GET", `/personnes${p}`),
  adherents:       (p="") => req("GET", `/adherents${p}`),
  enseignants:     (p="") => req("GET", `/enseignants${p}`),
  emprunts:        (p="") => req("GET", `/emprunts${p}`),
  suggestions:     (p="") => req("GET", `/suggestions${p}`),
  appartientTheme: (p="") => req("GET", `/appartient-theme${p}`),

  // CRUD S1
  createAuteur:     (d, s="S1")     => req("POST",   `/auteurs?source=${s}`, d),
  updateAuteur:     (id, d, s="S1") => req("PUT",    `/auteurs/${id}?source=${s}`, d),
  deleteAuteur:     (id, s="S1")    => req("DELETE", `/auteurs/${id}?source=${s}`),

  createLivre:      (d, s="S1")     => req("POST",   `/livres?source=${s}`, d),
  updateLivre:      (id, d, s="S1") => req("PUT",    `/livres/${id}?source=${s}`, d),
  deleteLivre:      (id, s="S1")    => req("DELETE", `/livres/${id}?source=${s}`),

  createAdherent:   (d, s="S1")     => req("POST",   `/adherents?source=${s}`, d),
  updateAdherent:   (id, d, s="S1") => req("PUT",    `/adherents/${id}?source=${s}`, d),
  deleteAdherent:   (id, s="S1")    => req("DELETE", `/adherents/${id}?source=${s}`),

  createEnseignant: (d, s="S1")     => req("POST",   `/enseignants?source=${s}`, d),
  updateEnseignant: (id, d, s="S1") => req("PUT",    `/enseignants/${id}?source=${s}`, d),
  deleteEnseignant: (id, s="S1")    => req("DELETE", `/enseignants/${id}?source=${s}`),

  createExemplaire: (d, s="S1")     => req("POST",   `/exemplaires?source=${s}`, d),
  deleteExemplaire: (id, s="S1")    => req("DELETE", `/exemplaires/${id}?source=${s}`),

  createEmprunt:    (d, s="S1")     => req("POST",   `/emprunts?source=${s}`, d),
  updateEmprunt:    (id, d, s="S1") => req("PUT",    `/emprunts/${id}?source=${s}`, d),

  createSuggestion: (d, s="S1")     => req("POST",   `/suggestions?source=${s}`, d),
  deleteSuggestion: (id, s="S1")    => req("DELETE", `/suggestions/${id}?source=${s}`),

  // SQL
  runSQL: (sql) => req("POST", "/query/sql", { sql }),

  // LAV — Local As View
  lavSchema:   ()       => req("GET",  "/lav/schema"),
  lavEntity:   (e, p="") => req("GET", `/lav/${e}${p}`),
  lavQuery:    (body)   => req("POST", "/lav/query", body),
  lavSource:   (src)    => req("GET",  `/lav/sources/${src}`),
};
