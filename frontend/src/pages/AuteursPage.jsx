import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import PageHeader from "../Layout/PageHeader";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, CircularProgress, IconButton, Stack, Select, MenuItem, InputLabel, FormControl
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const COLS = [
  { key: "auteur_id",      label: "ID",           width: 60 },
  { key: "nom",            label: "Nom",           width: 120 },
  { key: "prenom",         label: "Prénom",        width: 120 },
  { key: "nationalite",    label: "Nationalité",   width: 120 },
  { key: "date_naissance", label: "Naissance",     width: 110 },
  { key: "source",         label: "Source",        width: 80 },
];

const EMPTY = { nom: "", prenom: "", nationalite: "", date_naissance: "" };

export default function AuteursPage() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [source, setSource]   = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const p = source ? `?source=${source}` : "";
    api.auteurs(p)
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      <PageHeader 
        title="Auteurs" 
        subtitle="Vue globale AUTEUR — S1 (AUTEUR) · S2 (contributeurs[role=auteur]) · S3 (Writer). Lecture seule." 
      />

      <DataTable
        columns={COLS} rows={rows} loading={loading} error={error}
        sourceFilter={source} onSourceFilter={setSource}
      />
    </Box>
  );
}