import { useState } from "react";

const MENU = [
  {
    group: "Tableau de bord",
    items: [{ id:"dashboard", label:"Vue d'ensemble" }],
  },
  {
    group: "Gestion des sources",
    items: [
      { id:"auteurs",     label:"Auteurs",     badge:"S1+S2+S3" },
      { id:"themes",      label:"Thèmes",      badge:"S1+S2+S3" },
      { id:"livres",      label:"Livres",      badge:"S1+S2+S3" },
      { id:"exemplaires", label:"Exemplaires", badge:"S1+S2+S3" },
    ],
  },
  {
    group: "Personnes",
    items: [
      { id:"personnes",   label:"Toutes les personnes", badge:"S1+S2+S3" },
      { id:"adherents",   label:"Adhérents",            badge:"S1+S2+S3" },
      { id:"enseignants", label:"Enseignants",          badge:"S1+S2+S3" },
    ],
  },
  {
    group: "Activités",
    items: [
      { id:"emprunts",    label:"Emprunts",    badge:"S1+S3",   badgeColor:"#FAEEDA", badgeText:"#633806" },
      { id:"suggestions", label:"Suggestions", badge:"S1+S2+S3" },
    ],
  },
  {
    group: "Intégration",
    items: [
      { id:"sql",    label:"Requêtes SQL (GAV)" },
      { id:"lav",    label:"LAV — Local As View", highlight:true },
      { id:"health", label:"État des sources" },
    ],
  },
];

export default function Sidebar({ active, onNav, collapsed, onToggle }) {
  return (
    <aside style={{
      width: collapsed ? 50 : 222,
      minWidth: collapsed ? 50 : 222,
      minHeight: "100vh",
      background: "var(--color-background-secondary)",
      borderRight: "0.5px solid var(--color-border-tertiary)",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.15s ease, min-width 0.15s ease",
      overflow: "hidden",
    }}>
      {/* header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: collapsed ? "14px 11px" : "14px 14px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
          background: "#534AB7",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "#EEEDFE", fontWeight: 500,
        }}>B</div>
        {!collapsed && (
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
            Bibliothèque
          </span>
        )}
        <button onClick={onToggle} style={{
          marginLeft: "auto", background: "none", border: "none",
          cursor: "pointer", padding: 4,
          color: "var(--color-text-tertiary)", fontSize: 13, flexShrink: 0,
        }}>
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {MENU.map(section => (
          <div key={section.group}>
            {!collapsed && (
              <div style={{
                fontSize: 10, fontWeight: 500, letterSpacing: "0.06em",
                color: "var(--color-text-tertiary)",
                textTransform: "uppercase",
                padding: "10px 14px 3px",
              }}>
                {section.group}
              </div>
            )}
            {collapsed && <div style={{ height: 6 }} />}

            {section.items.map(item => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                style={{
                  display: "flex", alignItems: "center",
                  gap: 8, width: "100%",
                  padding: collapsed ? "7px 0" : "7px 14px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: active === item.id
                    ? "var(--color-background-primary)"
                    : item.highlight && active !== item.id
                    ? "#EEEDFE22"
                    : "none",
                  border: "none",
                  borderLeft: active === item.id && !collapsed
                    ? "2px solid #534AB7" : "2px solid transparent",
                  cursor: "pointer",
                  color: active === item.id
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                  fontSize: 12,
                }}
              >
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                  background: active === item.id
                    ? "#534AB7"
                    : item.highlight ? "#534AB755" : "var(--color-border-secondary)",
                }} />
                {!collapsed && (
                  <>
                    <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 500,
                        background: item.badgeColor || "#EEEDFE",
                        color: item.badgeText || "#3C3489",
                        borderRadius: 4, padding: "1px 5px", whiteSpace: "nowrap",
                      }}>
                        {item.badge}
                      </span>
                    )}
                    {item.highlight && !item.badge && (
                      <span style={{
                        fontSize: 9, fontWeight: 500,
                        background: "#EEEDFE", color: "#3C3489",
                        borderRadius: 4, padding: "1px 5px",
                      }}>
                        NEW
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
