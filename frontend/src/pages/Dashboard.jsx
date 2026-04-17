import { useState, useEffect } from "react";
import { api } from "../Api";
import {
  Box, Typography, Grid, Paper, Chip, CircularProgress, Divider, Stack
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import PageHeader from "../Layout/PageHeader";

function StatCard({ label, value, sub }) {
  return (
    <Paper elevation={0} sx={{ 
      p: 2.5, 
      borderRadius: 3, 
      border: "1px solid",
      borderColor: "divider",
      bgcolor: "background.paper",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      transition: "box-shadow 0.2s",
      "&:hover": {
        boxShadow: "0 4px 20px 0 rgba(0,0,0,0.05)"
      }
    }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 0.5, lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="h4" color="text.primary" fontWeight={600}>
        {value ?? "—"}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

function HealthBadge({ label, status }) {
  const ok = status === "OK";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: ok ? "success.50" : "error.50", border: "1px solid", borderColor: ok ? "success.200" : "error.200" }}>
      {ok
        ? <CheckCircleIcon fontSize="small" color="success" />
        : <ErrorIcon fontSize="small" color="error" />
      }
      <Typography variant="body2" fontWeight={500} color={ok ? "success.900" : "error.900"}>{label}</Typography>
      <Chip
        label={ok ? "Connecté" : "Erreur"}
        size="small"
        color={ok ? "success" : "error"}
        sx={{ fontWeight: 600, height: 24 }}
      />
    </Box>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.stats(), api.health()])
      .then(([s, h]) => { setStats(s); setHealth(h); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 4, color: "text.secondary" }}>
      <CircularProgress size={24} color="inherit" />
      <Typography variant="body1">Chargement des données...</Typography>
    </Box>
  );

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      <PageHeader 
        title="Vue d'ensemble" 
        subtitle="Médiateur de données — schéma global intégré (3 sources)" 
      />

      {/* Health */}
      {health && (
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 1 }}>
            État de l'intégration
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {[
              ["S1 MySQL",   health.s1_mysql],
              ["S2 MongoDB", health.s2_mongodb],
              ["S3 Neo4j",   health.s3_neo4j],
            ].map(([label, status]) => (
              <HealthBadge key={label} label={label} status={status} />
            ))}
          </Stack>
        </Box>
      )}

      {/* Stats */}
      {stats && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, mt: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Entités globales dédupliquées
          </Typography>
          <Grid container spacing={2} sx={{ mb: 6 }}>
            {[
              ["Auteurs",     stats.auteurs],
              ["Thèmes",      stats.themes],
              ["Livres",      stats.livres],
              ["Exemplaires", stats.exemplaires],
              ["Personnes",   stats.personnes],
              ["Adhérents",   stats.adherents],
              ["Enseignants", stats.enseignants],
              ["Emprunts",    stats.emprunts],
              ["Suggestions", stats.suggestions],
            ].map(([label, s]) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={label}>
                <StatCard
                  label={label}
                  value={s?.total ?? 0}
                  sub={s?.par_source
                    ? Object.entries(s.par_source).map(([k, v]) => `${k}:${v}`).join(" • ")
                    : null}
                />
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: "uppercase", letterSpacing: 1 }}>
            Indicateurs clés
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <StatCard label="Exemplaires disponibles" value={stats.exemplaires_dispo?.total ?? 0} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StatCard label="Emprunts en cours" value={stats.emprunts_en_cours?.total ?? 0} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}