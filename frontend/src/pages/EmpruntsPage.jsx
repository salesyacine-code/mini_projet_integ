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

  const [openDialog, setOpenDialog] = useState(false);
  const [form,       setForm]       = useState(EMPTY_NEW);
  const [editId,     setEditId]     = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [destSource, setDestSource] = useState("S1");

  // Data for dropdowns
  const [exemplaires, setExemplaires] = useState([]);
  const [adherents,   setAdherents]   = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);

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

  // Load dropdown data when dialog opens for creation
  const loadDeps = async () => {
    setLoadingDeps(true);
    try {
      const [exRes, adRes] = await Promise.all([
        api.exemplaires(),
        api.adherents(),
      ]);
      setExemplaires(exRes.data || []);
      setAdherents(adRes.data || []);
    } catch(e) {
      console.error("Erreur chargement données:", e);
    } finally {
      setLoadingDeps(false);
    }
  };

  const openAdd = () => {
    setForm(EMPTY_NEW);
    setEditId(null);
    setDestSource("S1");
    setOpenDialog(true);
    loadDeps();
  };

  const openEdit = (row) => {
    setForm({
      statut: row.statut || "rendu",
      date_retour_prevue: row.date_retour_prevue || ""
    });
    setDestSource(row._source || "S1");
    setEditId(row.emprunt_id);
    setOpenDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) {
        await api.updateEmprunt(editId, form, destSource);
      } else {
        await api.createEmprunt(form, destSource);
      }
      setOpenDialog(false);
      load();
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
        title="Emprunts"
        subtitle="Vue EMPRUNT — S1 (EMPRUNT) · S3 (BORROWED). Absent de S2."
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
        onEdit={openEdit}
        onAdd={openAdd}
        addLabel="Nouvel emprunt"
        sourceFilter={source}
        onSourceFilter={setSource}
      />

      {/* Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", pr:1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {editId ? "Modifier l'emprunt" : "Nouvel emprunt"}
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
                disabled={!!editId}
              >
                <MenuItem value="S1">S1 (MySQL)</MenuItem>
                <MenuItem value="S2">S2 (MongoDB)</MenuItem>
                <MenuItem value="S3">S3 (Neo4j)</MenuItem>
              </Select>
            </FormControl>

            {/* Creation-only fields */}
            {!editId && (
              <>
                {/* Exemplaire selector */}
                <FormControl fullWidth size="small">
                  <InputLabel>Exemplaire *</InputLabel>
                  <Select
                    value={form.exemplaire_id}
                    label="Exemplaire *"
                    onChange={(e) => setForm(f => ({ ...f, exemplaire_id: e.target.value }))}
                    disabled={loadingDeps}
                    renderValue={(val) => {
                      const ex = exemplaires.find(e => String(e.exemplaire_id) === String(val));
                      return ex
                        ? `#${ex.exemplaire_id} — ${ex.code_barre || ex.livre_ref || "?"} (${ex._source})`
                        : val;
                    }}
                  >
                    {loadingDeps
                      ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Chargement...</MenuItem>
                      : exemplaires.map(ex => (
                          <MenuItem key={ex.exemplaire_id} value={String(ex.exemplaire_id)}>
                            <Box sx={{ display:"flex", alignItems:"center", gap:1, width:"100%" }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={500}>
                                  {ex.code_barre || ex.livre_ref || `ID ${ex.exemplaire_id}`}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  État : {ex.etat} · {ex.disponibilite ? "✅ Disponible" : "❌ Emprunté"}
                                </Typography>
                              </Box>
                              <Chip label={ex._source} size="small" sx={{ fontSize:"10px" }} />
                            </Box>
                          </MenuItem>
                        ))
                    }
                  </Select>
                </FormControl>

                {/* Adhérent selector */}
                <FormControl fullWidth size="small">
                  <InputLabel>Adhérent *</InputLabel>
                  <Select
                    value={form.adherent_id}
                    label="Adhérent *"
                    onChange={(e) => setForm(f => ({ ...f, adherent_id: e.target.value }))}
                    disabled={loadingDeps}
                    renderValue={(val) => {
                      const ad = adherents.find(a => String(a.personne_id) === String(val));
                      return ad ? `${ad.nom} ${ad.prenom} (${ad._source})` : val;
                    }}
                  >
                    {loadingDeps
                      ? <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Chargement...</MenuItem>
                      : adherents.map(ad => (
                          <MenuItem key={ad.personne_id} value={String(ad.personne_id)}>
                            <Box sx={{ display:"flex", alignItems:"center", gap:1, width:"100%" }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={500}>
                                  {ad.nom} {ad.prenom}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {ad.email || "—"}
                                </Typography>
                              </Box>
                              <Chip label={ad._source} size="small" sx={{ fontSize:"10px" }} />
                            </Box>
                          </MenuItem>
                        ))
                    }
                  </Select>
                </FormControl>

                {/* Date emprunt */}
                <TextField
                  label="Date d'emprunt *"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  {...fieldProps("date_emprunt")}
                />
              </>
            )}

            {/* Date retour */}
            <TextField
              label="Date de retour prévue"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              {...fieldProps("date_retour_prevue")}
            />

            {/* Statut */}
            <FormControl fullWidth size="small">
              <InputLabel>Statut</InputLabel>
              <Select
                value={form.statut}
                label="Statut"
                onChange={(e) => setForm(f => ({ ...f, statut: e.target.value }))}
              >
                {STATUTS.map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>

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
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: "none" }}
          >
            {editId ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}