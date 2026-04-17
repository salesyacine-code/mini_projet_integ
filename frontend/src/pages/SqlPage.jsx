import { useState } from "react";
import { api } from "../Api";
import PageHeader from "../Layout/PageHeader";

import {
  Box, Typography, Paper, Button, List, ListItemButton, ListItemText,
  Select, MenuItem, FormControl, InputLabel, Alert, Table, TableHead,
  TableRow, TableCell, TableBody, Chip, Stack, CircularProgress,
  TextField, Divider, ToggleButtonGroup, ToggleButton, Tooltip,
} from "@mui/material";
import PlayArrowIcon      from "@mui/icons-material/PlayArrow";
import AccountTreeIcon    from "@mui/icons-material/AccountTree";
import InfoOutlinedIcon   from "@mui/icons-material/InfoOutlined";

// ── Entités disponibles ───────────────────────────────────────
const ENTITIES = [
  "AUTEUR", "THEME", "APPARTIENT_THEME", "LIVRE",
  "EXEMPLAIRE", "ADHERENT", "ENSEIGNANT", "EMPRUNT", "SUGGESTION",
];

// Map entity → api call pour le mode GAV
const GAV_FN = {
  AUTEUR:          () => api.auteurs(),
  THEME:           () => api.themes(),
  APPARTIENT_THEME:() => api.appartientTheme(),
  LIVRE:           () => api.livres(),
  EXEMPLAIRE:      () => api.exemplaires(),
  ADHERENT:        () => api.adherents(),
  ENSEIGNANT:      () => api.enseignants(),
  EMPRUNT:         () => api.emprunts(),
  SUGGESTION:      () => api.suggestions(),
};

const PREDEFINED = [
  { label: "Tous les auteurs",        entity: "AUTEUR",      attrs: "" },
  { label: "Tous les livres",          entity: "LIVRE",       attrs: "" },
  { label: "Thèmes",                   entity: "THEME",       attrs: "" },
  { label: "Exemplaires",             entity: "EXEMPLAIRE",  attrs: "" },
  { label: "Adhérents",               entity: "ADHERENT",    attrs: "" },
  { label: "Enseignants",             entity: "ENSEIGNANT",  attrs: "" },
  { label: "Emprunts",                entity: "EMPRUNT",     attrs: "" },
  { label: "Suggestions d'achat",     entity: "SUGGESTION",  attrs: "" },
  { label: "Livres (isbn + titre)",   entity: "LIVRE",       attrs: "isbn, titre, annee_publication" },
  { label: "Auteurs (nom + prénom)",  entity: "AUTEUR",      attrs: "nom, prenom, nationalite" },
];

const SOURCE_COLOR = { S1: "warning", S2: "success", S3: "info" };

// ── Descriptions des modes ────────────────────────────────────
const MODE_INFO = {
  GAV: {
    title: "GAV — Global As View",
    desc:  "Le schéma global est défini comme une vue sur les sources locales. Le médiateur interroge toutes les sources en parallèle, fusionne et déduplique les résultats. Les sources participantes sont fixes pour chaque entité.",
    color: "#f59e0b",
    bg:    "rgba(245,158,11,0.07)",
  },
  LAV: {
    title: "LAV — Local As View (Algorithme Bucket)",
    desc:  "Chaque source locale est définie comme une vue sur le schéma global. Le moteur Bucket analyse les attributs demandés, détermine automatiquement quelles sources interroger, exécute en parallèle et fusionne. Permet la projection d'attributs.",
    color: "#6366f1",
    bg:    "rgba(99,102,241,0.07)",
  },
};

export default function SqlPage() {
  const [mode,        setMode]        = useState("GAV");
  const [entity,      setEntity]      = useState("AUTEUR");
  const [attributes,  setAttributes]  = useState("");
  const [sourceFilter,setSourceFilter]= useState("");
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [selected,    setSelected]    = useState(0);

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      if (mode === "GAV") {
        // ── Mode GAV : appel direct aux endpoints médiateur ──
        const fn = GAV_FN[entity];
        if (!fn) throw new Error(`Entité ${entity} non disponible en mode GAV`);
        const res = await fn();
        let rows = res.data || [];

        // Filtrage côté client par source si spécifié
        if (sourceFilter) {
          rows = rows.filter(r => (r._source || r.source) === sourceFilter);
        }

        setResult({
          mode:          "GAV",
          entity,
          total:         rows.length,
          data:          rows,
          sources_used:  [...new Set(rows.map(r => r._source || r.source).filter(Boolean))],
          source_counts: res.source_counts || {},
        });

      } else {
        // ── Mode LAV : appel via algorithme Bucket ──
        const body = {
          entity,
          attributes: attributes.trim()
            ? attributes.split(",").map(a => a.trim())
            : null,
          filters: {},
          sources: sourceFilter ? [sourceFilter] : null,
          require_all: false,
        };
        const r = await api.lavQuery(body);
        setResult({ mode: "LAV", ...r, data: r.data || r.rows });
      }
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pickPredefined = (i) => {
    setSelected(i);
    setEntity(PREDEFINED[i].entity);
    setAttributes(PREDEFINED[i].attrs);
    setSourceFilter("");
    setResult(null);
    setError(null);
  };

  const columns = result?.data?.length > 0
    ? Object.keys(result.data[0]).filter(k => k !== "__v")
    : [];

  const info = MODE_INFO[mode];

  return (
    <Box sx={{ p: 4, maxWidth: 1500, mx: "auto" }}>

      <PageHeader
        title="Requêtes sur le Schéma Global"
        subtitle="Interrogation unifiée des 3 sources de données — S1 (MySQL) · S2 (MongoDB) · S3 (Neo4j)"
      />

      <Box display="grid" gridTemplateColumns="280px 1fr" gap={3}>

        {/* ── Sidebar ── */}
        <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2, height: "fit-content" }}>
          <Typography variant="subtitle2" sx={{ p: 2, borderBottom: "1px solid #e2e8f0", bgcolor: "#f8fafc", fontWeight: 700 }}>
            Requêtes rapides
          </Typography>
          <List dense disablePadding>
            {PREDEFINED.map((q, i) => (
              <ListItemButton
                key={i}
                selected={selected === i}
                onClick={() => pickPredefined(i)}
                sx={{
                  "&.Mui-selected": { bgcolor: "primary.main", color: "white" },
                  "&.Mui-selected:hover": { bgcolor: "primary.dark" },
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <ListItemText
                  primary={q.label}
                  primaryTypographyProps={{
                    fontSize: 13,
                    fontWeight: selected === i ? 600 : 400,
                    color: selected === i ? "white" : "text.primary",
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* ── Zone principale ── */}
        <Box>

          {/* ── Sélecteur GAV / LAV ── */}
          <Paper elevation={0} sx={{ mb: 2.5, border: `1px solid ${info.color}`, borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 2, bgcolor: info.bg, borderBottom: `1px solid ${info.color}` }}>
              <Typography variant="subtitle2" fontWeight={700} color={info.color}>
                Mode d'interrogation
              </Typography>

              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, v) => { if (v) { setMode(v); setResult(null); setError(null); } }}
                size="small"
              >
                <ToggleButton
                  value="GAV"
                  sx={{
                    px: 2.5, fontWeight: 700, fontSize: "0.8rem",
                    "&.Mui-selected": { bgcolor: "#f59e0b", color: "white", "&:hover": { bgcolor: "#d97706" } },
                  }}
                >
                  GAV
                </ToggleButton>
                <ToggleButton
                  value="LAV"
                  sx={{
                    px: 2.5, fontWeight: 700, fontSize: "0.8rem",
                    "&.Mui-selected": { bgcolor: "#6366f1", color: "white", "&:hover": { bgcolor: "#4f46e5" } },
                  }}
                >
                  LAV
                </ToggleButton>
              </ToggleButtonGroup>

              <Chip
                label={info.title}
                size="small"
                sx={{ bgcolor: info.color, color: "white", fontWeight: 700, fontSize: "0.7rem" }}
              />
            </Box>

            {/* Description du mode */}
            <Box sx={{ px: 2.5, py: 1.5, display: "flex", gap: 1, alignItems: "flex-start" }}>
              <InfoOutlinedIcon sx={{ fontSize: 16, color: info.color, mt: "2px", flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {info.desc}
              </Typography>
            </Box>
          </Paper>

          {/* ── Constructeur de requête ── */}
          <Paper elevation={0} sx={{ mb: 3, border: "1px solid #e2e8f0", borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AccountTreeIcon fontSize="small" sx={{ color: info.color }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Paramètres de la requête
                </Typography>
              </Stack>
              <Button
                variant="contained"
                onClick={run}
                disabled={loading}
                disableElevation
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                sx={{ textTransform: "none", borderRadius: 1.5, bgcolor: info.color, "&:hover": { bgcolor: info.color, opacity: 0.9 } }}
              >
                {loading ? "En cours..." : "Exécuter"}
              </Button>
            </Box>

            <Box sx={{ p: 3 }}>
              <Stack spacing={2.5}>
                {/* Entité */}
                <FormControl fullWidth size="small">
                  <InputLabel>Entité</InputLabel>
                  <Select value={entity} label="Entité" onChange={(e) => { setEntity(e.target.value); setResult(null); }}>
                    {ENTITIES.map(e => <MenuItem key={e} value={e}>{e}</MenuItem>)}
                  </Select>
                </FormControl>

                {/* Attributs — uniquement en mode LAV */}
                <Tooltip
                  title={mode === "GAV" ? "La projection d'attributs n'est pas disponible en mode GAV — tous les attributs sont retournés" : ""}
                  placement="top"
                >
                  <span>
                    <TextField
                      fullWidth
                      size="small"
                      label={`Attributs à récupérer (optionnel)${mode === "GAV" ? " — non disponible en GAV" : ""}`}
                      placeholder="ex : isbn, titre, editeur, nb_pages"
                      value={mode === "LAV" ? attributes : ""}
                      onChange={(e) => setAttributes(e.target.value)}
                      disabled={mode === "GAV"}
                      helperText={
                        mode === "LAV"
                          ? "Séparez par des virgules. Vide = tous les attributs."
                          : "En mode GAV, tous les attributs sont retournés (vue complète)."
                      }
                    />
                  </span>
                </Tooltip>

                {/* Filtre source */}
                <FormControl fullWidth size="small">
                  <InputLabel>Filtrer par source</InputLabel>
                  <Select value={sourceFilter} label="Filtrer par source" onChange={(e) => setSourceFilter(e.target.value)}>
                    <MenuItem value=""><em>Toutes les sources</em></MenuItem>
                    <MenuItem value="S1"><Chip label="S1" size="small" color="warning" sx={{ mr: 1, fontWeight: 700 }} />MySQL</MenuItem>
                    <MenuItem value="S2"><Chip label="S2" size="small" color="success" sx={{ mr: 1, fontWeight: 700 }} />MongoDB</MenuItem>
                    <MenuItem value="S3"><Chip label="S3" size="small" color="info"    sx={{ mr: 1, fontWeight: 700 }} />Neo4j</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Box>
          </Paper>

          {/* ── Erreur ── */}
          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

          {/* ── Résultats ── */}
          {result && (
            <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2 }}>

              <Box p={2} bgcolor="#f8fafc" borderBottom="1px solid #e2e8f0">
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">

                  {/* Badge mode utilisé */}
                  <Chip
                    label={`Mode : ${result.mode}`}
                    size="small"
                    sx={{ bgcolor: info.color, color: "white", fontWeight: 700, fontSize: "0.7rem" }}
                  />

                  <Typography variant="body2" fontWeight={700}>
                    {result.total} résultat{result.total > 1 ? "s" : ""}
                  </Typography>

                  <Divider orientation="vertical" flexItem />

                  <Typography variant="body2" color="text.secondary">
                    {columns.length} colonne{columns.length > 1 ? "s" : ""}
                  </Typography>

                  <Divider orientation="vertical" flexItem />

                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {result.sources_used?.map(src => (
                      <Chip
                        key={src}
                        label={`${src} : ${result.source_counts?.[src] ?? "?"}`}
                        size="small"
                        color={SOURCE_COLOR[src] || "default"}
                        sx={{ fontSize: "0.7rem", fontWeight: 700 }}
                      />
                    ))}
                  </Stack>

                  {/* Plan LAV seulement */}
                  {result.mode === "LAV" && result.rewriting_plan?.length > 0 && (
                    <>
                      <Divider orientation="vertical" flexItem />
                      <Tooltip title={result.rewriting_plan.join(" → ")} placement="top">
                        <Chip label="Plan Bucket ?" size="small" variant="outlined" sx={{ fontSize: "0.65rem", borderColor: "#6366f1", color: "#6366f1", cursor: "help" }} />
                      </Tooltip>
                    </>
                  )}

                  {result.sources_skipped?.length > 0 && (
                    <>
                      <Divider orientation="vertical" flexItem />
                      <Typography variant="caption" color="text.secondary">
                        Ignorées : {result.sources_skipped.join(", ")}
                      </Typography>
                    </>
                  )}
                </Stack>
              </Box>

              {/* Tableau */}
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f1f5f9" }}>
                      {columns.map(col => (
                        <TableCell key={col} sx={{ fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", py: 1.5 }}>
                          {col.replace(/_/g, " ")}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(result.data || []).slice(0, 200).map((row, i) => (
                      <TableRow key={i} hover>
                        {columns.map(col => (
                          <TableCell key={col} sx={{ fontSize: 13, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", py: 0.75 }}>
                            {col === "_source" || col === "source" ? (
                              <Chip label={row[col]} size="small" color={SOURCE_COLOR[row[col]] || "default"} sx={{ fontWeight: 700, fontSize: "0.65rem" }} />
                            ) : Array.isArray(row[col]) ? (
                              row[col].join(", ")
                            ) : (
                              String(row[col] ?? "—")
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              {result.data?.length > 200 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 2, textAlign: "center" }}>
                  Affichage limité aux 200 premiers résultats sur {result.total} au total.
                </Typography>
              )}
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
}