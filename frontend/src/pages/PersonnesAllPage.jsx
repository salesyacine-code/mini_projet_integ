import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";

// MUI
import {
  Box,
  Typography,
  Button,
  Chip,
  Stack,
  Paper
} from "@mui/material";

const COLS = [
  { key:"personne_id", label:"ID", width:90 },
  { key:"nom", label:"Nom", width:120 },
  { key:"prenom", label:"Prénom", width:120 },
  { key:"email", label:"Email", width:190 },
  { key:"type", label:"Type", width:100 },
  { key:"source", label:"Source", width:75 },
];

export default function PersonnesAllPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const p = new URLSearchParams();
    if (source) p.set("source", source);
    if (typeFilter) p.set("type", typeFilter);

    const s = p.toString();
    api.personnes(s ? `?${s}` : "")
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const countByType = rows.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <Box p={3}>
      {/* Title */}
      <Typography variant="h5" gutterBottom>
        Personnes
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Super-entité ISA <strong>PERSONNE</strong> — fusion de toutes les personnes des 3 sources.
        <br />
        S1 (ADHERENT + ENSEIGNANT) · S2 (collection adherant, champ type) · S3 (Member + Professor)
      </Typography>

      {/* Filters */}
      <Stack direction="row" spacing={1} mb={3}>
        {[
          { label:"Tous", value:null, count:rows.length },
          { label:"Adhérents", value:"Adherent", count:countByType["Adherent"] || 0 },
          { label:"Enseignants", value:"Enseignant", count:countByType["Enseignant"] || 0 },
        ].map(t => (
          <Button
            key={t.label}
            variant={typeFilter === t.value ? "contained" : "outlined"}
            onClick={() => setTypeFilter(t.value)}
            sx={{ borderRadius: 2 }}
          >
            {t.label}
            <Chip
              label={t.count}
              size="small"
              sx={{ ml: 1 }}
            />
          </Button>
        ))}
      </Stack>

      {/* Table container */}
      <Paper elevation={2} sx={{ p: 2 }}>
        <DataTable
          columns={COLS}
          rows={rows}
          loading={loading}
          error={error}
          sourceFilter={source}
          onSourceFilter={setSource}
        />
      </Paper>
    </Box>
  );
}