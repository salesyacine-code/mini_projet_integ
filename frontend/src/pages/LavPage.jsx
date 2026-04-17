import { useState, useEffect } from "react";
import { api } from "../Api";
import PageHeader from "../Layout/PageHeader";

// MUI
import { Box, Typography } from "@mui/material";

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
    <span style={{
      fontSize:11, fontWeight:600, padding:"3px 8px",
      borderRadius:6, background:c.bg, color:c.text,
    }}>{src}</span>
  );
}

function PlanLine({ line }) {
  const isCheck   = line.startsWith("✓");
  const isCross   = line.startsWith("✗");
  const isSection = line.startsWith("─");
  const isIndent  = line.startsWith("   └─");

  let color = "#64748b";
  if (isCheck) color = "#16a34a";
  if (isCross) color = "#dc2626";
  if (isSection) color = "#94a3b8";
  if (isIndent)  color = "#94a3b8";

  return (
    <div style={{
      fontSize: 13, lineHeight: 1.8,
      color,
      fontFamily: isIndent || isSection ? "monospace" : "inherit",
      paddingLeft: isIndent ? 16 : 0,
    }}>
      {line}
    </div>
  );
}

function CoverageMap({ map }) {
  if (!map || Object.keys(map).length === 0) return null;
  return (
    <div style={{ marginTop:16 }}>
      <div style={{
        fontSize:12, fontWeight:600, color:"#64748b",
        textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:12,
      }}>
        Couverture des attributs
      </div>
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))",
        gap:8,
      }}>
        {Object.entries(map).map(([attr, srcs]) => (
          <div key={attr} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"8px 12px",
            background:"#f8fafc", border: "1px solid #e2e8f0",
            borderRadius:8, fontSize:13,
          }}>
            <span style={{ fontFamily:"monospace", color:"#0f172a", fontWeight: 500 }}>
              {attr}
            </span>
            <div style={{ display:"flex", gap:6 }}>
              {srcs.length > 0
                ? srcs.map(s => <SrcBadge key={s} src={s} />)
                : <span style={{ fontSize:12, color:"#94a3b8" }}>—</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultTable({ columns, rows }) {
  if (!rows || rows.length === 0) return (
    <div style={{ textAlign:"center", padding:"32px 0", color:"#64748b", fontSize:14 }}>
      Aucun résultat
    </div>
  );

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead style={{ background: "#f8fafc" }}>
          <tr>
            {columns.map(col => (
              <th key={col} style={{
                textAlign:"left", padding:"12px 16px",
                fontWeight:600, fontSize:12,
                color:"#475569",
                whiteSpace:"nowrap",
                fontFamily: "monospace",
                borderBottom: "1px solid #e2e8f0"
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom:"1px solid #f1f5f9" }}>
              {columns.map(col => {
                const val = row[col];
                if (col === "source") return (
                  <td key={col} style={{ padding:"10px 16px" }}>
                    <SrcBadge src={val} />
                  </td>
                );
                if (col === "disponibilite") return (
                  <td key={col} style={{ padding:"10px 16px" }}>
                    <span style={{
                      fontSize:12, padding:"3px 8px", borderRadius:6, fontWeight:600,
                      background: val ? "#dcfce7" : "#fee2e2",
                      color: val ? "#16a34a" : "#dc2626",
                    }}>
                      {val ? "Disponible" : "Emprunté"}
                    </span>
                  </td>
                );
                if (col === "themes" && Array.isArray(val)) return (
                  <td key={col} style={{ padding:"10px 16px" }}>
                    {val.map((t,ti) => (
                      <span key={ti} style={{
                        fontSize:11, padding:"2px 8px", borderRadius:6,
                        background:"#eff6ff", color:"#1d4ed8", marginRight:4, fontWeight: 500
                      }}>{t}</span>
                    ))}
                  </td>
                );
                return (
                  <td key={col} style={{
                    padding:"10px 16px", color:"#0f172a",
                    whiteSpace:"nowrap", maxWidth:240,
                    overflow:"hidden", textOverflow:"ellipsis",
                  }}>
                    {val == null ? <span style={{ color:"#94a3b8", fontStyle: "italic" }}>null</span> : String(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      <PageHeader 
        title="Approche LAV — Local As View" 
        subtitle={<>Chaque source locale est une <strong>vue partielle</strong> du schéma global. Le moteur de réécriture sélectionne automatiquement les sources pertinentes selon les attributs demandés, puis fusionne les résultats.</>} 
      />

      <div style={{
        display:"inline-flex", gap:16, alignItems:"center",
        background:"#f8fafc",
        border:"1px solid #e2e8f0",
        borderRadius:12, padding:"12px 20px", marginBottom:24, fontSize:13,
        color:"#475569",
      }}>
        <span style={{ color:"#94a3b8", fontWeight: 600 }}>GAV vs LAV</span>
        <span><strong>GAV</strong> = schéma global défini comme union des sources</span>
        <span style={{ color:"#cbd5e1" }}>|</span>
        <span><strong>LAV</strong> = chaque source décrite comme restriction du schéma global</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:24, alignItems:"start" }}>

        {/* ── panneau gauche : requête ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* prédéfinies */}
          <div style={{
            background:"white",
            border:"1px solid #e2e8f0",
            borderRadius:12, overflow:"hidden",
          }}>
            <div style={{
              padding:"12px 16px", fontSize:11, fontWeight:600,
              color:"#64748b", textTransform:"uppercase",
              letterSpacing:"0.05em",
              borderBottom:"1px solid #e2e8f0",
              background:"#f8fafc"
            }}>
              Requêtes prédéfinies
            </div>
            {PRESET_QUERIES.map((p,i) => (
              <button key={i} onClick={() => applyPreset(i)} style={{
                display:"block", width:"100%", textAlign:"left",
                padding:"12px 16px", fontSize:13, border:"none",
                borderBottom:"1px solid #f1f5f9",
                cursor:"pointer", transition: "all 0.2s",
                background: presetIdx===i ? "#eff6ff" : "white",
                color: presetIdx===i ? "#1d4ed8" : "#475569",
                fontWeight: presetIdx===i ? 600 : 500,
              }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* builder */}
          <div style={{
            background:"white",
            border:"1px solid #e2e8f0",
            borderRadius:12, padding:"20px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
          }}>
            {/* entité */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#475569", display:"block", marginBottom:8 }}>
                Entité globale
              </label>
              <select
                value={entity}
                onChange={e => { setEntity(e.target.value); setAttrs([]); setResult(null); setPresetIdx(null); }}
                style={{ 
                  width:"100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", 
                  fontSize: 14, outline: "none", color: "#0f172a", fontFamily: "inherit"
                }}
              >
                {ENTITIES.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>

            {/* attributs */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#475569", display:"block", marginBottom:8 }}>
                Attributs demandés
                <span style={{ fontWeight:400, marginLeft:6, color: "#94a3b8" }}>(vide = tous)</span>
              </label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {allAttrs.map(a => (
                  <button key={a} onClick={() => toggleAttr(a)} style={{
                    fontSize:12, padding:"4px 10px", borderRadius:6, cursor:"pointer",
                    background: attrs.includes(a) ? "#2563eb" : "#f1f5f9",
                    color: attrs.includes(a) ? "#fff" : "#475569",
                    border: attrs.includes(a) ? "1px solid #2563eb" : "1px solid #e2e8f0",
                    fontFamily:"monospace", transition: "all 0.15s", fontWeight: 500
                  }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* filtre */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#475569", display:"block", marginBottom:8 }}>
                Filtre (optionnel)
              </label>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  value={filterKey}
                  onChange={e => setFilterKey(e.target.value)}
                  placeholder="attribut"
                  style={{ flex:1, fontFamily:"monospace", fontSize:13, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
                <span style={{ alignSelf:"center", color:"#94a3b8", fontWeight: 600 }}>=</span>
                <input
                  value={filterVal}
                  onChange={e => setFilterVal(e.target.value)}
                  placeholder="valeur"
                  style={{ flex:1, fontSize:13, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:6 }}>
                Booléens : true / false
              </div>
            </div>

            {/* source forcée */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#475569", display:"block", marginBottom:8 }}>
                Forcer une source
              </label>
              <div style={{ display:"flex", gap:6 }}>
                {[null,"S1","S2","S3"].map(s => (
                  <button key={s||"auto"} onClick={() => setForceSrc(s)} style={{
                    flex: 1, fontSize:12, padding:"6px 0", borderRadius:6, cursor:"pointer",
                    background: forceSrc===s
                      ? (s ? SRC_COLOR[s]?.dot || "#2563eb" : "#2563eb")
                      : "#f8fafc",
                    color: forceSrc===s ? "#fff" : "#475569",
                    border: forceSrc===s ? "1px solid transparent" : "1px solid #e2e8f0",
                    fontWeight: 600, transition: "all 0.15s"
                  }}>
                    {s || "Auto"}
                  </button>
                ))}
              </div>
            </div>

            {/* require_all */}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:13, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:10, color: "#475569" }}>
                <input
                  type="checkbox"
                  checked={requireAll}
                  onChange={e => setRequireAll(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#2563eb" }}
                />
                Exclure tuples incomplets
              </label>
            </div>

            <button
              onClick={runQuery}
              disabled={loading}
              style={{
                width:"100%", background:"#2563eb", color:"#fff",
                border:"none", padding:"12px 0", borderRadius:8,
                fontSize:14, fontWeight: 600, cursor:"pointer", opacity: loading ? 0.7 : 1,
                transition: "background 0.2s", boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)"
              }}
            >
              {loading ? "Réécriture en cours..." : "▶  Exécuter (LAV)"}
            </button>
          </div>

          {/* schema button */}
          <button onClick={() => { loadSchema(); setActiveTab("schema"); }} style={{
            padding:"12px 0", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight: 600,
            background:"white", border:"1px solid #cbd5e1", color:"#475569", width:"100%",
            transition: "background 0.2s"
          }}>
            Voir le schéma LAV complet
          </button>
        </div>

        {/* ── panneau droit : résultats ── */}
        <div>

          {/* explication preset */}
          {presetIdx !== null && (
            <div style={{
              padding:"14px 20px", borderRadius:12, marginBottom:16,
              background:"#eff6ff", border:"1px solid #bfdbfe",
              fontSize:14, color:"#1d4ed8", lineHeight:1.6,
            }}>
              <strong>Pourquoi cette requête est intéressante :</strong> {PRESET_QUERIES[presetIdx]?.explain}
            </div>
          )}

          {error && (
            <div style={{
              padding:"14px 20px", borderRadius:12, marginBottom:16,
              background:"#fef2f2", border:"1px solid #fecaca",
              color:"#b91c1c", fontSize:14, fontWeight: 500
            }}>
              {error}
            </div>
          )}

          {result && (
            <>
              {/* résumé */}
              <div style={{
                display:"flex", gap:12, marginBottom:16, flexWrap:"wrap",
              }}>
                <div style={{
                  background:"white", border: "1px solid #e2e8f0",
                  borderRadius:8, padding:"10px 16px", fontSize:13,
                  color:"#475569", boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                }}>
                  <span style={{ fontWeight:700, color:"#0f172a", fontSize: 14 }}>
                    {result.total}
                  </span> résultat{result.total !== 1 ? "s" : ""}
                </div>
                <div style={{
                  background:"white", border: "1px solid #e2e8f0",
                  borderRadius:8, padding:"10px 16px", fontSize:13,
                  display:"flex", gap:8, alignItems:"center", boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                }}>
                  <span style={{ color:"#64748b", fontWeight: 500 }}>Sources utilisées :</span>
                  {result.sources_used.map(s => <SrcBadge key={s} src={s} />)}
                </div>
                {result.sources_skipped?.length > 0 && (
                  <div style={{
                    background:"white", border: "1px solid #e2e8f0",
                    borderRadius:8, padding:"10px 16px", fontSize:13,
                    display:"flex", gap:8, alignItems:"center", boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                  }}>
                    <span style={{ color:"#94a3b8", fontWeight: 500 }}>Ignorées :</span>
                    {result.sources_skipped.map(s => (
                      <span key={s} style={{
                        fontSize:11, padding:"3px 8px", borderRadius:6, fontWeight: 600,
                        background:"#f1f5f9", color:"#94a3b8", textDecoration:"line-through",
                      }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* onglets */}
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                {[
                  { id:"result",   label:`Résultats (${result.total})` },
                  { id:"plan",     label:"Plan de réécriture" },
                  { id:"coverage", label:"Couverture des attributs" },
                ].map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                    padding:"8px 16px", fontSize:13, borderRadius:8, cursor:"pointer", fontWeight: 600,
                    background: activeTab===t.id ? "#2563eb" : "white",
                    color: activeTab===t.id ? "#fff" : "#64748b",
                    border: activeTab===t.id ? "1px solid #2563eb" : "1px solid #e2e8f0",
                    transition: "all 0.2s"
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* contenu onglet */}
              <div style={{
                background:"white", border:"1px solid #e2e8f0",
                borderRadius:12, overflow:"hidden", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
              }}>
                {activeTab === "result" && (
                  <ResultTable columns={columns} rows={result.data} />
                )}

                {activeTab === "plan" && (
                  <div style={{ padding:"20px" }}>
                    <div style={{
                      fontSize:12, fontWeight:600, color:"#64748b",
                      textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:16,
                    }}>
                      Plan de réécriture LAV
                    </div>
                    {result.rewriting_plan?.map((line, i) => (
                      <PlanLine key={i} line={line} />
                    ))}
                  </div>
                )}

                {activeTab === "coverage" && (
                  <div style={{ padding:"20px" }}>
                    <CoverageMap map={result.coverage_map} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* schéma LAV complet */}
          {activeTab === "schema" && (
            <div style={{
              background:"white", border:"1px solid #e2e8f0",
              borderRadius:12, padding:"24px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
            }}>
              <div style={{
                fontSize:15, fontWeight:600, marginBottom:20, color:"#0f172a",
              }}>
                Schéma LAV — mappings sources → entités globales
              </div>
              {schemaLoading && (
                <div style={{ color:"#64748b", fontSize:14, fontWeight: 500 }}>Chargement du schéma...</div>
              )}
              {schema && Object.entries(schema).map(([entity, info]) => (
                <div key={entity} style={{ marginBottom:24 }}>
                  <div style={{
                    fontWeight:600, fontSize:14, marginBottom:10,
                    color:"#0f172a", fontFamily:"monospace",
                  }}>
                    {entity}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:12 }}>
                    {info.sources.map(s => (
                      <div key={s.source} style={{
                        border:`1px solid ${SRC_COLOR[s.source]?.dot || "#cbd5e1"}44`,
                        borderRadius:10, padding:"12px 16px",
                        background:(SRC_COLOR[s.source]?.bg || "#f8fafc"),
                      }}>
                        <div style={{
                          display:"flex", alignItems:"center", gap:8, marginBottom:8,
                        }}>
                          <SrcBadge src={s.source} />
                          <span style={{
                            fontSize:11, fontWeight: 600,
                            color:(SRC_COLOR[s.source]?.dot || "#475569"),
                          }}>
                            {s.completeness}
                          </span>
                        </div>
                        <div style={{ fontSize:12, color:"#475569", lineHeight:1.6 }}>
                          {s.description}
                        </div>
                        {s.attributes_missing?.length > 0 && (
                          <div style={{ marginTop:8, fontSize:11, color:"#94a3b8", fontWeight: 500 }}>
                            Manquants : {s.attributes_missing.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!result && activeTab !== "schema" && (
            <div style={{
              border:"1px dashed #cbd5e1", background: "#f8fafc",
              borderRadius:12, padding:"60px 32px",
              textAlign:"center", color:"#64748b", fontSize:14, fontWeight: 500
            }}>
              Sélectionnez une requête prédéfinie ou configurez votre requête,
              puis cliquez sur Exécuter.
            </div>
          )}
        </div>
      </div>
    </Box>
  );
}
