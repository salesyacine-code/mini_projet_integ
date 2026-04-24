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
  CircularProgress
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const COLS_ADH = [
  { key:"personne_id", label:"ID", width:80 },
  { key:"nom", label:"Nom", width:100 },
  { key:"prenom", label:"Prénom", width:100 },
  { key:"email", label:"Email", width:170 },
  { key:"telephone", label:"Tél.", width:110 },
  { key:"date_inscription", label:"Inscription", width:105 },
  { key:"cursus", label:"Cursus", width:100 },
  { key:"source", label:"Source", width:70 },
];

const COLS_ENS = [
  { key:"personne_id", label:"ID", width:80 },
  { key:"nom", label:"Nom", width:110 },
  { key:"prenom", label:"Prénom", width:110 },
  { key:"email", label:"Email", width:170 },
  { key:"departement", label:"Département", width:140 },
  { key:"source", label:"Source", width:70 },
];

const EMPTY_ADH = { nom:"", prenom:"", email:"", telephone:"", date_inscription:"", cursus:"", annee:"" };
const EMPTY_ENS = { nom:"", prenom:"", departement:"", email:"" };

export default function PersonnesPage({ subtype }) {
  const isAdh = subtype === "adherents";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  const fetchFn = isAdh ? api.adherents : api.enseignants;

  const load = useCallback(() => {
    setLoading(true); setError(null);
    fetchFn(source ? `?source=${source}` : "")
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source, subtype]);

  useEffect(() => {
    setRows([]);
    setSource(null);
  }, [subtype]);

  useEffect(() => { load(); }, [load]);

  const title = isAdh ? "Adhérents" : "Enseignants";
  const sub = isAdh
    ? "Sous-type ISA ADHERENT — S1 · S2 · S3. Lecture seule."
    : "Sous-type ISA ENSEIGNANT — S1 · S2 · S3. Lecture seule.";

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      
      <PageHeader 
        title={title} 
        subtitle={sub} 
      />

      {/* Table */}
      <DataTable
        columns={isAdh ? COLS_ADH : COLS_ENS}
        rows={rows}
        loading={loading}
        error={error}
        sourceFilter={source}
        onSourceFilter={setSource}
      />
    </Box>
  );
}