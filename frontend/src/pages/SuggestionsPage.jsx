import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import PageHeader from "../Layout/PageHeader";

// MUI
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Stack,
  CircularProgress,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const COLS = [
  { key:"suggestion_id",  label:"ID",          width:60  },
  { key:"personne_id",    label:"Enseignant",  width:110 },
  { key:"livre_ref",      label:"Livre (ref)", width:150 },
  { key:"date_suggestion",label:"Date",        width:110 },
  { key:"raison",         label:"Raison",      width:240 },
  { key:"_source",        label:"Source",      width:70  },
];

const EMPTY = {
  enseignant_id:"",
  livre_id:"",
  date_suggestion:"",
  raison:""
};

export default function SuggestionsPage() {
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [source,     setSource]     = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    api.suggestions(source ? `?source=${source}` : "")
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>

      <PageHeader
        title="Suggestions"
        subtitle={<>Vue SUGGESTION — S1 · S2 · S3. Lecture seule.<br />Note S2 : livre_ref peut être NULL (pas de FK directe).</>}
      />

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