import { useState, useEffect } from "react";
import { api } from "../api";

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
  S1: { bg:"#EEEDFE", text:"#3C3489", dot:"#534AB7" },
  S2: { bg:"#E1F5EE", text:"#085041", dot:"#0F6E56" },
  S3: { bg:"#FAECE7", text:"#712B13", dot:"#993C1D" },
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
  const c = SRC_COLOR[src] || { bg:"#F1EFE8", text:"#444" };
  return (
    <span style={{
      fontSize:11, fontWeight:500, padding:"2px 7px",
      borderRadius:4, background:c.bg, color:c.text,
    }}>{src}</span>
  );
}

function PlanLine({ line }) {
  const isCheck   = line.startsWith("✓");
  const isCross   = line.startsWith("✗");
  const isSection = line.startsWith("─");
  const isIndent  = line.startsWith("   └─");

  let color = "var(--color-text-secondary)";
  if (isCheck) color = "#27500A";
  if (isCross) color = "#791F1F";
  if (isSection) color = "var(--color-text-tertiary)";
  if (isIndent)  color = "var(--color-text-tertiary)";

  return (
    <div style={{
      fontSize: 12, lineHeight: 1.7,
      color,
      fontFamily: isIndent || isSection ? "var(--font-mono)" : "inherit",
      paddingLeft: isIndent ? 12 : 0,
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
        fontSize:11, fontWeight:500, color:"var(--color-text-tertiary)",
        textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8,
      }}>
        Couverture des attributs
      </div>
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",
        gap:6,
      }}>
        {Object.entries(map).map(([attr, srcs]) => (
          <div key={attr} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"5px 10px",
            background:"var(--color-background-secondary)",
            borderRadius:6, fontSize:12,
          }}>
            <span style={{ fontFamily:"var(--font-mono)", color:"var(--color-text-primary)" }}>
              {attr}
            </span>
            <div style={{ display:"flex", gap:4 }}>
              {srcs.length > 0
                ? srcs.map(s => <SrcBadge key={s} src={s} />)
                : <span style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>—</span>
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
    <div style={{ textAlign:"center", padding:"24px 0", color:"var(--color-text-tertiary)", fontSize:13 }}>
      Aucun résultat
    </div>
  );

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ borderBottom:"0.5px solid var(--color-border-secondary)" }}>
            {columns.map(col => (
              <th key={col} style={{
                textAlign:"left", padding:"7px 10px",
                fontWeight:500, fontSize:11,
                color:"var(--color-text-secondary)",
                whiteSpace:"nowrap",
                fontFamily: "var(--font-mono)",
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
              {columns.map(col => {
                const val = row[col];
                if (col === "source") return (
                  <td key={col} style={{ padding:"7px 10px" }}>
                    <SrcBadge src={val} />
                  </td>
                );
                if (col === "disponibilite") return (
                  <td key={col} style={{ padding:"7px 10px" }}>
                    <span style={{
                      fontSize:11, padding:"2px 7px", borderRadius:4, fontWeight:500,
                      background: val ? "#EAF3DE" : "#FCEBEB",
                      color: val ? "#27500A" : "#791F1F",
                    }}>
                      {val ? "Disponible" : "Emprunté"}
                    </span>
                  </td>
                );
                if (col === "themes" && Array.isArray(val)) return (
                  <td key={col} style={{ padding:"7px 10px" }}>
                    {val.map((t,ti) => (
                      <span key={ti} style={{
                        fontSize:10, padding:"1px 6px", borderRadius:4,
                        background:"#EEEDFE", color:"#3C3489", marginRight:3,
                      }}>{t}</span>
                    ))}
                  </td>
                );
                return (
                  <td key={col} style={{
                    padding:"7px 10px", color:"var(--color-text-primary)",
                    whiteSpace:"nowrap", maxWidth:200,
                    overflow:"hidden", textOverflow:"ellipsis",
                  }}>
                    {val == null ? <span style={{ color:"var(--color-text-tertiary)" }}>null</span> : String(val)}
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
    <div style={{ padding:"24px 28px" }}>
      <h2 style={{ marginBottom:4 }}>Approche LAV — Local As View</h2>
      <p style={{ color:"var(--color-text-secondary)", fontSize:13, marginBottom:6 }}>
        Chaque source locale est une <strong>vue partielle</strong> du schéma global.
        Le moteur de réécriture sélectionne automatiquement les sources pertinentes
        selon les attributs demandés, puis fusionne les résultats.
      </p>

      <div style={{
        display:"inline-flex", gap:12, alignItems:"center",
        background:"var(--color-background-secondary)",
        border:"0.5px solid var(--color-border-tertiary)",
        borderRadius:8, padding:"8px 14px", marginBottom:20, fontSize:12,
        color:"var(--color-text-secondary)",
      }}>
        <span style={{ color:"var(--color-text-tertiary)" }}>GAV vs LAV</span>
        <span>GAV = schéma global défini comme union des sources</span>
        <span style={{ color:"var(--color-border-secondary)" }}>|</span>
        <span>LAV = chaque source décrite comme restriction du schéma global</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:16, alignItems:"start" }}>

        {/* ── panneau gauche : requête ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* prédéfinies */}
          <div style={{
            background:"var(--color-background-secondary)",
            border:"0.5px solid var(--color-border-tertiary)",
            borderRadius:8, overflow:"hidden",
          }}>
            <div style={{
              padding:"8px 12px", fontSize:10, fontWeight:500,
              color:"var(--color-text-tertiary)", textTransform:"uppercase",
              letterSpacing:"0.06em",
              borderBottom:"0.5px solid var(--color-border-tertiary)",
            }}>
              Requêtes prédéfinies
            </div>
            {PRESET_QUERIES.map((p,i) => (
              <button key={i} onClick={() => applyPreset(i)} style={{
                display:"block", width:"100%", textAlign:"left",
                padding:"8px 12px", fontSize:12, border:"none",
                borderBottom:"0.5px solid var(--color-border-tertiary)",
                cursor:"pointer",
                background: presetIdx===i ? "#EEEDFE" : "transparent",
                color: presetIdx===i ? "#3C3489" : "var(--color-text-secondary)",
                fontWeight: presetIdx===i ? 500 : 400,
              }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* builder */}
          <div style={{
            background:"var(--color-background-primary)",
            border:"0.5px solid var(--color-border-secondary)",
            borderRadius:8, padding:"14px",
          }}>
            {/* entité */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", display:"block", marginBottom:5 }}>
                Entité globale
              </label>
              <select
                value={entity}
                onChange={e => { setEntity(e.target.value); setAttrs([]); setResult(null); setPresetIdx(null); }}
                style={{ width:"100%" }}
              >
                {ENTITIES.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>

            {/* attributs */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", display:"block", marginBottom:6 }}>
                Attributs demandés
                <span style={{ fontWeight:400, marginLeft:4 }}>(vide = tous)</span>
              </label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {allAttrs.map(a => (
                  <button key={a} onClick={() => toggleAttr(a)} style={{
                    fontSize:11, padding:"3px 8px", borderRadius:5, cursor:"pointer",
                    background: attrs.includes(a) ? "#534AB7" : "var(--color-background-secondary)",
                    color: attrs.includes(a) ? "#fff" : "var(--color-text-secondary)",
                    border: attrs.includes(a) ? "none" : "0.5px solid var(--color-border-secondary)",
                    fontFamily:"var(--font-mono)",
                  }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* filtre */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", display:"block", marginBottom:5 }}>
                Filtre (optionnel)
              </label>
              <div style={{ display:"flex", gap:6 }}>
                <input
                  value={filterKey}
                  onChange={e => setFilterKey(e.target.value)}
                  placeholder="attribut"
                  style={{ flex:1, fontFamily:"var(--font-mono)", fontSize:12 }}
                />
                <span style={{ alignSelf:"center", color:"var(--color-text-tertiary)" }}>=</span>
                <input
                  value={filterVal}
                  onChange={e => setFilterVal(e.target.value)}
                  placeholder="valeur"
                  style={{ flex:1, fontSize:12 }}
                />
              </div>
              <div style={{ fontSize:11, color:"var(--color-text-tertiary)", marginTop:4 }}>
                Booléens : true / false
              </div>
            </div>

            {/* source forcée */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:500, color:"var(--color-text-secondary)", display:"block", marginBottom:5 }}>
                Forcer une source
              </label>
              <div style={{ display:"flex", gap:4 }}>
                {[null,"S1","S2","S3"].map(s => (
                  <button key={s||"auto"} onClick={() => setForceSrc(s)} style={{
                    fontSize:11, padding:"4px 10px", borderRadius:5, cursor:"pointer",
                    background: forceSrc===s
                      ? (s ? SRC_COLOR[s]?.dot || "#534AB7" : "#534AB7")
                      : "var(--color-background-secondary)",
                    color: forceSrc===s ? "#fff" : "var(--color-text-secondary)",
                    border: "0.5px solid var(--color-border-secondary)",
                  }}>
                    {s || "Auto"}
                  </button>
                ))}
              </div>
            </div>

            {/* require_all */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 }}>
                <input
                  type="checkbox"
                  checked={requireAll}
                  onChange={e => setRequireAll(e.target.checked)}
                />
                Exclure tuples incomplets
              </label>
            </div>

            <button
              onClick={runQuery}
              disabled={loading}
              style={{
                width:"100%", background:"#534AB7", color:"#fff",
                border:"none", padding:"8px 0", borderRadius:7,
                fontSize:13, cursor:"pointer", opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Réécriture en cours..." : "▶  Exécuter (LAV)"}
            </button>
          </div>

          {/* schema button */}
          <button onClick={() => { loadSchema(); setActiveTab("schema"); }} style={{
            padding:"7px 0", borderRadius:7, cursor:"pointer", fontSize:12,
            background:"var(--color-background-secondary)",
            border:"0.5px solid var(--color-border-secondary)",
            color:"var(--color-text-secondary)", width:"100%",
          }}>
            Voir le schéma LAV complet
          </button>
        </div>

        {/* ── panneau droit : résultats ── */}
        <div>

          {/* explication preset */}
          {presetIdx !== null && (
            <div style={{
              padding:"10px 14px", borderRadius:7, marginBottom:12,
              background:"#EEEDFE",
              border:"0.5px solid #AFA9EC",
              fontSize:12, color:"#3C3489", lineHeight:1.7,
            }}>
              <strong>Pourquoi cette requête est intéressante :</strong> {PRESET_QUERIES[presetIdx]?.explain}
            </div>
          )}

          {error && (
            <div style={{
              padding:"10px 14px", borderRadius:7, marginBottom:12,
              background:"var(--color-background-danger)",
              border:"0.5px solid var(--color-border-danger)",
              color:"var(--color-text-danger)", fontSize:13,
            }}>
              {error}
            </div>
          )}

          {result && (
            <>
              {/* résumé */}
              <div style={{
                display:"flex", gap:10, marginBottom:12, flexWrap:"wrap",
              }}>
                <div style={{
                  background:"var(--color-background-secondary)",
                  borderRadius:7, padding:"8px 14px", fontSize:12,
                  color:"var(--color-text-secondary)",
                }}>
                  <span style={{ fontWeight:500, color:"var(--color-text-primary)" }}>
                    {result.total}
                  </span> résultat{result.total !== 1 ? "s" : ""}
                </div>
                <div style={{
                  background:"var(--color-background-secondary)",
                  borderRadius:7, padding:"8px 14px", fontSize:12,
                  display:"flex", gap:6, alignItems:"center",
                }}>
                  <span style={{ color:"var(--color-text-secondary)" }}>Sources utilisées :</span>
                  {result.sources_used.map(s => <SrcBadge key={s} src={s} />)}
                </div>
                {result.sources_skipped?.length > 0 && (
                  <div style={{
                    background:"var(--color-background-secondary)",
                    borderRadius:7, padding:"8px 14px", fontSize:12,
                    display:"flex", gap:6, alignItems:"center",
                  }}>
                    <span style={{ color:"var(--color-text-tertiary)" }}>Ignorées :</span>
                    {result.sources_skipped.map(s => (
                      <span key={s} style={{
                        fontSize:11, padding:"2px 7px", borderRadius:4,
                        background:"#F1EFE8", color:"#5F5E5A",
                        textDecoration:"line-through",
                      }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* onglets */}
              <div style={{ display:"flex", gap:4, marginBottom:12 }}>
                {[
                  { id:"result",   label:`Résultats (${result.total})` },
                  { id:"plan",     label:"Plan de réécriture" },
                  { id:"coverage", label:"Couverture des attributs" },
                ].map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                    padding:"6px 14px", fontSize:12, borderRadius:6, cursor:"pointer",
                    background: activeTab===t.id ? "#534AB7" : "var(--color-background-secondary)",
                    color: activeTab===t.id ? "#fff" : "var(--color-text-secondary)",
                    border: activeTab===t.id ? "none" : "0.5px solid var(--color-border-secondary)",
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* contenu onglet */}
              <div style={{
                background:"var(--color-background-primary)",
                border:"0.5px solid var(--color-border-tertiary)",
                borderRadius:8, overflow:"hidden",
              }}>
                {activeTab === "result" && (
                  <ResultTable columns={columns} rows={result.data} />
                )}

                {activeTab === "plan" && (
                  <div style={{ padding:"14px 16px" }}>
                    <div style={{
                      fontSize:11, fontWeight:500,
                      color:"var(--color-text-tertiary)",
                      textTransform:"uppercase", letterSpacing:"0.06em",
                      marginBottom:10,
                    }}>
                      Plan de réécriture LAV
                    </div>
                    {result.rewriting_plan?.map((line, i) => (
                      <PlanLine key={i} line={line} />
                    ))}
                  </div>
                )}

                {activeTab === "coverage" && (
                  <div style={{ padding:"14px 16px" }}>
                    <CoverageMap map={result.coverage_map} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* schéma LAV complet */}
          {activeTab === "schema" && (
            <div style={{
              background:"var(--color-background-primary)",
              border:"0.5px solid var(--color-border-tertiary)",
              borderRadius:8, padding:"16px",
            }}>
              <div style={{
                fontSize:12, fontWeight:500, marginBottom:14,
                color:"var(--color-text-primary)",
              }}>
                Schéma LAV — mappings sources → entités globales
              </div>
              {schemaLoading && (
                <div style={{ color:"var(--color-text-tertiary)", fontSize:13 }}>Chargement...</div>
              )}
              {schema && Object.entries(schema).map(([entity, info]) => (
                <div key={entity} style={{ marginBottom:16 }}>
                  <div style={{
                    fontWeight:500, fontSize:13, marginBottom:6,
                    color:"var(--color-text-primary)",
                    fontFamily:"var(--font-mono)",
                  }}>
                    {entity}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                    {info.sources.map(s => (
                      <div key={s.source} style={{
                        border:`0.5px solid ${SRC_COLOR[s.source]?.dot || "#ccc"}44`,
                        borderRadius:7, padding:"10px 12px",
                        background:(SRC_COLOR[s.source]?.bg || "#f5f5f5")+"55",
                      }}>
                        <div style={{
                          display:"flex", alignItems:"center",
                          gap:6, marginBottom:6,
                        }}>
                          <SrcBadge src={s.source} />
                          <span style={{
                            fontSize:10,
                            color:(SRC_COLOR[s.source]?.text || "#444"),
                          }}>
                            {s.completeness}
                          </span>
                        </div>
                        <div style={{ fontSize:11, color:"var(--color-text-secondary)", lineHeight:1.5 }}>
                          {s.description}
                        </div>
                        {s.attributes_missing?.length > 0 && (
                          <div style={{ marginTop:6, fontSize:10, color:"var(--color-text-tertiary)" }}>
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
              border:"0.5px dashed var(--color-border-tertiary)",
              borderRadius:8, padding:"40px 24px",
              textAlign:"center", color:"var(--color-text-tertiary)",
              fontSize:13,
            }}>
              Sélectionnez une requête prédéfinie ou configurez votre requête,
              puis cliquez sur Exécuter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
