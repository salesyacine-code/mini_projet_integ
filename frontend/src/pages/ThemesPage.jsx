import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";
import PageHeader from "../Layout/PageHeader";

// MUI
import {
  Box,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";

const COLS_THEMES = [
  { key:"theme_id", label:"ID", width:80 },
  { key:"nom_theme", label:"Thème", width:260 },
  { key:"source", label:"Source", width:80 },
];

const COLS_APPT = [
  { key:"livre_ref", label:"Livre (ref)", width:200 },
  { key:"theme_ref", label:"Thème (ref)", width:120 },
  { key:"nom_theme", label:"Nom thème", width:160 },
  { key:"source", label:"Source", width:80 },
];

export default function ThemesPage() {
  const [tab, setTab] = useState("themes");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const p = source ? `?source=${source}` : "";
    const fn = tab === "themes"
      ? api.themes(p)
      : api.appartientTheme(p);

    fn.then(r => setRows(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab, source]);

  useEffect(() => {
    setRows([]);
    setSource(null);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
      
      <PageHeader 
        title="Thèmes" 
        subtitle={<>Entité THEME extraite par normalisation — S1 · S2 · S3.<br />Relation N-M via APPARTIENT_THEME (livre ↔ thème).</>} 
      />

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(e, newValue) => setTab(newValue)}
        sx={{ mb: 4, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="THEME" value="themes" sx={{ fontWeight: 600 }} />
        <Tab label="APPARTIENT_THEME (N-M)" value="appt" sx={{ fontWeight: 600 }} />
      </Tabs>

      {/* Table */}
      <DataTable
        columns={tab === "themes" ? COLS_THEMES : COLS_APPT}
        rows={rows}
        loading={loading}
        error={error}
        sourceFilter={source}
        onSourceFilter={setSource}
      />

    </Box>
  );
}