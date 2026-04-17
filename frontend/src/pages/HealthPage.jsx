import { useState, useEffect } from "react";
import { api } from "../Api";
import PageHeader from "../Layout/PageHeader";
import {
  Box, Typography, Button, Paper, Chip, CircularProgress, Grid, Stack
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

const SOURCES = (health) => [
  {
    name: "S1 — MySQL", key: "s1_mysql", status: health.s1_mysql,
    desc: "Base relationnelle. Tables: AUTEUR, LIVRE, EXEMPLAIRE, ADHERENT, ENSEIGNANT, EMPRUNT, SUGGESTION.",
    color: "#2563eb", lightBg: "#eff6ff", textColor: "#1d4ed8",
  },
  {
    name: "S2 — MongoDB", key: "s2_mongodb", status: health.s2_mongodb,
    desc: "Base documentaire. Collections: ouvrages (stocks[], contributeurs[]), adherant (suggestions[]).",
    color: "#059669", lightBg: "#ecfdf5", textColor: "#047857",
  },
  {
    name: "S3 — Neo4j", key: "s3_neo4j", status: health.s3_neo4j,
    desc: "Graphe de propriétés. Nœuds: Book, Writer, Copy, Theme, Member, Professor. Relations: WROTE, HAS_COPY, BELONGS_TO, BORROWED, RECOMMENDS.",
    color: "#ea580c", lightBg: "#fff7ed", textColor: "#c2410c",
  },
];

export default function HealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.health()
      .then(setHealth)
      .catch(() => setHealth({ s1_mysql: "ERROR", s2_mongodb: "ERROR", s3_neo4j: "ERROR" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const sources = health ? SOURCES(health) : [];

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <PageHeader 
          title="État des sources" 
          subtitle="Connectivité des 3 sources hétérogènes du médiateur." 
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon fontSize="small" />}
          onClick={load}
          sx={{ textTransform: "none", borderRadius: 2 }}
        >
          Rafraîchir
        </Button>
      </Stack>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={2} color="text.secondary">
          <CircularProgress size={20} color="inherit" />
          <Typography variant="body2">Vérification de la connectivité...</Typography>
        </Stack>
      ) : (
        <Grid container spacing={3}>
          {sources.map((s) => {
            const ok = s.status === "OK";
            return (
              <Grid item xs={12} sm={6} md={4} key={s.key}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3, 
                    height: '100%',
                    borderRadius: 3,
                    border: ok
                      ? `1px solid ${s.color}44`
                      : "1px solid #fecaca",
                    bgcolor: "white",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
                    }
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                    <FiberManualRecordIcon
                      sx={{ fontSize: 12, color: ok ? s.color : "#ef4444" }}
                    />
                    <Typography variant="subtitle1" fontWeight={600} flex={1}>
                      {s.name}
                    </Typography>
                    <Chip
                      label={ok ? "Connecté" : "Erreur"}
                      size="small"
                      sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: ok ? s.lightBg : "#fee2e2",
                        color: ok ? s.textColor : "#b91c1c",
                        border: 'none'
                      }}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {s.desc}
                  </Typography>
                  {!ok && (
                    <Box mt={3} p={1.5} borderRadius={2} bgcolor="#fef2f2" border="1px solid #fecaca">
                      <Typography variant="caption" color="#b91c1c" fontWeight={500} fontFamily="monospace">
                        {s.status}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}