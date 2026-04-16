import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, CircularProgress, IconButton, Stack, InputAdornment
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

const EMPTY = { titre: "", isbn: "", annee_publication: "", auteur_id: "", categorie: "" };

export default function LivresPage() {
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [source, setSource]         = useState(null);
  const [themeFilter, setThemeFilter] = useState("");
  const [titreFilter, setTitreFilter] = useState("");
  const [open, setOpen]             = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [editId, setEditId]         = useState(null);
  const [saving, setSaving]         = useState(false);

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

  const openAdd = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (row) => {
    setForm({
      titre: row.titre || "", isbn: row.isbn || "",
      annee_publication: row.annee_publication || "",
      auteur_id: row.auteur_id || "", categorie: (row.themes || [])[0] || "",
    });
    setEditId(row.livre_id);
    setOpen(true);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Supprimer "${row.titre}" ?`)) return;
    try { await api.deleteLivre(row.livre_id); load(); }
    catch (e) { alert(e.message); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) await api.updateLivre(editId, form);
      else        await api.createLivre(form);
      setOpen(false); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const field = (key, label, type = "text", extra = {}) => (
    <TextField
      fullWidth size="small" label={label} type={type}
      value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      InputLabelProps={type === "date" ? { shrink: true } : undefined}
      {...extra}
    />
  );

  return (
    <Box className="px-7 py-6 relative">
      <Typography variant="h5" className="font-medium mb-1">Livres</Typography>
      <Typography variant="body2" className="text-gray-500 mb-4">
        Vue globale LIVRE — S1 (LIVRE) · S2 (ouvrages) · S3 (Book). Dédupliqués par ISBN.
      </Typography>

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
        onEdit={r   => r.source === "S1" ? openEdit(r)    : alert("Édition uniquement sur S1")}
        onDelete={r => r.source === "S1" ? handleDelete(r) : alert("Suppression uniquement sur S1")}
        onAdd={openAdd} addLabel="Nouveau livre"
        sourceFilter={source} onSourceFilter={setSource}
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="flex items-center justify-between pr-3">
          <Typography variant="subtitle1" className="font-medium">
            {editId ? "Modifier le livre" : "Nouveau livre"}
          </Typography>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2} className="pt-1">
            {field("titre",             "Titre *")}
            {field("isbn",              "ISBN")}
            {field("annee_publication", "Année de publication", "number")}
            {field("auteur_id",         "ID Auteur (S1)")}
            {field("categorie",         "Catégorie / Thème")}
          </Stack>
        </DialogContent>

        <DialogActions className="px-6 py-3">
          <Button variant="text" onClick={() => setOpen(false)} className="text-gray-500 normal-case">
            Annuler
          </Button>
          <Button
            variant="contained" disableElevation onClick={handleSave}
            disabled={saving} className="normal-case"
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {editId ? "Mettre à jour" : "Créer"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}