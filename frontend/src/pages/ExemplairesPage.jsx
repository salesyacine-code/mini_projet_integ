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
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [destSource, setDestSource] = useState("S1");

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

  const handleDelete = async (row) => {
    if (!window.confirm(`Supprimer ${row.code_barre} ?`)) return;
    try { await api.deleteExemplaire(row.exemplaire_id, row._source); load(); }
    catch(e) { alert(e.message); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.createExemplaire({
        ...form,
        disponibilite: form.disponibilite === true || form.disponibilite === "true",
      }, destSource);
      setOpenAdd(false); load();
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const fieldProps = (key) => ({
    value: form[key] ?? "",
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      
      <PageHeader 
        title="Exemplaires" 
        subtitle="Vue globale EXEMPLAIRE — S1 · S2 (stocks[]) · S3 (Copy). Création uniquement sur S1." 
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
        onDelete={handleDelete}
        onAdd={() => { setForm(EMPTY); setOpenAdd(true); }}
        addLabel="Nouvel exemplaire"
        sourceFilter={source}
        onSourceFilter={setSource}
      />

      {/* Dialog */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="flex items-center justify-between pr-3">
          <Typography variant="subtitle1" fontWeight={600}>
            Nouvel exemplaire
          </Typography>
          <IconButton size="small" onClick={() => setOpenAdd(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
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
            <TextField label="Référence du livre (ID ou ISBN) *" fullWidth size="small" {...fieldProps("livre_ref")} />
            <TextField label="Code-barres *" fullWidth size="small" {...fieldProps("code_barre")} />
            
            <Select
              fullWidth
              size="small"
              value={form.etat}
              onChange={(e) => setForm(f => ({ ...f, etat: e.target.value }))}
            >
              {ETATS.map(e => (
                <MenuItem key={e} value={e}>{e}</MenuItem>
              ))}
            </Select>

            <Select
              fullWidth
              size="small"
              value={String(form.disponibilite)}
              onChange={(e) =>
                setForm(f => ({
                  ...f,
                  disponibilite: e.target.value === "true",
                }))
              }
            >
              <MenuItem value="true">Disponible</MenuItem>
              <MenuItem value="false">Emprunté</MenuItem>
            </Select>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenAdd(false)} color="inherit" sx={{ textTransform: "none" }}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disableElevation
            disabled={saving}
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