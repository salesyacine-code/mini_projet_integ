import { useState, useEffect } from "react";
import { api } from "../Api";
import {
  Box, Typography, Button, Paper, Chip, CircularProgress, Grid
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

const SOURCES = (health) => [
  {
    name: "S1 — MySQL", key: "s1_mysql", status: health.s1_mysql,
    desc: "Base relationnelle. Tables: AUTEUR, LIVRE, EXEMPLAIRE, ADHERENT, ENSEIGNANT, EMPRUNT, SUGGESTION.",
    color: "#534AB7", lightBg: "#EEEDFE", textColor: "#3C3489",
  },
  {
    name: "S2 — MongoDB", key: "s2_mongodb", status: health.s2_mongodb,
    desc: "Base documentaire. Collections: ouvrages (stocks[], contributeurs[]), adherant (suggestions[]).",
    color: "#0F6E56", lightBg: "#E1F5EE", textColor: "#085041",
  },
  {
    name: "S3 — Neo4j", key: "s3_neo4j", status: health.s3_neo4j,
    desc: "Graphe de propriétés. Nœuds: Book, Writer, Copy, Theme, Member, Professor. Relations: WROTE, HAS_COPY, BELONGS_TO, BORROWED, RECOMMENDS.",
    color: "#993C1D", lightBg: "#FAECE7", textColor: "#712B13",
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
    <Box className="px-7 py-6">
      <Box className="flex items-center gap-3 mb-1">
        <Typography variant="h5" className="font-medium">État des sources</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon fontSize="small" />}
          onClick={load}
          className="text-gray-500 border-gray-300 normal-case text-xs"
        >
          Rafraîchir
        </Button>
      </Box>
      <Typography variant="body2" className="text-gray-500 mb-6">
        Connectivité des 3 sources hétérogènes du médiateur.
      </Typography>

      {loading ? (
        <Box className="flex items-center gap-2 text-gray-400">
          <CircularProgress size={16} />
          <Typography variant="body2">Vérification...</Typography>
        </Box>
      ) : (
        <Grid container spacing={1.5}>
          {sources.map((s) => {
            const ok = s.status === "OK";
            return (
              <Grid item xs={12} sm={6} md={4} key={s.key}>
                <Paper
                  elevation={0}
                  className="rounded-xl p-5 h-full"
                  sx={{
                    border: ok
                      ? `0.5px solid ${s.color}44`
                      : "0.5px solid #F09595",
                  }}
                >
                  <Box className="flex items-center gap-2 mb-3">
                    <FiberManualRecordIcon
                      sx={{ fontSize: 10, color: ok ? s.color : "#E24B4A" }}
                    />
                    <Typography variant="subtitle2" className="font-medium flex-1">
                      {s.name}
                    </Typography>
                    <Chip
                      label={ok ? "Connecté" : "Erreur"}
                      size="small"
                      sx={{
                        fontSize: 11,
                        fontWeight: 500,
                        backgroundColor: ok ? s.lightBg : "#FCEBEB",
                        color: ok ? s.textColor : "#791F1F",
                      }}
                    />
                  </Box>
                  <Typography variant="caption" className="text-gray-500 leading-relaxed block">
                    {s.desc}
                  </Typography>
                  {!ok && (
                    <Box className="mt-3 rounded-md px-2 py-1.5 bg-red-50 border border-red-200">
                      <Typography variant="caption" className="text-red-700">
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