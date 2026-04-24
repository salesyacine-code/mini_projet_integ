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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Stack,
  CircularProgress,
  ListSubheader,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const COLS = [
  { key:"emprunt_id",         label:"ID",            width:60  },
  { key:"exemplaire_id",      label:"Exemplaire",    width:100 },
  { key:"personne_id",        label:"Adhérent",      width:100 },
  { key:"date_emprunt",       label:"Date emprunt",  width:110 },
  { key:"date_retour_prevue", label:"Retour prévu",  width:110 },
  { key:"statut",             label:"Statut",        width:90  },
  { key:"_source",            label:"Source",        width:70  },
];

const EMPTY_NEW = { exemplaire_id:"", adherent_id:"", date_emprunt:"", date_retour_prevue:"", statut:"en cours" };
const STATUTS   = ["en cours","rendu","retard"];

export default function EmpruntsPage() {
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [source,     setSource]     = useState(null);
  const [enCours,    setEnCours]    = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const p = new URLSearchParams();
    if (source)  p.set("source", source);
    if (enCours) p.set("en_cours","true");
    const s = p.toString();
    api.emprunts(s ? `?${s}` : "")
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source, enCours]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>

      <PageHeader
        title="Emprunts"
        subtitle="Vue EMPRUNT — S1 (EMPRUNT) · S3 (BORROWED). Absent de S2. Lecture seule."
      />

      {/* Filter */}
      <Box sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={enCours}
              onChange={(e) => setEnCours(e.target.checked)}
              color="primary"
            />
          }
          label={<Typography variant="body2" fontWeight={500}>Emprunts en cours seulement</Typography>}
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