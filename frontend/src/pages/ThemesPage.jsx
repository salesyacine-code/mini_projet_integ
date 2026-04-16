import { useState, useEffect, useCallback } from "react";
import { api } from "../Api";
import DataTable from "../Layout/DataTable";

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
    <Box p={3}>
      
      {/* Title */}
      <Typography variant="h5" gutterBottom>
        Thèmes
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Entité THEME extraite par normalisation — S1 · S2 · S3.
        <br />
        Relation N-M via APPARTIENT_THEME (livre ↔ thème).
      </Typography>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(e, newValue) => setTab(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label="THEME" value="themes" />
        <Tab label="APPARTIENT_THEME (N-M)" value="appt" />
      </Tabs>

      {/* Table */}
      <DataTable
        columns={tab === "themes" ? COLS_THEMES : COLS_APPT}
        data={rows}
        onSourceFilterChange={setSource}
      />

    </Box>
  );
}