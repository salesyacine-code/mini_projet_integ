import { useState } from "react";
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
} from "@mui/material";

import Sidebar from "./Layout/SideBar";

import Dashboard from "./pages/Dashboard";
import AuteursPage from "./pages/AuteursPage";
import ThemesPage from "./pages/ThemesPage";
import LivresPage from "./pages/LivresPage";
import ExemplairesPage from "./pages/ExemplairesPage";
import PersonnesAllPage from "./pages/PersonnesAllPage";
import PersonnesPage from "./pages/PersonnesPage";
import EmpruntsPage from "./pages/EmpruntsPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import SqlPage from "./pages/SqlPage";
import HealthPage from "./pages/HealthPage";
import SourcesPage from "./pages/SourcesPage";
import SourceCrudPage from "./pages/SourceCrudPage";

const TITLES = {
  dashboard: "Tableau de bord",
  auteurs: "Auteurs",
  themes: "Thèmes",
  livres: "Livres",
  exemplaires: "Exemplaires",
  personnes: "Personnes",
  adherents: "Adhérents",
  enseignants: "Enseignants",
  emprunts: "Emprunts",
  suggestions: "Suggestions",
  sql: "Requêtes SQL",
  health: "État des sources",
  sources: "Données par Source",
  sourcecrud: "CRUD Source",
};

function renderPage(page) {
  switch (page) {
    case "dashboard": return <Dashboard />;
    case "auteurs": return <AuteursPage />;
    case "themes": return <ThemesPage />;
    case "livres": return <LivresPage />;
    case "exemplaires": return <ExemplairesPage />;
    case "personnes": return <PersonnesAllPage />;
    case "adherents": return <PersonnesPage subtype="adherents" />;
    case "enseignants": return <PersonnesPage subtype="enseignants" />;
    case "emprunts": return <EmpruntsPage />;
    case "suggestions": return <SuggestionsPage />;
    case "sql": return <SqlPage />;
    case "health": return <HealthPage />;
    case "sources": return <SourcesPage />;
    case "sourcecrud": return <SourceCrudPage />;
    default: return <Dashboard />;
  }
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <Sidebar
        active={page}
        onNav={setPage}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />

      {/* Main layout */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Header */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: "background.paper",
            color: "text.primary",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Toolbar variant="dense">
            <Typography variant="body2" color="text.secondary">
              Bibliothèque
            </Typography>

            <Typography sx={{ mx: 1, color: 'text.disabled' }}>›</Typography>

            <Typography variant="body2" fontWeight={600} color="primary.main">
              {TITLES[page] || page}
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Box
          component="main"
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 0,
            bgcolor: "background.default",
          }}
        >
          {renderPage(page)}
        </Box>
      </Box>
    </Box>
  );
}