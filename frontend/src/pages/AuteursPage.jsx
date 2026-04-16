import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, CircularProgress, IconButton, Stack
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
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const p = source ? `?source=${source}` : "";
    api.auteurs(p)
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (row) => {
    setForm({
      nom: row.nom || "", prenom: row.prenom || "",
      nationalite: row.nationalite || "", date_naissance: row.date_naissance || "",
    });
    setEditId(row.auteur_id);
    setOpen(true);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Supprimer ${row.nom} ${row.prenom} ?`)) return;
    try { await api.deleteAuteur(row.auteur_id); load(); }
    catch (e) { alert(e.message); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) await api.updateAuteur(editId, form);
      else        await api.createAuteur(form);
      setOpen(false); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const field = (key, label, type = "text", extra = {}) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      type={type}
      value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      InputLabelProps={type === "date" ? { shrink: true } : undefined}
      {...extra}
    />
  );

  return (
    <Box className="px-7 py-6 relative">
      <Typography variant="h5" className="font-medium mb-1">Auteurs</Typography>
      <Typography variant="body2" className="text-gray-500 mb-5">
        Vue globale AUTEUR — S1 (AUTEUR) · S2 (contributeurs[role=auteur]) · S3 (Writer)
      </Typography>

      <DataTable
        columns={COLS} rows={rows} loading={loading} error={error}
        onEdit={r  => r.source === "S1" ? openEdit(r)    : alert("Édition uniquement sur S1")}
        onDelete={r => r.source === "S1" ? handleDelete(r) : alert("Suppression uniquement sur S1")}
        onAdd={openAdd} addLabel="Nouvel auteur"
        sourceFilter={source} onSourceFilter={setSource}
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="flex items-center justify-between pr-3">
          <Typography variant="subtitle1" className="font-medium">
            {editId ? "Modifier l'auteur" : "Nouvel auteur"}
          </Typography>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2} className="pt-1">
            {field("nom",            "Nom *")}
            {field("prenom",         "Prénom")}
            {field("nationalite",    "Nationalité")}
            {field("date_naissance", "Date de naissance", "date")}
          </Stack>
        </DialogContent>

        <DialogActions className="px-6 py-3">
          <Button variant="text" onClick={() => setOpen(false)} className="text-gray-500 normal-case">
            Annuler
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSave}
            disabled={saving}
            className="normal-case"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {editId ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}