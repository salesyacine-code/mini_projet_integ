import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import Modal, { FormField, FormActions } from "../Layout/Modal";

// MUI
import {
  Box,
  Typography,
  Button,
  TextField,
} from "@mui/material";

const COLS = [
  { key:"suggestion_id", label:"ID", width:60 },
  { key:"personne_id", label:"Enseignant", width:110 },
  { key:"livre_ref", label:"Livre (ref)", width:150 },
  { key:"date_suggestion", label:"Date", width:110 },
  { key:"raison", label:"Raison", width:240 },
  { key:"source", label:"Source", width:70 },
];

const EMPTY = {
  enseignant_id:"",
  livre_id:"",
  date_suggestion:"",
  raison:""
};

export default function SuggestionsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    api.suggestions(source ? `?source=${source}` : "")
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (row) => {
    if (row.source !== "S1") return alert("Suppression uniquement sur S1");
    if (!window.confirm("Supprimer cette suggestion ?")) return;

    try {
      await api.deleteSuggestion(row.suggestion_id);
      load();
    } catch(e) {
      alert(e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.createSuggestion(form);
      setModal(null);
      load();
    } catch(e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const F = (key) => ({
    value: form[key] ?? "",
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Box p={3}>
      
      {/* Title */}
      <Typography variant="h5" gutterBottom>
        Suggestions
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Vue SUGGESTION — S1 · S2 · S3.
        <br />
        Note S2 : livre_ref peut être NULL (pas de FK directe).
      </Typography>

      {/* Add Button */}
      <Button
        variant="contained"
        sx={{ mb: 2 }}
        onClick={() => {
          setForm(EMPTY);
          setModal("add");
        }}
      >
        Nouvelle suggestion
      </Button>

      {/* Table */}
      <DataTable
        columns={COLS}
        data={rows}
        actions={(row) => (
          row.source === "S1" && (
            <Button size="small" color="error" onClick={() => handleDelete(row)}>
              Supprimer
            </Button>
          )
        )}
        onSourceFilterChange={setSource}
      />

      {/* Modal */}
      {modal === "add" && (
        <Modal
          isOpen={true}
          title="Nouvelle suggestion (S1)"
          onClose={() => setModal(null)}
        >
          <FormField label="ID Enseignant (S1) *">
            <TextField fullWidth size="small" {...F("enseignant_id")} />
          </FormField>

          <FormField label="ID Livre (S1) *">
            <TextField fullWidth size="small" {...F("livre_id")} />
          </FormField>

          <FormField label="Date de suggestion">
            <TextField type="date" fullWidth size="small" {...F("date_suggestion")} />
          </FormField>

          <FormField label="Raison">
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Justification de la suggestion..."
              value={form.raison}
              onChange={(e) =>
                setForm(f => ({ ...f, raison: e.target.value }))
              }
            />
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