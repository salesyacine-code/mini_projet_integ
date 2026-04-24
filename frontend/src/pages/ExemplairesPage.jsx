import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import PageHeader from "../Layout/PageHeader";

// MUI
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Stack,
  CircularProgress
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const COLS = [
  { key:"exemplaire_id", label:"ID", width:60 },
  { key:"livre_ref", label:"Livre (ref)", width:150 },
  { key:"code_barre", label:"Code-barres", width:110 },
  { key:"etat", label:"État", width:80 },
  { key:"disponibilite", label:"Disponibilité", width:110 },
  { key:"source", label:"Source", width:70 },
];

const EMPTY = { livre_ref:"", code_barre:"", etat:"bon", disponibilite:true };
const ETATS = ["neuf","bon","use","abime"];

export default function ExemplairesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [dispoOnly, setDispoOnly] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const p = new URLSearchParams();
    if (source) p.set("source", source);
    if (dispoOnly) p.set("disponible","true");

    const s = p.toString();
    api.exemplaires(s ? `?${s}` : "")
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source, dispoOnly]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      
      <PageHeader 
        title="Exemplaires" 
        subtitle="Vue globale EXEMPLAIRE — S1 · S2 (stocks[]) · S3 (Copy). Lecture seule." 
      />

      {/* Filter */}
      <Box sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dispoOnly}
              onChange={(e) => setDispoOnly(e.target.checked)}
              color="primary"
            />
          }
          label={<Typography variant="body2" fontWeight={500}>Disponibles seulement</Typography>}
        />
      </Box>

      {/* Table */}
      <DataTable
        columns={COLS}
        rows={rows}
        loading={loading}
        error={error}
        sourceFilter={source}
        onSourceFilter={setSource}
      />
    </Box>
  );
}