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

  // Local CRUD S1
  s1Read:   (table) => req("GET", `/s1/${table}`),
  s1Create: (table, data) => req("POST", `/s1/${table}`, data),
  s1Update: (table, idCol, idVal, data) => req("PUT", `/s1/${table}/${idCol}/${idVal}`, data),
  s1Delete: (table, idCol, idVal) => req("DELETE", `/s1/${table}/${idCol}/${idVal}`),

  // Local CRUD S2
  s2Read:   (collection) => req("GET", `/s2/${collection}`),
  s2Create: (collection, data) => req("POST", `/s2/${collection}`, data),
  s2Update: (collection, idVal, data) => req("PUT", `/s2/${collection}/${idVal}`, data),
  s2Delete: (collection, idVal) => req("DELETE", `/s2/${collection}/${idVal}`),

  // Local CRUD S3
  s3Read:   (label) => req("GET", `/s3/${label}`),
  s3Create: (label, data) => req("POST", `/s3/${label}`, data),
  s3Update: (label, idVal, data) => req("PUT", `/s3/${label}/${idVal}`, data),
  s3Delete: (label, idVal) => req("DELETE", `/s3/${label}/${idVal}`),

  // SQL
  runSQL: (sql) => req("POST", "/query/sql", { sql }),

  // LAV — Local As View
  lavSchema:   ()       => req("GET",  "/lav/schema"),
  lavEntity:   (e, p="") => req("GET", `/lav/${e}${p}`),
  lavQuery:    (body)   => req("POST", "/lav/query", body),
  lavSource:   (src)    => req("GET",  `/lav/sources/${src}`),
};
