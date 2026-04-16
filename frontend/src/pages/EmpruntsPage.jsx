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
  Button,
} from "@mui/material";

const COLS = [
  { key:"emprunt_id", label:"ID", width:60 },
  { key:"exemplaire_id", label:"Exemplaire", width:100 },
  { key:"personne_id", label:"Adhérent", width:100 },
  { key:"date_emprunt", label:"Date emprunt", width:110 },
  { key:"date_retour_prevue", label:"Retour prévu", width:110 },
  { key:"statut", label:"Statut", width:90 },
  { key:"source", label:"Source", width:70 },
];

const EMPTY_NEW  = { exemplaire_id:"", adherent_id:"", date_emprunt:"", date_retour_prevue:"", statut:"en cours" };
const EMPTY_EDIT = { statut:"rendu", date_retour_prevue:"" };
const STATUTS    = ["en cours","rendu","retard"];

export default function EmpruntsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_NEW);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const p = new URLSearchParams();
    if (source) p.set("source", source);
    if (enCours) p.set("en_cours","true");

    const s = p.toString();
    api.emprunts(s ? `?${s}` : "")
      .then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [source, enCours]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (row) => {
    if (row.source !== "S1") return alert("Modification uniquement sur S1");
    setForm({
      statut: row.statut || "rendu",
      date_retour_prevue: row.date_retour_prevue || ""
    });
    setEditId(row.emprunt_id);
    setModal("edit");
  };

  const handleSaveNew = async () => {
    setSaving(true);
    try {
      await api.createEmprunt(form);
      setModal(null);
      load();
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.updateEmprunt(editId, form);
      setModal(null);
      load();
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const F = (key) => ({
    value: form[key] ?? "",
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Box p={3}>

      {/* Title */}
      <Typography variant="h5" gutterBottom>
        Emprunts
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Vue EMPRUNT — S1 (EMPRUNT) · S3 (BORROWED). Absent de S2.
      </Typography>

      {/* Filter */}
      <Box mb={2}>
        <FormControlLabel
          control={
            <Checkbox
              checked={enCours}
              onChange={(e) => setEnCours(e.target.checked)}
            />
          }
          label="Emprunts en cours seulement"
        />
      </Box>

      {/* Add Button */}
      <Button
        variant="contained"
        sx={{ mb: 2 }}
        onClick={() => {
          setForm(EMPTY_NEW);
          setModal("add");
        }}
      >
        Nouvel emprunt
      </Button>

      {/* Table */}
      <DataTable
        columns={COLS}
        data={rows}
        actions={(row) => (
          row.source === "S1" && (
            <Button size="small" onClick={() => openEdit(row)}>
              Modifier
            </Button>
          )
        )}
        onSourceFilterChange={setSource}
      />

      {/* Modal ADD */}
      {modal === "add" && (
        <Modal isOpen={true} title="Nouvel emprunt (S1)" onClose={() => setModal(null)}>
          
          <FormField label="ID Exemplaire *">
            <TextField fullWidth size="small" {...F("exemplaire_id")} />
          </FormField>

          <FormField label="ID Adhérent *">
            <TextField fullWidth size="small" {...F("adherent_id")} />
          </FormField>

          <FormField label="Date d'emprunt *">
            <TextField type="date" fullWidth size="small" {...F("date_emprunt")} />
          </FormField>

          <FormField label="Date de retour prévue">
            <TextField type="date" fullWidth size="small" {...F("date_retour_prevue")} />
          </FormField>

          <FormField label="Statut">
            <Select
              fullWidth
              size="small"
              value={form.statut}
              onChange={(e) => setForm(f => ({ ...f, statut: e.target.value }))}
            >
              {STATUTS.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormField>

          <FormActions
            onCancel={() => setModal(null)}
            onSubmit={handleSaveNew}
            loading={saving}
            submitLabel="Créer"
          />
        </Modal>
      )}

      {/* Modal EDIT */}
      {modal === "edit" && (
        <Modal isOpen={true} title="Modifier l'emprunt" onClose={() => setModal(null)}>
          
          <FormField label="Statut">
            <Select
              fullWidth
              size="small"
              value={form.statut}
              onChange={(e) => setForm(f => ({ ...f, statut: e.target.value }))}
            >
              {STATUTS.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormField>

          <FormField label="Date de retour prévue">
            <TextField type="date" fullWidth size="small" {...F("date_retour_prevue")} />
          </FormField>

          <FormActions
            onCancel={() => setModal(null)}
            onSubmit={handleSaveEdit}
            loading={saving}
            submitLabel="Mettre à jour"
          />
        </Modal>
      )}

    </Box>
  );
}