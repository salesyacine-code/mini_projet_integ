import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import PageHeader from "../Layout/PageHeader";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, CircularProgress, IconButton, Stack, InputAdornment,
  Select, MenuItem, InputLabel, FormControl
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";

const COLS = [
  { key: "livre_id",          label: "ID",      width: 55 },
  { key: "isbn",              label: "ISBN",     width: 145 },
  { key: "titre",             label: "Titre",    width: 200 },
  { key: "annee_publication", label: "Année",    width: 65 },
  { key: "editeur",           label: "Éditeur",  width: 110 },
  { key: "nb_pages",          label: "Pages",    width: 65 },
  { key: "themes",            label: "Thèmes",   width: 150 },
  { key: "source",            label: "Source",   width: 70 },
];

const EMPTY = { titre: "", isbn: "", annee_publication: "", nb_pages: "", editeur: "", auteur_id: "", theme: "" };

export default function LivresPage() {
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [source, setSource]         = useState(null);
  const [themeFilter, setThemeFilter] = useState("");
  const [titreFilter, setTitreFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (source)      params.set("source", source);
    if (themeFilter) params.set("theme", themeFilter);
    if (titreFilter) params.set("titre", titreFilter);
    const p = params.toString() ? "?" + params.toString() : "";
    api.livres(p)
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source, themeFilter, titreFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      <PageHeader 
        title="Livres" 
        subtitle="Vue globale LIVRE — S1 (LIVRE) · S2 (ouvrages) · S3 (Book). Dédupliqués par ISBN. Lecture seule." 
      />

      {/* Filtres */}
      <Box className="flex flex-wrap gap-2 mb-4">
        <TextField
          size="small" placeholder="Filtrer par thème..."
          value={themeFilter}
          onChange={e => setThemeFilter(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" className="text-gray-400" /></InputAdornment>
          }}
          className="w-44"
        />
        <TextField
          size="small" placeholder="Filtrer par titre..."
          value={titreFilter}
          onChange={e => setTitreFilter(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" className="text-gray-400" /></InputAdornment>
          }}
          className="w-44"
        />
        <Button
          variant="outlined" size="small" onClick={load}
          className="normal-case text-gray-500 border-gray-300"
        >
          Appliquer
        </Button>
      </Box>

      <DataTable
        columns={COLS} rows={rows} loading={loading} error={error}
        sourceFilter={source} onSourceFilter={setSource}
      />
    </Box>
  );
}