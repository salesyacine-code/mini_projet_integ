
import { BrowserRouter as  Routes, Route, useLocation, Link } from "react-router-dom";
import { Box, Typography, Breadcrumbs } from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import HomeIcon from "@mui/icons-material/Home";
import SideBar from "./SideBar";


import { Children } from "react";
// … importe les autres pages réelles ici

const PAGE_LABELS = {
  auteurs:     "Auteurs",
  themes:      "Thèmes",
  livres:      "Livres",
  exemplaires: "Exemplaires",
  personnes:   "Personnes",
  emprunts:    "Emprunts",
  suggestions: "Suggestions",
  sql:         "Requêtes SQL",
  health:      "État (Health)",
};

function AppBreadcrumb() {
  const { pathname } = useLocation();
  const seg = pathname.split("/").filter(Boolean);

  return (
    <Box className="bg-white border-b border-gray-200 px-6 py-2.5">
      <Breadcrumbs separator={<NavigateNextIcon fontSize="inherit" />} className="text-sm">
        <Box className="flex items-center gap-1 text-gray-400 hover:text-blue-600 cursor-pointer">
          <HomeIcon sx={{ fontSize: 15 }} />
          <Link to="/" className="text-xs no-underline text-gray-500 hover:text-blue-600">
            Accueil
          </Link>
        </Box>
        {seg.map((s, i) => (
          <Typography key={i} variant="caption" className="font-medium text-gray-800 capitalize">
            {PAGE_LABELS[s] ?? s}
          </Typography>
        ))}
      </Breadcrumbs>
    </Box>
  );
}

function PlaceholderPage({ title }) {
  return (
    <Box className="p-6 bg-white rounded-xl border border-gray-200">
      <Typography variant="h6" className="font-medium mb-2">{title}</Typography>
      <Typography variant="body2" className="text-gray-500">Contenu de la page...</Typography>
    </Box>
  );
}

function Layout() {
  return (
    <Box className="flex h-screen w-full bg-gray-50 overflow-hidden">
      <SideBar />
      <Box className="flex-1 flex flex-col overflow-hidden">
        <AppBreadcrumb />
        {Children}
      </Box>
    </Box>
  );
}

export default Layout;