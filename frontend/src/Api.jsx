const BASE = "http://localhost:8000";

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
  createAuteur:     (d)     => req("POST",   "/auteurs", d),
  updateAuteur:     (id, d) => req("PUT",    `/auteurs/${id}`, d),
  deleteAuteur:     (id)    => req("DELETE", `/auteurs/${id}`),

  createLivre:      (d)     => req("POST",   "/livres", d),
  updateLivre:      (id, d) => req("PUT",    `/livres/${id}`, d),
  deleteLivre:      (id)    => req("DELETE", `/livres/${id}`),

  createAdherent:   (d)     => req("POST",   "/adherents", d),
  updateAdherent:   (id, d) => req("PUT",    `/adherents/${id}`, d),
  deleteAdherent:   (id)    => req("DELETE", `/adherents/${id}`),

  createEnseignant: (d)     => req("POST",   "/enseignants", d),
  updateEnseignant: (id, d) => req("PUT",    `/enseignants/${id}`, d),
  deleteEnseignant: (id)    => req("DELETE", `/enseignants/${id}`),

  createExemplaire: (d)     => req("POST",   "/exemplaires", d),
  deleteExemplaire: (id)    => req("DELETE", `/exemplaires/${id}`),

  createEmprunt:    (d)     => req("POST",   "/emprunts", d),
  updateEmprunt:    (id, d) => req("PUT",    `/emprunts/${id}`, d),

  createSuggestion: (d)     => req("POST",   "/suggestions", d),
  deleteSuggestion: (id)    => req("DELETE", `/suggestions/${id}`),

  // SQL
  runSQL: (sql) => req("POST", "/query/sql", { sql }),

  // LAV — Local As View
  lavSchema:   ()       => req("GET",  "/lav/schema"),
  lavEntity:   (e, p="") => req("GET", `/lav/${e}${p}`),
  lavQuery:    (body)   => req("POST", "/lav/query", body),
  lavSource:   (src)    => req("GET",  `/lav/sources/${src}`),
};
