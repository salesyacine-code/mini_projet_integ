import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import PageHeader from "../Layout/PageHeader";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, CircularProgress, IconButton, Stack, Select, MenuItem,
  FormControl, InputLabel, Alert
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const SOURCES_CONFIG = {
  S1: {
    label: "S1 (MySQL)",
    entities: ["AUTEUR", "THEME", "LIVRE", "EXEMPLAIRE", "ADHERENT", "ENSEIGNANT", "EMPRUNT", "SUGGESTION"],
    idColMap: {
      "AUTEUR": "auteur_id", "THEME": "theme_id", "LIVRE": "livre_id",
      "EXEMPLAIRE": "exemplaire_id", "ADHERENT": "adherent_id",
      "ENSEIGNANT": "enseignant_id", "EMPRUNT": "emprunt_id",
      "SUGGESTION": "suggestion_id"
    }
  },
  S2: {
    label: "S2 (MongoDB)",
    entities: ["ouvrages", "adherant"],
    idColMap: { "ouvrages": "_id", "adherant": "_id" }
  },
  S3: {
    label: "S3 (Neo4j)",
    entities: ["Book", "Writer", "Member", "Professor", "Copy", "Theme"],
    idColMap: {
      "Book": "id", "Writer": "id", "Member": "id",
      "Professor": "id", "Copy": "id", "Theme": "id" // Neo4j update needs internal ID which we map to _id
    }
  }
};

export default function SourceCrudPage() {
  const [source, setSource] = useState("S1");
  const [entity, setEntity] = useState(SOURCES_CONFIG["S1"].entities[0]);
  
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (source === "S1") res = await api.s1Read(entity);
      if (source === "S2") res = await api.s2Read(entity);
      if (source === "S3") res = await api.s3Read(entity);
      
      const data = res || [];
      setRows(data);
      
      if (data.length > 0) {
        // Generate columns based on the first row's keys
        const keys = Object.keys(data[0]).filter(k => k !== "_source" && k !== "_id");
        if (source === "S1") keys.unshift(SOURCES_CONFIG["S1"].idColMap[entity]);
        else if (source === "S2" || source === "S3") keys.unshift("_id");
        
        // Remove duplicates and generate column defs
        const uniqueKeys = [...new Set(keys)];
        setColumns(uniqueKeys.map(k => ({ key: k, label: k, width: 150 })));
      } else {
        setColumns([]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [source, entity]);

  useEffect(() => {
    setEntity(SOURCES_CONFIG[source].entities[0]);
  }, [source]);

  useEffect(() => {
    if (entity) loadData();
  }, [loadData, entity]);

  const getIdVal = (row) => {
    if (source === "S1") return row[SOURCES_CONFIG["S1"].idColMap[entity]];
    return row["_id"];
  };

  const openAdd = () => {
    // initialize empty form based on columns
    const emptyForm = {};
    columns.forEach(c => {
      if (c.key !== "_id" && c.key !== SOURCES_CONFIG["S1"].idColMap[entity]) {
        emptyForm[c.key] = "";
      }
    });
    setForm(emptyForm);
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (row) => {
    const editForm = { ...row };
    // remove internal id fields from the edit form so they aren't edited directly
    delete editForm["_id"];
    delete editForm[SOURCES_CONFIG["S1"].idColMap[entity]];
    delete editForm["_source"];
    
    // Convert complex objects/arrays to JSON strings for editing (e.g. MongoDB arrays)
    Object.keys(editForm).forEach(k => {
      if (typeof editForm[k] === 'object' && editForm[k] !== null) {
        editForm[k] = JSON.stringify(editForm[k]);
      }
    });

    setForm(editForm);
    setEditId(getIdVal(row));
    setOpen(true);
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet enregistrement ?")) return;
    const idVal = getIdVal(row);
    try {
      if (source === "S1") await api.s1Delete(entity, SOURCES_CONFIG["S1"].idColMap[entity], idVal);
      if (source === "S2") await api.s2Delete(entity, idVal);
      if (source === "S3") await api.s3Delete(entity, idVal);
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Parse JSON strings back to objects if they look like JSON
      const submitData = { ...form };
      Object.keys(submitData).forEach(k => {
        if (typeof submitData[k] === 'string' && (submitData[k].startsWith('{') || submitData[k].startsWith('['))) {
          try { submitData[k] = JSON.parse(submitData[k]); } catch(e) {}
        }
      });

      if (editId) {
        if (source === "S1") await api.s1Update(entity, SOURCES_CONFIG["S1"].idColMap[entity], editId, submitData);
        if (source === "S2") await api.s2Update(entity, editId, submitData);
        if (source === "S3") await api.s3Update(entity, editId, submitData);
      } else {
        if (source === "S1") await api.s1Create(entity, submitData);
        if (source === "S2") await api.s2Create(entity, submitData);
        if (source === "S3") await api.s3Create(entity, submitData);
      }
      setOpen(false);
      loadData();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      <PageHeader 
        title="CRUD Source (Schéma Local)" 
        subtitle="Modifiez directement les données dans les schémas spécifiques de chaque source (GAV ignoré)." 
      />

      <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Source</InputLabel>
          <Select value={source} label="Source" onChange={e => setSource(e.target.value)}>
            {Object.keys(SOURCES_CONFIG).map(s => (
              <MenuItem key={s} value={s}>{SOURCES_CONFIG[s].label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 250 }}>
          <InputLabel>Entité Locale</InputLabel>
          <Select value={entity} label="Entité Locale" onChange={e => setEntity(e.target.value)}>
            {SOURCES_CONFIG[source].entities.map(e => (
              <MenuItem key={e} value={e}>{e}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <DataTable
        columns={columns} rows={rows} loading={loading} error={null}
        onEdit={openEdit}
        onDelete={handleDelete}
        onAdd={openAdd} addLabel={`Nouvel enregistrement (${entity})`}
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle className="flex items-center justify-between pr-3">
          <Typography variant="subtitle1" className="font-medium">
            {editId ? `Modifier [${editId}]` : `Nouveau dans ${entity}`}
          </Typography>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2} className="pt-1">
            {Object.keys(form).map(key => (
              <TextField
                key={key}
                fullWidth size="small" label={key}
                value={form[key] || ""}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                multiline={typeof form[key] === 'string' && form[key].length > 50}
              />
            ))}
            {Object.keys(form).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Aucun attribut détecté. Vous pouvez ajouter des attributs au JSON (S2/S3).
              </Typography>
            )}
            
            {/* Allow adding custom attributes for schema-less databases */}
            {(source === "S2" || source === "S3") && (
              <Button size="small" onClick={() => {
                const key = prompt("Nom du nouvel attribut ?");
                if (key) setForm(f => ({ ...f, [key]: "" }));
              }}>
                + Ajouter un attribut
              </Button>
            )}
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
