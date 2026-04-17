import { useState } from "react";
import { api } from "../Api";
import PageHeader from "../Layout/PageHeader";

import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Stack,
  CircularProgress,
  TextField,
  Divider,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

// ── Requêtes prédéfinies ─────────────────────────────────────
const PREDEFINED = [
  { label: "Tous les auteurs",        entity: "AUTEUR",     attrs: "" },
  { label: "Tous les livres",          entity: "LIVRE",      attrs: "" },
  { label: "Thèmes",                   entity: "THEME",      attrs: "" },
  { label: "Exemplaires",             entity: "EXEMPLAIRE", attrs: "" },
  { label: "Adhérents",               entity: "ADHERENT",   attrs: "" },
  { label: "Enseignants",             entity: "ENSEIGNANT", attrs: "" },
  { label: "Emprunts",                entity: "EMPRUNT",    attrs: "" },
  { label: "Suggestions d'achat",     entity: "SUGGESTION", attrs: "" },
  { label: "Livres (isbn + titre)",   entity: "LIVRE",      attrs: "isbn, titre, annee_publication" },
  { label: "Auteurs (nom + prénom)",  entity: "AUTEUR",     attrs: "nom, prenom, nationalite" },
];

const ENTITIES = [
  "AUTEUR", "THEME", "APPARTIENT_THEME", "LIVRE",
  "EXEMPLAIRE", "ADHERENT", "ENSEIGNANT", "EMPRUNT", "SUGGESTION",
];

const SOURCE_COLOR = { S1: "warning", S2: "success", S3: "info" };

export default function SqlPage() {
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
      setResult(r);
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

  return (
    <Box sx={{ p: 4, maxWidth: 1500, mx: "auto" }}>

      <PageHeader
        title="Requêtes sur le Schéma Global"
        subtitle="Interrogation unifiée des 3 sources de données — S1 (MySQL) · S2 (MongoDB) · S3 (Neo4j)"
      />

      <Box display="grid" gridTemplateColumns="280px 1fr" gap={3}>

        {/* ── Sidebar prédéfini ── */}
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

          {/* Constructeur de requête */}
          <Paper elevation={0} sx={{ mb: 3, border: "1px solid #e2e8f0", borderRadius: 2, overflow: "hidden" }}>

            {/* En-tête */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AccountTreeIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" color="text.secondary">
                  Constructeur de requête
                </Typography>
              </Stack>
              <Button
                variant="contained"
                onClick={run}
                disabled={loading}
                disableElevation
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                sx={{ textTransform: "none", borderRadius: 1.5 }}
              >
                {loading ? "En cours..." : "Exécuter"}
              </Button>
            </Box>

            <Box sx={{ p: 3 }}>
              <Stack spacing={2.5}>

                {/* Entité */}
                <FormControl fullWidth size="small">
                  <InputLabel>Entité</InputLabel>
                  <Select
                    value={entity}
                    label="Entité"
                    onChange={(e) => { setEntity(e.target.value); setResult(null); }}
                  >
                    {ENTITIES.map(e => (
                      <MenuItem key={e} value={e}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2">{e}</Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Attributs */}
                <TextField
                  fullWidth
                  size="small"
                  label="Attributs à récupérer (optionnel)"
                  placeholder="ex : isbn, titre, editeur, nb_pages"
                  value={attributes}
                  onChange={(e) => setAttributes(e.target.value)}
                  helperText="Séparez les attributs par des virgules. Laisser vide = tous les attributs."
                />

                {/* Filtre source */}
                <FormControl fullWidth size="small">
                  <InputLabel>Filtrer par source</InputLabel>
                  <Select
                    value={sourceFilter}
                    label="Filtrer par source"
                    onChange={(e) => setSourceFilter(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Toutes les sources</em>
                    </MenuItem>
                    <MenuItem value="S1">
                      <Chip label="S1" size="small" color="warning" sx={{ mr: 1, fontWeight: 700 }} />
                      MySQL
                    </MenuItem>
                    <MenuItem value="S2">
                      <Chip label="S2" size="small" color="success" sx={{ mr: 1, fontWeight: 700 }} />
                      MongoDB
                    </MenuItem>
                    <MenuItem value="S3">
                      <Chip label="S3" size="small" color="info" sx={{ mr: 1, fontWeight: 700 }} />
                      Neo4j
                    </MenuItem>
                  </Select>
                </FormControl>

              </Stack>
            </Box>
          </Paper>

          {/* Erreur */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Résultats */}
          {result && (
            <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 2 }}>

              {/* Barre de résumé */}
              <Box p={2} bgcolor="#f8fafc" borderBottom="1px solid #e2e8f0">
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">

                  <Typography variant="body2" fontWeight={700}>
                    {result.total} résultat{result.total > 1 ? "s" : ""}
                  </Typography>

                  <Divider orientation="vertical" flexItem />

                  <Typography variant="body2" color="text.secondary">
                    {columns.length} colonne{columns.length > 1 ? "s" : ""}
                  </Typography>

                  <Divider orientation="vertical" flexItem />

                  {/* Comptage par source */}
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {result.sources_used?.map(src => (
                      <Chip
                        key={src}
                        label={`${src} : ${result.source_counts?.[src] ?? 0} enreg.`}
                        size="small"
                        color={SOURCE_COLOR[src] || "default"}
                        sx={{ fontSize: "0.7rem", fontWeight: 700 }}
                      />
                    ))}
                  </Stack>

                  {result.sources_skipped?.length > 0 && (
                    <>
                      <Divider orientation="vertical" flexItem />
                      <Typography variant="caption" color="text.secondary">
                        Non disponible : {result.sources_skipped.join(", ")}
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
                          <TableCell
                            key={col}
                            sx={{ fontSize: 13, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", py: 0.75 }}
                          >
                            {col === "_source" ? (
                              <Chip
                                label={row[col]}
                                size="small"
                                color={SOURCE_COLOR[row[col]] || "default"}
                                sx={{ fontWeight: 700, fontSize: "0.65rem" }}
                              />
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