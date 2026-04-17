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
  const [openDialog, setOpenDialog] = useState(false);
  const [form,       setForm]       = useState(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [destSource, setDestSource] = useState("S1");

  // Dropdown data
  const [enseignants,  setEnseignants]  = useState([]);
  const [livres,       setLivres]       = useState([]);
  const [loadingDeps,  setLoadingDeps]  = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    api.suggestions(source ? `?source=${source}` : "")
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source]);

  useEffect(() => { load(); }, [load]);

  const loadDeps = async () => {
    setLoadingDeps(true);
    try {
      const [ensRes, livRes] = await Promise.all([
        api.enseignants(),
        api.livres(),
      ]);
      setEnseignants(ensRes.data || []);
      setLivres(livRes.data || []);
    } catch(e) {
      console.error("Erreur chargement données:", e);
    } finally {
      setLoadingDeps(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Supprimer cette suggestion ?")) return;
    try {
      await api.deleteSuggestion(row.suggestion_id, row._source);
      load();
    } catch(e) {
      alert(e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.createSuggestion(form, destSource);
      setOpenDialog(false);
      load();
    } catch(e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = (key) => ({
    value: form[key] ?? "",
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>

      <PageHeader
        title="Suggestions"
        subtitle={<>Vue SUGGESTION — S1 · S2 · S3.<br />Note S2 : livre_ref peut être NULL (pas de FK directe).</>}
      />

      {/* Table */}
      <DataTable
        columns={COLS}
        rows={rows}
        loading={loading}
        error={error}
        onDelete={handleDelete}
        onAdd={() => {
          setForm(EMPTY);
          setDestSource("S1");
          setOpenDialog(true);
          loadDeps();
        }}
        addLabel="Nouvelle suggestion"
        sourceFilter={source}
        onSourceFilter={setSource}
      />

      {/* Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", pr:1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Nouvelle suggestion
          </Typography>
          <IconButton size="small" onClick={() => setOpenDialog(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>

            {/* Source selector */}
            <FormControl fullWidth size="small">
              <InputLabel>Source de destination</InputLabel>
              <Select
                value={destSource}
                label="Source de destination"
                onChange={(e) => setDestSource(e.target.value)}
              >
                <MenuItem value="S1">S1 (MySQL)</MenuItem>
                <MenuItem value="S2">S2 (MongoDB)</MenuItem>
                <MenuItem value="S3">S3 (Neo4j)</MenuItem>
              </Select>
            </FormControl>

            {/* Enseignant selector */}
            <FormControl fullWidth size="small">
              <InputLabel>Enseignant *</InputLabel>
              <Select
                value={form.enseignant_id}
                label="Enseignant *"
                onChange={(e) => setForm(f => ({ ...f, enseignant_id: e.target.value }))}
                disabled={loadingDeps}
                renderValue={(val) => {
                  const ens = enseignants.find(e => String(e.personne_id) === String(val));
                  return ens ? `${ens.nom} ${ens.prenom} — ${ens.departement || "?"} (${ens._source})` : val;
                }}
              >
                {loadingDeps
                  ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Chargement...</MenuItem>
                  : enseignants.map(ens => (
                      <MenuItem key={ens.personne_id} value={String(ens.personne_id)}>
                        <Box sx={{ display:"flex", alignItems:"center", gap:1, width:"100%" }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {ens.nom} {ens.prenom}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {ens.departement || ens.email || "—"}
                            </Typography>
                          </Box>
                          <Chip label={ens._source} size="small" sx={{ fontSize:"10px" }} />
                        </Box>
                      </MenuItem>
                    ))
                }
              </Select>
            </FormControl>

            {/* Livre selector */}
            <FormControl fullWidth size="small">
              <InputLabel>Livre *</InputLabel>
              <Select
                value={form.livre_id}
                label="Livre *"
                onChange={(e) => setForm(f => ({ ...f, livre_id: e.target.value }))}
                disabled={loadingDeps}
                renderValue={(val) => {
                  const liv = livres.find(l => String(l.livre_id || l.isbn) === String(val));
                  return liv ? `${liv.titre} (${liv._source})` : val;
                }}
              >
                {loadingDeps
                  ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Chargement...</MenuItem>
                  : livres.map(liv => (
                      <MenuItem key={liv.livre_id || liv.isbn} value={String(liv.livre_id || liv.isbn)}>
                        <Box sx={{ display:"flex", alignItems:"center", gap:1, width:"100%" }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {liv.titre}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ISBN : {liv.isbn || "—"} · {liv.annee_publication || ""}
                            </Typography>
                          </Box>
                          <Chip label={liv._source} size="small" sx={{ fontSize:"10px" }} />
                        </Box>
                      </MenuItem>
                    ))
                }
              </Select>
            </FormControl>

            {/* Date */}
            <TextField
              label="Date de suggestion"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              {...fieldProps("date_suggestion")}
            />

            {/* Raison */}
            <TextField
              label="Raison"
              fullWidth
              multiline
              rows={3}
              placeholder="Justification de la suggestion..."
              {...fieldProps("raison")}
            />

          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDialog(false)} color="inherit" sx={{ textTransform: "none" }}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disableElevation
            disabled={saving || loadingDeps}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: "none" }}
          >
            Créer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}