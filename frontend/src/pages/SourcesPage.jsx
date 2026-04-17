import { useState, useEffect } from "react";
import { api } from "../Api";
import PageHeader from "../Layout/PageHeader";
import {
  Box, Typography, Grid, Card, CardContent, CardHeader,
  Chip, CircularProgress, Alert, Avatar, Tabs, Tab,
  Table, TableBody, TableCell, TableHead, TableRow,
  TableContainer, Paper, Divider, Stack, Badge,
} from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import TableRowsIcon from "@mui/icons-material/TableRows";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

// ── Config des 3 sources ────────────────────────────────
const SOURCES = [
  {
    id: "S1",
    label: "Source S1",
    tech: "MySQL",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    border: "#f97316",
    avatar: "S1",
  },
  {
    id: "S2",
    label: "Source S2",
    tech: "MongoDB",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    border: "#22c55e",
    avatar: "S2",
  },
  {
    id: "S3",
    label: "Source S3",
    tech: "Neo4j",
    color: "#818cf8",
    bg: "rgba(129,140,248,0.08)",
    border: "#818cf8",
    avatar: "S3",
  },
];

// ── Entités à afficher ──────────────────────────────────
const ENTITIES = [
  { id: "auteurs",      label: "Auteurs",      fn: () => api.auteurs()      },
  { id: "themes",       label: "Thèmes",       fn: () => api.themes()       },
  { id: "livres",       label: "Livres",       fn: () => api.livres()       },
  { id: "exemplaires",  label: "Exemplaires",  fn: () => api.exemplaires()  },
  { id: "adherents",    label: "Adhérents",    fn: () => api.adherents()    },
  { id: "enseignants",  label: "Enseignants",  fn: () => api.enseignants()  },
  { id: "emprunts",     label: "Emprunts",     fn: () => api.emprunts()     },
  { id: "suggestions",  label: "Suggestions",  fn: () => api.suggestions()  },
];

// ── Composant : entête d'une source ─────────────────────
function SourceHeader({ source, count, loading }) {
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1.5,
      p: 2,
      borderRadius: 2,
      bgcolor: source.bg,
      border: `1px solid ${source.border}`,
      mb: 2,
    }}>
      <Avatar sx={{ bgcolor: source.color, width: 40, height: 40, fontWeight: 700, fontSize: "0.85rem" }}>
        {source.avatar}
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} color={source.color}>
          {source.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {source.tech}
        </Typography>
      </Box>
      {loading
        ? <CircularProgress size={18} sx={{ color: source.color }} />
        : <Chip label={`${count} enreg.`} size="small" sx={{ bgcolor: source.color, color: "#fff", fontWeight: 700, fontSize: "0.7rem" }} />
      }
    </Box>
  );
}

// ── Composant : mini-table de données d'une source ──────
function SourceDataTable({ rows, entity }) {
  if (!rows || rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center", fontStyle: "italic" }}>
        Aucune donnée
      </Typography>
    );
  }

  // Extract relevant columns (exclude internal keys)
  const exclude = ["_source", "__v", "_id"];
  const cols = Object.keys(rows[0]).filter(k => !exclude.includes(k)).slice(0, 5);

  return (
    <TableContainer sx={{ maxHeight: 280, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {cols.map(col => (
              <TableCell key={col} sx={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", bgcolor: "background.paper", whiteSpace: "nowrap" }}>
                {col.replace(/_/g, " ")}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.slice(0, 10).map((row, i) => (
            <TableRow key={i} hover>
              {cols.map(col => (
                <TableCell key={col} sx={{ fontSize: "0.75rem", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {Array.isArray(row[col])
                    ? row[col].join(", ")
                    : String(row[col] ?? "—")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── Page principale ──────────────────────────────────────
export default function SourcesPage() {
  const [tab, setTab] = useState(0);
  const [data, setData] = useState({});          // { auteurs: { S1: [], S2: [], S3: [] }, ... }
  const [loading, setLoading] = useState({});    // { auteurs: true/false, ... }
  const [errors, setErrors] = useState({});

  const entity = ENTITIES[tab];

  useEffect(() => {
    if (data[entity.id]) return; // already loaded

    setLoading(p => ({ ...p, [entity.id]: true }));
    setErrors(p => ({ ...p, [entity.id]: null }));

    entity.fn()
      .then(res => {
        const rows = res.data || [];
        // Group by _source
        const grouped = { S1: [], S2: [], S3: [] };
        rows.forEach(row => {
          const src = row._source || "S1";
          if (grouped[src]) grouped[src].push(row);
        });
        setData(p => ({ ...p, [entity.id]: grouped }));
      })
      .catch(e => setErrors(p => ({ ...p, [entity.id]: e.message })))
      .finally(() => setLoading(p => ({ ...p, [entity.id]: false })));
  }, [tab]);

  const entityData  = data[entity.id];
  const isLoading   = loading[entity.id];
  const entityError = errors[entity.id];

  return (
    <Box sx={{ p: 4, maxWidth: 1600, mx: "auto" }}>
      <PageHeader
        title="Données par Source"
        subtitle="Visualisation côte à côte des données provenant de S1 (MySQL), S2 (MongoDB) et S3 (Neo4j)"
      />

      {/* Legend */}
      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        {SOURCES.map(src => (
          <Chip
            key={src.id}
            icon={<StorageIcon sx={{ color: `${src.color} !important` }} />}
            label={`${src.id} · ${src.tech}`}
            variant="outlined"
            sx={{ borderColor: src.color, color: src.color, fontWeight: 600 }}
          />
        ))}
      </Stack>

      {/* Entity tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.875rem", minWidth: "auto", px: 2 },
          }}
        >
          {ENTITIES.map(e => (
            <Tab
              key={e.id}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <TableRowsIcon sx={{ fontSize: 16 }} />
                  {e.label}
                </Box>
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Error */}
      {entityError && (
        <Alert severity="error" sx={{ mb: 3 }}>{entityError}</Alert>
      )}

      {/* 3-column layout */}
      <Grid container spacing={3}>
        {SOURCES.map(source => {
          const srcRows = entityData?.[source.id] || [];
          const srcLoading = isLoading;

          return (
            <Grid item xs={12} md={4} key={source.id}>
              <Card variant="outlined" sx={{
                borderColor: source.border,
                borderRadius: 2,
                height: "100%",
                transition: "box-shadow 0.2s",
                "&:hover": { boxShadow: `0 0 0 2px ${source.color}30` },
              }}>
                <CardContent sx={{ p: 2 }}>
                  {/* Source header */}
                  <SourceHeader source={source} count={srcRows.length} loading={srcLoading} />

                  {/* Stats row */}
                  {!srcLoading && entityData && (
                    <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
                      <Chip
                        size="small"
                        icon={srcRows.length > 0 ? <CheckCircleIcon sx={{ fontSize: "14px !important" }} /> : <ErrorIcon sx={{ fontSize: "14px !important" }} />}
                        label={srcRows.length > 0 ? `${srcRows.length} enregistrement(s)` : "Vide"}
                        color={srcRows.length > 0 ? "success" : "default"}
                        variant="outlined"
                        sx={{ fontSize: "0.7rem" }}
                      />
                      {srcRows.length > 0 && (
                        <Chip
                          size="small"
                          label={`${Object.keys(srcRows[0]).filter(k => k !== "_source").length} attributs`}
                          variant="outlined"
                          sx={{ fontSize: "0.7rem" }}
                        />
                      )}
                    </Box>
                  )}

                  {/* Data table */}
                  {srcLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                      <CircularProgress size={30} sx={{ color: source.color }} />
                    </Box>
                  ) : (
                    <SourceDataTable rows={srcRows} entity={entity.id} />
                  )}

                  {/* Attributes note */}
                  {!srcLoading && srcRows.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "right" }}>
                      Affichage limité aux 10 premiers enregistrements
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Schema diff section */}
      {!isLoading && entityData && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            🔍 Différences de schéma — {entity.label}
          </Typography>
          <Grid container spacing={2}>
            {SOURCES.map(source => {
              const srcRows = entityData[source.id] || [];
              const attrs = srcRows.length > 0
                ? Object.keys(srcRows[0]).filter(k => k !== "_source")
                : [];
              return (
                <Grid item xs={12} md={4} key={source.id}>
                  <Paper variant="outlined" sx={{ p: 2, borderColor: source.border, borderRadius: 2 }}>
                    <Typography variant="caption" fontWeight={700} color={source.color} sx={{ display: "block", mb: 1 }}>
                      {source.label} — {source.tech}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {attrs.length > 0
                        ? attrs.map(attr => (
                            <Chip
                              key={attr}
                              label={attr}
                              size="small"
                              sx={{ fontSize: "0.65rem", bgcolor: source.bg, borderColor: source.border, color: source.color }}
                              variant="outlined"
                            />
                          ))
                        : <Typography variant="caption" color="text.secondary">Aucun attribut</Typography>
                      }
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}
    </Box>
  );
}
