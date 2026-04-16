import { useState, useEffect } from "react";
import { api } from "../Api";
import {
  Box, Typography, Grid, Paper, Chip, CircularProgress, Divider
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

function StatCard({ label, value, sub }) {
  return (
    <Paper elevation={0} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <Typography variant="caption" className="text-gray-500 uppercase tracking-wide block mb-1">
        {label}
      </Typography>
      <Typography variant="h5" className="font-medium text-gray-900 dark:text-white">
        {value ?? "—"}
      </Typography>
      {sub && (
        <Typography variant="caption" className="text-gray-400 mt-1 block">
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

function HealthBadge({ label, status }) {
  const ok = status === "OK";
  return (
    <Box className="flex items-center gap-2">
      {ok
        ? <CheckCircleIcon fontSize="small" className="text-green-600" />
        : <ErrorIcon fontSize="small" className="text-red-500" />
      }
      <Typography variant="body2" className="text-gray-600 dark:text-gray-300">{label}</Typography>
      <Chip
        label={ok ? "Connecté" : "Erreur"}
        size="small"
        className={ok
          ? "bg-green-100 text-green-800 font-medium"
          : "bg-red-100 text-red-700 font-medium"
        }
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
    <Box className="flex items-center gap-3 p-8 text-gray-400">
      <CircularProgress size={20} />
      <Typography variant="body2">Chargement...</Typography>
    </Box>
  );

  return (
    <Box className="px-7 py-6">
      <Typography variant="h5" className="font-medium mb-1">Vue d'ensemble</Typography>
      <Typography variant="body2" className="text-gray-500 mb-6">
        Médiateur de données — schéma global intégré (3 sources)
      </Typography>

      {/* Health */}
      {health && (
        <Paper elevation={0} className="flex flex-wrap gap-6 px-5 py-4 mb-6 rounded-xl border border-gray-200 dark:border-gray-700">
          {[
            ["S1 MySQL",   health.s1_mysql],
            ["S2 MongoDB", health.s2_mongodb],
            ["S3 Neo4j",   health.s3_neo4j],
          ].map(([label, status]) => (
            <HealthBadge key={label} label={label} status={status} />
          ))}
        </Paper>
      )}

      {/* Stats */}
      {stats && (
        <>
          <Typography variant="overline" className="text-gray-400 tracking-widest mb-3 block">
            Entités globales
          </Typography>
          <Grid container spacing={1.5} className="mb-6">
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
              <Grid item xs={6} sm={4} md={3} lg={2} key={label}>
                <StatCard
                  label={label}
                  value={s?.total ?? 0}
                  sub={s?.par_source
                    ? Object.entries(s.par_source).map(([k, v]) => `${k}:${v}`).join("  ")
                    : null}
                />
              </Grid>
            ))}
          </Grid>

          <Divider className="mb-4" />

          <Typography variant="overline" className="text-gray-400 tracking-widest mb-3 block">
            Indicateurs clés
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={4}>
              <StatCard label="Exemplaires disponibles" value={stats.exemplaires_dispo?.total ?? 0} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <StatCard label="Emprunts en cours" value={stats.emprunts_en_cours?.total ?? 0} />
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}