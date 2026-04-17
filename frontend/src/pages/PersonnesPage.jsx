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
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState(isAdh ? EMPTY_ADH : EMPTY_ENS);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [destSource, setDestSource] = useState("S1");

  const fetchFn = isAdh ? api.adherents : api.enseignants;
  const createFn = isAdh ? api.createAdherent : api.createEnseignant;
  const updateFn = isAdh ? api.updateAdherent : api.updateEnseignant;
  const deleteFn = isAdh ? api.deleteAdherent : api.deleteEnseignant;

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

  const openAdd = () => {
    setForm(isAdh ? EMPTY_ADH : EMPTY_ENS);
    setEditId(null);
    setOpenDialog(true);
  };

  const openEdit = (row) => {
    if (isAdh) {
      setForm({
        nom: row.nom || "",
        prenom: row.prenom || "",
        email: row.email || "",
        telephone: row.telephone || "",
        date_inscription: row.date_inscription || "",
        cursus: row.cursus || "",
        annee: row.annee || "",
      });
    } else {
      setForm({
        nom: row.nom || "",
        prenom: row.prenom || "",
        departement: row.departement || "",
        email: row.email || "",
      });
    }
    setDestSource(row._source || "S1");
    setEditId(row.personne_id);
    setOpenDialog(true);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Supprimer ${row.nom} ${row.prenom} ?`)) return;
    try {
      await deleteFn(row.personne_id, row._source);
      load();
    } catch(e) {
      alert(e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) await updateFn(editId, form, destSource);
      else await createFn(form, destSource);
      setOpenDialog(false);
      load();
    } catch(e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = (key) => ({
    value: form[key] || "",
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const title = isAdh ? "Adhérents" : "Enseignants";
  const sub = isAdh
    ? "Sous-type ISA ADHERENT — S1 · S2 · S3"
    : "Sous-type ISA ENSEIGNANT — S1 · S2 · S3";

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
        onEdit={openEdit}
        onDelete={handleDelete}
        onAdd={openAdd}
        addLabel={isAdh ? "Nouvel adhérent" : "Nouvel enseignant"}
        sourceFilter={source}
        onSourceFilter={setSource}
      />

      {/* Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="flex items-center justify-between pr-3">
          <Typography variant="subtitle1" fontWeight={600}>
            {editId ? "Modifier" : (isAdh ? "Nouvel adhérent" : "Nouvel enseignant")}
          </Typography>
          <IconButton size="small" onClick={() => setOpenDialog(false)}>
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
                disabled={!!editId}
              >
                <MenuItem value="S1">S1 (MySQL)</MenuItem>
                <MenuItem value="S2">S2 (MongoDB)</MenuItem>
                <MenuItem value="S3">S3 (Neo4j)</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Nom *" fullWidth size="small" {...fieldProps("nom")} />
            <TextField label="Prénom" fullWidth size="small" {...fieldProps("prenom")} />
            <TextField label="Email" type="email" fullWidth size="small" {...fieldProps("email")} />

            {isAdh ? (
              <>
                <TextField label="Téléphone" fullWidth size="small" {...fieldProps("telephone")} />
                <TextField label="Date d'inscription" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} {...fieldProps("date_inscription")} />
                <TextField label="Cursus" fullWidth size="small" {...fieldProps("cursus")} />
                <TextField label="Année" type="number" fullWidth size="small" {...fieldProps("annee")} />
              </>
            ) : (
              <TextField label="Département" fullWidth size="small" {...fieldProps("departement")} />
            )}
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