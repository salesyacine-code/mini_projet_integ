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

const EMPTY_ADH = { nom:"", prenom:"", email:"", telephone:"", date_inscription:"" };
const EMPTY_ENS = { nom:"", prenom:"", departement:"", email:"" };

export default function PersonnesPage({ subtype }) {
  const isAdh = subtype === "adherents";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(isAdh ? EMPTY_ADH : EMPTY_ENS);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

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
    setModal("edit");
  };

  const openEdit = (row) => {
    if (isAdh) {
      setForm({
        nom: row.nom || "",
        prenom: row.prenom || "",
        email: row.email || "",
        telephone: row.telephone || "",
        date_inscription: row.date_inscription || "",
      });
    } else {
      setForm({
        nom: row.nom || "",
        prenom: row.prenom || "",
        departement: row.departement || "",
        email: row.email || "",
      });
    }
    setEditId(row.personne_id);
    setModal("edit");
  };

  const handleDelete = async (row) => {
    if (row.source !== "S1") return alert("Suppression uniquement sur S1");
    if (!window.confirm(`Supprimer ${row.nom} ${row.prenom} ?`)) return;

    try {
      await deleteFn(row.personne_id);
      load();
    } catch(e) {
      alert(e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editId) await updateFn(editId, form);
      else await createFn(form);

      setModal(null);
      load();
    } catch(e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const F = (key) => ({
    value: form[key] || "",
    onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const title = isAdh ? "Adhérents" : "Enseignants";
  const sub = isAdh
    ? "Sous-type ISA ADHERENT — S1 · S2 · S3"
    : "Sous-type ISA ENSEIGNANT — S1 · S2 · S3";

  return (
    <Box p={3}>
      
      {/* Title */}
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        {sub}
      </Typography>

      {/* Add Button */}
      <Button
        variant="contained"
        sx={{ mb: 2 }}
        onClick={openAdd}
      >
        {isAdh ? "Nouvel adhérent" : "Nouvel enseignant"}
      </Button>

      {/* Table */}
      <DataTable
        columns={isAdh ? COLS_ADH : COLS_ENS}
        data={rows}
        actions={(row) => (
          row.source === "S1" && (
            <>
              <Button size="small" onClick={() => openEdit(row)}>
                Modifier
              </Button>
              <Button size="small" color="error" onClick={() => handleDelete(row)}>
                Supprimer
              </Button>
            </>
          )
        )}
        onSourceFilterChange={setSource}
      />

      {/* Modal */}
      {modal === "edit" && (
        <Modal
          isOpen={true}
          title={editId ? "Modifier" : (isAdh ? "Nouvel adhérent" : "Nouvel enseignant")}
          onClose={() => setModal(null)}
        >
          <FormField label="Nom *">
            <TextField fullWidth size="small" {...F("nom")} />
          </FormField>

          <FormField label="Prénom">
            <TextField fullWidth size="small" {...F("prenom")} />
          </FormField>

          <FormField label="Email">
            <TextField type="email" fullWidth size="small" {...F("email")} />
          </FormField>

          {isAdh ? (
            <>
              <FormField label="Téléphone">
                <TextField fullWidth size="small" {...F("telephone")} />
              </FormField>

              <FormField label="Date d'inscription">
                <TextField type="date" fullWidth size="small" {...F("date_inscription")} />
              </FormField>
            </>
          ) : (
            <FormField label="Département">
              <TextField fullWidth size="small" {...F("departement")} />
            </FormField>
          )}

          <FormActions
            onCancel={() => setModal(null)}
            onSubmit={handleSave}
            loading={saving}
            submitLabel={editId ? "Mettre à jour" : "Créer"}
          />
        </Modal>
      )}

    </Box>
  );
}