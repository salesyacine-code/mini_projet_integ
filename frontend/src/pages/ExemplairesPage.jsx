import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import Modal, { FormField, FormActions } from "../Layout/Modal";

// MUI
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
} from "@mui/material";

const COLS = [
  { key:"exemplaire_id", label:"ID", width:60 },
  { key:"livre_ref", label:"Livre (ref)", width:150 },
  { key:"code_barre", label:"Code-barres", width:110 },
  { key:"etat", label:"État", width:80 },
  { key:"disponibilite", label:"Disponibilité", width:110 },
  { key:"source", label:"Source", width:70 },
];

const EMPTY = { livre_id:"", code_barre:"", etat:"bon", disponibilite:true };
const ETATS = ["neuf","bon","use","abime"];

export default function ExemplairesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [dispoOnly, setDispoOnly] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

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
    if (row.source !== "S1") return alert("Suppression uniquement sur S1");
    if (!window.confirm(`Supprimer ${row.code_barre} ?`)) return;
    try { await api.deleteExemplaire(row.exemplaire_id); load(); }
    catch(e) { alert(e.message); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.createExemplaire({
        ...form,
        disponibilite: form.disponibilite === true || form.disponibilite === "true",
      });
      setModal(null); load();
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const F = (key) => ({
    value: form[key] ?? "",
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Box p={3} position="relative">
      
      {/* Title */}
      <Typography variant="h5" gutterBottom>
        Exemplaires
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Vue globale EXEMPLAIRE — S1 · S2 (stocks[]) · S3 (Copy). Création uniquement sur S1.
      </Typography>

      {/* Filter */}
      <Box mb={2}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dispoOnly}
              onChange={(e) => setDispoOnly(e.target.checked)}
            />
          }
          label="Disponibles seulement"
        />
      </Box>

      {/* Table */}
      <DataTable
        columns={COLS}
        data={rows}
        actions={(row) => (
          row.source === "S1" && (
            <button onClick={() => handleDelete(row)}>
              Supprimer
            </button>
          )
        )}
        onSourceFilterChange={setSource}
      />

      {/* Modal */}
      {modal === "add" && (
        <Modal
          isOpen={true}
          title="Nouvel exemplaire (S1)"
          onClose={() => setModal(null)}
        >
          <FormField label="ID du livre (S1) *">
            <TextField fullWidth size="small" {...F("livre_id")} />
          </FormField>

          <FormField label="Code-barres *">
            <TextField fullWidth size="small" {...F("code_barre")} />
          </FormField>

          <FormField label="État">
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
          </FormField>

          <FormField label="Disponibilité">
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
          </FormField>

          <FormActions
            onCancel={() => setModal(null)}
            onSubmit={handleSave}
            loading={saving}
            submitLabel="Créer"
          />
        </Modal>
      )}
    </Box>
  );
}