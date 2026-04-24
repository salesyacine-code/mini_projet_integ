import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, CircularProgress, IconButton, Stack, Select, MenuItem,
  FormControl, InputLabel, Alert, Paper, Fade, Chip, Divider
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StorageIcon from '@mui/icons-material/Storage';

const SOURCES_CONFIG = {
  S1: {
    label: "MySQL (Relationnel)",
    color: "#00758F",
    entities: ["AUTEUR", "THEME", "LIVRE", "EXEMPLAIRE", "ADHERENT", "ENSEIGNANT", "EMPRUNT", "SUGGESTION"],
    idColMap: {
      "AUTEUR": "auteur_id", "THEME": "theme_id", "LIVRE": "livre_id",
      "EXEMPLAIRE": "exemplaire_id", "ADHERENT": "adherent_id",
      "ENSEIGNANT": "enseignant_id", "EMPRUNT": "emprunt_id",
      "SUGGESTION": "suggestion_id"
    },
    schema: {
        "AUTEUR": ["nom", "prenom"],
        "THEME": ["nom", "description"],
        "LIVRE": ["titre", "annee_publication", "theme_id", "auteur_id"],
        "EXEMPLAIRE": ["livre_id", "etat", "date_acquisition"],
        "ADHERENT": ["nom", "prenom", "email", "date_inscription"],
        "ENSEIGNANT": ["nom", "prenom", "email", "departement"],
        "EMPRUNT": ["adherent_id", "exemplaire_id", "date_emprunt", "date_retour_prevue", "date_retour_reelle"],
        "SUGGESTION": ["adherent_id", "titre_suggere", "date_suggestion"]
    }
  },
  S2: {
    label: "MongoDB (Document)",
    color: "#47A248",
    entities: ["ouvrages", "adherant"],
    idColMap: { "ouvrages": "_id", "adherant": "_id" },
    schema: {
        "ouvrages": ["titre", "auteur_nom", "auteur_prenom", "date_publication", "genre", "isbn", "exemplaires_disponibles"],
        "adherant": ["nom", "prenom", "email", "telephone", "adresse"]
    }
  },
  S3: {
    label: "Neo4j (Graphe)",
    color: "#018BFF",
    entities: ["Book", "Writer", "Member", "Professor", "Copy", "Theme"],
    idColMap: {
      "Book": "id", "Writer": "id", "Member": "id",
      "Professor": "id", "Copy": "id", "Theme": "id"
    },
    schema: {
        "Book": ["title", "publish_year", "isbn", "language"],
        "Writer": ["first_name", "last_name", "birth_date"],
        "Member": ["first_name", "last_name", "email", "join_date"],
        "Professor": ["first_name", "last_name", "email", "department"],
        "Copy": ["status", "acquisition_date"],
        "Theme": ["name", "description"]
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

  const getExpectedFields = (src, ent) => {
    return SOURCES_CONFIG[src].schema?.[ent] || [];
  };

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
      
      let keys = [];
      if (data.length > 0) {
        // Generate columns based on the first row's keys
        keys = Object.keys(data[0]).filter(k => k !== "_source" && k !== "_id");
        if (source === "S1") keys.unshift(SOURCES_CONFIG["S1"].idColMap[entity]);
        else if (source === "S2" || source === "S3") keys.unshift("_id");
      } else {
        // Fallback to predefined schema when no data exists
        keys = [...getExpectedFields(source, entity)];
        if (source === "S1") keys.unshift(SOURCES_CONFIG["S1"].idColMap[entity]);
        else keys.unshift("_id");
      }
      
      // Remove duplicates and generate column defs
      const uniqueKeys = [...new Set(keys)];
      setColumns(uniqueKeys.map(k => ({ key: k, label: k, width: 150 })));
    } catch (e) {
      setError(e.message);
      setRows([]);
      setColumns([]);
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
    const emptyForm = {};
    const expectedFields = getExpectedFields(source, entity);
    
    if (expectedFields.length > 0) {
      expectedFields.forEach(k => emptyForm[k] = "");
    } else {
      columns.forEach(c => {
        if (c.key !== "_id" && c.key !== SOURCES_CONFIG["S1"].idColMap[entity]) {
          emptyForm[c.key] = "";
        }
      });
    }
    
    setForm(emptyForm);
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (row) => {
    const editForm = { ...row };
    // Remove internal id fields from the edit form so they aren't edited directly
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
    <Box sx={{ 
      p: { xs: 2, md: 4 }, 
      maxWidth: 1400, 
      mx: "auto",
      minHeight: '80vh',
      position: 'relative'
    }}>
      {/* Dynamic Background Blurs for Premium Feel */}
      <Box sx={{
        position: 'absolute', top: -100, left: -100, width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, rgba(0,0,0,0) 70%)',
        zIndex: 0, pointerEvents: 'none'
      }} />
      <Box sx={{
        position: 'absolute', bottom: 100, right: -50, width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(71,162,72,0.1) 0%, rgba(0,0,0,0) 70%)',
        zIndex: 0, pointerEvents: 'none'
      }} />

      <Fade in={true} timeout={800}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          
          <Box sx={{ mb: 5, textAlign: 'center' }}>
            <Typography variant="h3" sx={{ 
              fontWeight: 800, 
              mb: 1, 
              background: `linear-gradient(45deg, ${SOURCES_CONFIG[source].color}, #4f46e5)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2
            }}>
              <StorageIcon fontSize="large" sx={{ color: SOURCES_CONFIG[source].color }} />
              Gestionnaire de Source
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              Modifiez directement les données dans les bases locales en utilisant leurs schémas spécifiques, en contournant le GAV.
            </Typography>
          </Box>

          <Paper sx={{ 
            p: 3, 
            mb: 4, 
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.4)'
          }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Sélectionnez la base de données cible
                </Typography>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Système Source</InputLabel>
                  <Select 
                    value={source} 
                    label="Système Source" 
                    onChange={e => setSource(e.target.value)}
                    sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.5)' }}
                  >
                    {Object.keys(SOURCES_CONFIG).map(s => (
                      <MenuItem key={s} value={s}>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: SOURCES_CONFIG[s].color }} />
                          <Typography fontWeight={500}>{SOURCES_CONFIG[s].label}</Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Choisissez l'entité à manipuler
                </Typography>
                <FormControl fullWidth variant="outlined">
                  <InputLabel>Table / Collection / Nœud</InputLabel>
                  <Select 
                    value={entity} 
                    label="Table / Collection / Nœud" 
                    onChange={e => setEntity(e.target.value)}
                    sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.5)' }}
                  >
                    {SOURCES_CONFIG[source].entities.map(e => (
                      <MenuItem key={e} value={e}>
                        <Typography fontWeight={500}>{e}</Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Stack>
          </Paper>

          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 4, borderRadius: 2, boxShadow: '0 4px 12px rgba(211,47,47,0.1)' }}
            >
              {error}
            </Alert>
          )}

          <Box sx={{ 
            background: 'white', 
            borderRadius: 4, 
            overflow: 'hidden',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)'
          }}>
            <DataTable
              columns={columns} rows={rows} loading={loading} error={null}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAdd={openAdd} 
              addLabel={`Nouveau : ${entity}`}
            />
          </Box>
        </Box>
      </Fade>

      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, pt: 3, px: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {editId ? <AutoAwesomeIcon color="primary" /> : <StorageIcon color="primary" />}
              {editId ? `Modification` : `Insertion de données`}
            </Typography>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ bgcolor: 'grey.100' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {editId ? `ID: ${editId}` : `Schéma: ${source} > ${entity}`}
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {Object.keys(form).map(key => (
              <TextField
                key={key}
                fullWidth 
                label={key}
                variant="outlined"
                value={form[key] || ""}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                multiline={typeof form[key] === 'string' && form[key].length > 50}
                InputProps={{
                  sx: { borderRadius: 2 }
                }}
              />
            ))}
            
            {Object.keys(form).length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Aucun attribut défini pour cette entité.
                </Typography>
              </Box>
            )}
            
            {/* Allow adding custom attributes for schema-less databases */}
            {(source === "S2" || source === "S3") && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', pt: 1 }}>
                <Chip 
                  label="+ Ajouter un champ personnalisé" 
                  onClick={() => {
                    const key = prompt("Nom du nouvel attribut ?");
                    if (key) setForm(f => ({ ...f, [key]: "" }));
                  }}
                  variant="outlined"
                  color="primary"
                  sx={{ borderRadius: 2, fontWeight: 500, cursor: 'pointer' }}
                />
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 3, borderTop: '1px solid', borderColor: 'grey.100' }}>
          <Button 
            onClick={() => setOpen(false)} 
            sx={{ color: 'text.secondary', fontWeight: 600, px: 3 }}
          >
            Annuler
          </Button>
          <Button
            variant="contained" 
            disableElevation 
            onClick={handleSave}
            disabled={saving} 
            sx={{ 
              fontWeight: 600, 
              px: 4, 
              py: 1, 
              borderRadius: 2,
              background: `linear-gradient(45deg, ${SOURCES_CONFIG[source].color}, ${SOURCES_CONFIG[source].color}dd)`
            }}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {editId ? "Enregistrer" : "Confirmer l'insertion"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
