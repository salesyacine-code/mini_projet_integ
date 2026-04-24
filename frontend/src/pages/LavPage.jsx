import { useState, useEffect } from "react";
import { api } from "../Api";
import PageHeader from "../Layout/PageHeader";

// MUI
import { 
  Box, Typography, Paper, Grid, Stack, Button, Select, MenuItem, TextField,
  Checkbox, FormControlLabel, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, Tab, Alert, Fade, Divider, InputLabel, FormControl
} from "@mui/material";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SchemaIcon from '@mui/icons-material/Schema';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// ── constantes ────────────────────────────────────────────────

const ENTITIES = [
  "AUTEUR","THEME","LIVRE","EXEMPLAIRE",
  "PERSONNE","ADHERENT","ENSEIGNANT","EMPRUNT","SUGGESTION",
];

const ENTITY_ATTRS = {
  AUTEUR:     ["auteur_id","nom","prenom","nationalite","date_naissance"],
  THEME:      ["theme_id","nom_theme"],
  LIVRE:      ["livre_id","isbn","titre","annee_publication","nb_pages","editeur","auteur_id"],
  EXEMPLAIRE: ["exemplaire_id","livre_ref","code_barre","etat","disponibilite"],
  PERSONNE:   ["personne_id","nom","prenom","email","type"],
  ADHERENT:   ["personne_id","nom","prenom","email","telephone","date_inscription","cursus","annee"],
  ENSEIGNANT: ["personne_id","nom","prenom","email","departement"],
  EMPRUNT:    ["emprunt_id","exemplaire_id","personne_id","date_emprunt","date_retour_prevue","statut"],
  SUGGESTION: ["suggestion_id","personne_id","livre_ref","date_suggestion","raison"],
};

const SRC_COLOR = {
  S1: { bg:"#eff6ff", text:"#1d4ed8", dot:"#2563eb" },
  S2: { bg:"#ecfdf5", text:"#047857", dot:"#059669" },
  S3: { bg:"#fff7ed", text:"#c2410c", dot:"#ea580c" },
};

const PRESET_QUERIES = [
  {
    label:"Livres avec éditeur (S2 requis)",
    entity:"LIVRE",
    attributes:["isbn","titre","editeur","nb_pages","annee_publication"],
    filters:{},
    explain:"S2 est la seule source avec éditeur et nb_pages. Le moteur sélectionne S1+S2+S3 et enrichit les tuples S1/S3 avec les données S2.",
  },
  {
    label:"Exemplaires disponibles",
    entity:"EXEMPLAIRE",
    attributes:["exemplaire_id","livre_ref","code_barre","etat","disponibilite"],
    filters:{ disponibilite: true },
    explain:"Filtre disponibilite=true appliqué post-fetch sur chaque source. S1 (BOOLEAN), S2 (String oui/non), S3 (status='available') sont normalisés avant fusion.",
  },
  {
    label:"Auteurs avec nationalité (S1 requis)",
    entity:"AUTEUR",
    attributes:["nom","prenom","nationalite","date_naissance"],
    filters:{},
    explain:"nationalite et date_naissance ne sont disponibles que dans S1. Le moteur inclut S1 obligatoirement ; S2 et S3 complètent nom/prenom.",
  },
  {
    label:"Enseignants avec département",
    entity:"ENSEIGNANT",
    attributes:["personne_id","nom","prenom","email","departement"],
    filters:{},
    explain:"departement couvert par S1, S2 et S3 (via department). Les 3 sources sont sélectionnées et fusionnées par email.",
  },
  {
    label:"Emprunts en cours (S2 ignorée)",
    entity:"EMPRUNT",
    attributes:["exemplaire_id","personne_id","date_emprunt","statut"],
    filters:{ statut:"en cours" },
    explain:"S2 est ABSENT pour EMPRUNT → ignorée automatiquement. Seules S1 et S3 sont réécrites. S3 déduit le statut de return_date IS NULL.",
  },
  {
    label:"Thèmes normalisés",
    entity:"THEME",
    attributes:["theme_id","nom_theme"],
    filters:{},
    explain:"S3 est prioritaire (seule source avec theme_id réels). S1 et S2 fournissent des thèmes texte sans ID. Déduplication sur nom_theme normalisé.",
  },
];

// ── sous-composants ────────────────────────────────────────────

function SrcBadge({ src }) {
  const c = SRC_COLOR[src] || { bg:"#f1f5f9", text:"#475569" };
  return (
    <Box sx={{
      fontSize: 11, fontWeight: 600, px: 1, py: 0.5,
      borderRadius: 1.5, bgcolor: c.bg, color: c.text,
      display: 'inline-flex', alignItems: 'center'
    }}>
      {src}
    </Box>
  );
}

function PlanLine({ line }) {
  const isCheck   = line.startsWith("✓");
  const isCross   = line.startsWith("✗");
  const isSection = line.startsWith("─");
  const isIndent  = line.startsWith("   └─");

  let color = "text.secondary";
  if (isCheck) color = "success.main";
  if (isCross) color = "error.main";
  if (isSection || isIndent) color = "text.disabled";

  return (
    <Typography sx={{
      fontSize: 13, lineHeight: 1.8,
      color,
      fontFamily: isIndent || isSection ? "monospace" : "inherit",
      pl: isIndent ? 2 : 0,
    }}>
      {line}
    </Typography>
  );
}

function CoverageMap({ map }) {
  if (!map || Object.keys(map).length === 0) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="overline" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: 1, mb: 2, display: 'block' }}>
        Couverture des attributs
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(map).map(([attr, srcs]) => (
          <Grid item xs={12} sm={6} md={4} key={attr}>
            <Box sx={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              p: 1.5, bgcolor: "grey.50", border: "1px solid", borderColor: "grey.200",
              borderRadius: 2,
            }}>
              <Typography sx={{ fontFamily: "monospace", fontWeight: 500, fontSize: 13 }}>
                {attr}
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {srcs.length > 0
                  ? srcs.map(s => <SrcBadge key={s} src={s} />)
                  : <Typography sx={{ fontSize: 12, color: "text.disabled" }}>—</Typography>
                }
              </Stack>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function ResultTable({ columns, rows }) {
  if (!rows || rows.length === 0) return (
    <Box sx={{ textAlign: "center", p: 4, color: "text.secondary" }}>
      Aucun résultat
    </Box>
  );

  return (
    <TableContainer>
      <Table size="small">
        <TableHead sx={{ bgcolor: 'grey.50' }}>
          <TableRow>
            {columns.map(col => (
              <TableCell key={col} sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary', fontFamily: 'monospace', py: 1.5 }}>
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i} hover>
              {columns.map(col => {
                const val = row[col];
                if (col === "source") return (
                  <TableCell key={col}>
                    <SrcBadge src={val} />
                  </TableCell>
                );
                if (col === "disponibilite") return (
                  <TableCell key={col}>
                    <Chip 
                      label={val ? "Disponible" : "Emprunté"} 
                      size="small"
                      color={val ? "success" : "error"}
                      sx={{ fontWeight: 600, fontSize: 11, height: 20 }}
                    />
                  </TableCell>
                );
                if (col === "themes" && Array.isArray(val)) return (
                  <TableCell key={col}>
                    <Stack direction="row" spacing={0.5}>
                      {val.map((t,ti) => (
                        <Chip key={ti} label={t} size="small" color="primary" variant="outlined" sx={{ fontSize: 11, height: 20 }} />
                      ))}
                    </Stack>
                  </TableCell>
                );
                return (
                  <TableCell key={col} sx={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {val == null ? <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>null</Typography> : String(val)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ── page principale ────────────────────────────────────────────

export default function LavPage() {
  const [entity,      setEntity]      = useState("LIVRE");
  const [attrs,       setAttrs]       = useState([]);
  const [filterKey,   setFilterKey]   = useState("");
  const [filterVal,   setFilterVal]   = useState("");
  const [forceSrc,    setForceSrc]    = useState(null);
  const [requireAll,  setRequireAll]  = useState(false);
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [activeTab,   setActiveTab]   = useState("result");  // "result" | "plan" | "coverage" | "schema"
  const [schema,      setSchema]      = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [presetIdx,   setPresetIdx]   = useState(null);

  const allAttrs = ENTITY_ATTRS[entity] || [];

  const toggleAttr = (a) => {
    setAttrs(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  };

  const loadSchema = () => {
    setSchemaLoading(true);
    api.lavSchema()
      .then(setSchema)
      .catch(e => setError(e.message))
      .finally(() => setSchemaLoading(false));
  };

  const applyPreset = (i) => {
    const p = PRESET_QUERIES[i];
    setPresetIdx(i);
    setEntity(p.entity);
    setAttrs(p.attributes || []);
    setFilterKey(Object.keys(p.filters)[0] || "");
    setFilterVal(Object.values(p.filters)[0] != null ? String(Object.values(p.filters)[0]) : "");
    setForceSrc(null);
    setResult(null); setError(null);
  };

  const runQuery = async () => {
    setLoading(true); setError(null); setResult(null);
    const filters = {};
    if (filterKey && filterVal !== "") {
      const v = filterVal === "true" ? true : filterVal === "false" ? false : filterVal;
      filters[filterKey] = v;
    }
    try {
      const r = await api.lavQuery({
        entity,
        attributes: attrs.length > 0 ? attrs : null,
        filters,
        sources: forceSrc ? [forceSrc] : null,
        require_all: requireAll,
      });
      setResult(r);
      setActiveTab("result");
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = result?.data?.length > 0
    ? Object.keys(result.data[0])
    : [];

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto", position: 'relative' }}>
      
      {/* Dynamic Background Blurs */}
      <Box sx={{
        position: 'absolute', top: -100, left: -100, width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(0,0,0,0) 70%)',
        zIndex: 0, pointerEvents: 'none'
      }} />
      <Box sx={{
        position: 'absolute', bottom: 100, right: -50, width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)',
        zIndex: 0, pointerEvents: 'none'
      }} />

      <Fade in={true} timeout={800}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <PageHeader 
            title="Approche LAV — Local As View" 
            subtitle={<>Chaque source locale est une <strong>vue partielle</strong> du schéma global. Le moteur de réécriture sélectionne automatiquement les sources pertinentes selon les attributs demandés, puis fusionne les résultats.</>} 
          />

          <Paper sx={{ 
            p: 2, mb: 4, borderRadius: 3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.100',
            display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap'
          }} elevation={0}>
            <Typography variant="subtitle2" color="primary.700" fontWeight={700}>GAV vs LAV</Typography>
            <Typography variant="body2" color="primary.900"><strong>GAV</strong> = schéma global défini comme union des sources</Typography>
            <Typography variant="body2" color="primary.300">|</Typography>
            <Typography variant="body2" color="primary.900"><strong>LAV</strong> = chaque source décrite comme restriction du schéma global</Typography>
          </Paper>

          <Grid container spacing={4}>
            
            {/* ── panneau gauche : requête ── */}
            <Grid item xs={12} md={4}>
              <Stack spacing={3}>
                
                {/* prédéfinies */}
                <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: 'grey.200' }} elevation={0}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'grey.200' }}>
                    <Typography variant="overline" fontWeight={700} color="text.secondary">
                      <AutoFixHighIcon fontSize="small" sx={{ verticalAlign: 'sub', mr: 1 }} />
                      Requêtes prédéfinies
                    </Typography>
                  </Box>
                  <Stack>
                    {PRESET_QUERIES.map((p,i) => (
                      <Box 
                        key={i} 
                        onClick={() => applyPreset(i)} 
                        sx={{
                          p: 2, borderBottom: '1px solid', borderColor: 'grey.100', cursor: 'pointer',
                          bgcolor: presetIdx === i ? 'primary.50' : 'white',
                          color: presetIdx === i ? 'primary.700' : 'text.primary',
                          transition: 'all 0.2s',
                          '&:hover': { bgcolor: presetIdx === i ? 'primary.50' : 'grey.50' }
                        }}
                      >
                        <Typography variant="body2" fontWeight={presetIdx === i ? 600 : 500}>
                          {p.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>

                {/* builder */}
                <Paper sx={{ 
                  p: 3, borderRadius: 3, 
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid', borderColor: 'grey.200',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)'
                }}>
                  <Stack spacing={3}>
                    {/* entité */}
                    <FormControl fullWidth size="small">
                      <InputLabel>Entité globale</InputLabel>
                      <Select
                        value={entity}
                        label="Entité globale"
                        onChange={e => { setEntity(e.target.value); setAttrs([]); setResult(null); setPresetIdx(null); }}
                        sx={{ borderRadius: 2 }}
                      >
                        {ENTITIES.map(e => <MenuItem key={e} value={e}>{e}</MenuItem>)}
                      </Select>
                    </FormControl>

                    {/* attributs */}
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Attributs demandés <Typography component="span" variant="caption">(vide = tous)</Typography>
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {allAttrs.map(a => (
                          <Chip 
                            key={a} 
                            label={a} 
                            onClick={() => toggleAttr(a)}
                            color={attrs.includes(a) ? "primary" : "default"}
                            variant={attrs.includes(a) ? "filled" : "outlined"}
                            size="small"
                            sx={{ fontFamily: 'monospace', borderRadius: 1.5, fontWeight: attrs.includes(a) ? 600 : 400 }}
                          />
                        ))}
                      </Box>
                    </Box>

                    {/* filtre */}
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Filtre (optionnel)
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          size="small"
                          placeholder="attribut"
                          value={filterKey}
                          onChange={e => setFilterKey(e.target.value)}
                          sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontFamily: 'monospace', borderRadius: 2 } }}
                        />
                        <Typography color="text.secondary" fontWeight={700}>=</Typography>
                        <TextField
                          size="small"
                          placeholder="valeur"
                          value={filterVal}
                          onChange={e => setFilterVal(e.target.value)}
                          sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Stack>
                    </Box>

                    {/* source forcée */}
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Forcer une source
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        {[null,"S1","S2","S3"].map(s => (
                          <Button 
                            key={s||"auto"} 
                            variant={forceSrc === s ? "contained" : "outlined"}
                            onClick={() => setForceSrc(s)}
                            disableElevation
                            size="small"
                            sx={{ 
                              flex: 1, 
                              borderRadius: 2, 
                              color: forceSrc === s ? 'white' : 'text.secondary',
                              borderColor: forceSrc === s ? 'transparent' : 'grey.300',
                              bgcolor: forceSrc === s ? (s ? SRC_COLOR[s]?.dot : 'primary.main') : 'transparent'
                            }}
                          >
                            {s || "Auto"}
                          </Button>
                        ))}
                      </Stack>
                    </Box>

                    {/* require_all */}
                    <FormControlLabel
                      control={
                        <Checkbox 
                          checked={requireAll} 
                          onChange={e => setRequireAll(e.target.checked)} 
                          color="primary"
                        />
                      }
                      label={<Typography variant="body2" color="text.secondary">Exclure tuples incomplets</Typography>}
                    />

                    <Button
                      variant="contained"
                      onClick={runQuery}
                      disabled={loading}
                      startIcon={<PlayArrowIcon />}
                      size="large"
                      sx={{ 
                        borderRadius: 2, fontWeight: 700,
                        background: 'linear-gradient(45deg, #10b981, #059669)',
                        boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
                        '&:hover': { background: 'linear-gradient(45deg, #059669, #047857)' }
                      }}
                    >
                      {loading ? "Réécriture..." : "Exécuter la requête (LAV)"}
                    </Button>
                  </Stack>
                </Paper>

                {/* schema button */}
                <Button 
                  variant="outlined"
                  onClick={() => { loadSchema(); setActiveTab("schema"); }}
                  startIcon={<SchemaIcon />}
                  sx={{ borderRadius: 2, py: 1.5, fontWeight: 600, color: 'text.secondary', borderColor: 'grey.300', bgcolor: 'white' }}
                >
                  Voir le schéma LAV complet
                </Button>
              </Stack>
            </Grid>

            {/* ── panneau droit : résultats ── */}
            <Grid item xs={12} md={8}>
              <Stack spacing={3}>
                
                {/* explication preset */}
                {presetIdx !== null && (
                  <Fade in={true}>
                    <Alert icon={<InfoOutlinedIcon />} severity="info" sx={{ borderRadius: 3, border: '1px solid', borderColor: 'info.200' }}>
                      <Typography variant="body2">
                        <strong>Pourquoi cette requête est intéressante :</strong> {PRESET_QUERIES[presetIdx]?.explain}
                      </Typography>
                    </Alert>
                  </Fade>
                )}

                {error && (
                  <Alert severity="error" sx={{ borderRadius: 3 }}>
                    {error}
                  </Alert>
                )}

                {result && (
                  <Box>
                    {/* résumé */}
                    <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
                      <Paper sx={{ px: 2, py: 1, borderRadius: 2, border: '1px solid', borderColor: 'grey.200' }} elevation={0}>
                        <Typography variant="body2" color="text.secondary">
                          <Typography component="span" fontWeight={700} color="text.primary" fontSize={16}>{result.total}</Typography> résultat{result.total !== 1 ? "s" : ""}
                        </Typography>
                      </Paper>
                      
                      <Paper sx={{ px: 2, py: 1, borderRadius: 2, border: '1px solid', borderColor: 'grey.200', display: 'flex', alignItems: 'center', gap: 1 }} elevation={0}>
                        <Typography variant="body2" color="text.secondary" fontWeight={500}>Sources utilisées :</Typography>
                        {result.sources_used.map(s => <SrcBadge key={s} src={s} />)}
                      </Paper>

                      {result.sources_skipped?.length > 0 && (
                        <Paper sx={{ px: 2, py: 1, borderRadius: 2, border: '1px solid', borderColor: 'grey.200', display: 'flex', alignItems: 'center', gap: 1 }} elevation={0}>
                          <Typography variant="body2" color="text.secondary" fontWeight={500}>Ignorées :</Typography>
                          {result.sources_skipped.map(s => (
                            <Typography key={s} sx={{ fontSize: 11, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: 'grey.100', color: 'text.disabled', textDecoration: 'line-through', fontWeight: 600 }}>
                              {s}
                            </Typography>
                          ))}
                        </Paper>
                      )}
                    </Stack>

                    {/* Tabs */}
                    <Paper sx={{ borderRadius: 3, border: '1px solid', borderColor: 'grey.200', overflow: 'hidden', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
                      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ px: 2 }}>
                          <Tab label={`Résultats (${result.total})`} value="result" sx={{ fontWeight: 600, textTransform: 'none' }} />
                          <Tab label="Plan de réécriture" value="plan" sx={{ fontWeight: 600, textTransform: 'none' }} />
                          <Tab label="Couverture des attributs" value="coverage" sx={{ fontWeight: 600, textTransform: 'none' }} />
                        </Tabs>
                      </Box>

                      {/* contenu onglet */}
                      <Box sx={{ bgcolor: 'white', minHeight: 400 }}>
                        {activeTab === "result" && (
                          <ResultTable columns={columns} rows={result.data} />
                        )}

                        {activeTab === "plan" && (
                          <Box sx={{ p: 3 }}>
                            <Typography variant="overline" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: 1, mb: 2, display: 'block' }}>
                              Plan de réécriture LAV
                            </Typography>
                            {result.rewriting_plan?.map((line, i) => (
                              <PlanLine key={i} line={line} />
                            ))}
                          </Box>
                        )}

                        {activeTab === "coverage" && (
                          <Box sx={{ p: 3 }}>
                            <CoverageMap map={result.coverage_map} />
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  </Box>
                )}

                {/* schéma LAV complet */}
                {activeTab === "schema" && (
                  <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 3, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SchemaIcon color="primary" />
                      Schéma LAV — mappings sources → entités globales
                    </Typography>
                    
                    {schemaLoading && (
                      <Typography color="text.secondary">Chargement du schéma...</Typography>
                    )}
                    
                    {schema && Object.entries(schema).map(([entityName, info]) => (
                      <Box key={entityName} sx={{ mb: 4 }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, fontFamily: 'monospace', color: 'primary.main', bgcolor: 'primary.50', display: 'inline-block', px: 1.5, py: 0.5, borderRadius: 2 }}>
                          {entityName}
                        </Typography>
                        <Grid container spacing={2}>
                          {info.sources.map(s => (
                            <Grid item xs={12} md={6} key={s.source}>
                              <Box sx={{
                                border: `1px solid ${SRC_COLOR[s.source]?.dot || "#cbd5e1"}44`,
                                borderRadius: 3, p: 2, height: '100%',
                                background: (SRC_COLOR[s.source]?.bg || "#f8fafc"),
                              }}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                                  <SrcBadge src={s.source} />
                                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: SRC_COLOR[s.source]?.dot || 'text.secondary' }}>
                                    {s.completeness}
                                  </Typography>
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.6 }}>
                                  {s.description}
                                </Typography>
                                {s.attributes_missing?.length > 0 && (
                                  <Typography sx={{ mt: 1, fontSize: 11, color: 'text.disabled', fontWeight: 500 }}>
                                    Manquants : {s.attributes_missing.join(", ")}
                                  </Typography>
                                )}
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                        <Divider sx={{ mt: 3 }} />
                      </Box>
                    ))}
                  </Paper>
                )}

                {!result && activeTab !== "schema" && (
                  <Box sx={{
                    border: "1px dashed", borderColor: "grey.300", bgcolor: "grey.50",
                    borderRadius: 3, p: 8,
                    textAlign: "center", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
                  }}>
                    <AutoFixHighIcon sx={{ fontSize: 48, color: 'grey.300' }} />
                    <Typography color="text.secondary" fontWeight={500}>
                      Sélectionnez une requête prédéfinie ou configurez votre requête,
                      <br/> puis cliquez sur Exécuter.
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Fade>
    </Box>
  );
}
