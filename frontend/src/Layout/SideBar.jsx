import { Box, Typography, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Tooltip, Collapse } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonIcon from "@mui/icons-material/Person";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import GroupIcon from "@mui/icons-material/Group";
import SchoolIcon from "@mui/icons-material/School";
import StorageIcon from "@mui/icons-material/Storage";
import SettingsInputComponentIcon from "@mui/icons-material/SettingsInputComponent";
import HealingIcon from "@mui/icons-material/Healing";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import StyleIcon from "@mui/icons-material/Style";
import CategoryIcon from "@mui/icons-material/Category";
import ChatIcon from "@mui/icons-material/Chat";
import CompareIcon from "@mui/icons-material/Compare";
import EditNoteIcon from "@mui/icons-material/EditNote";

const MENU = [
  {
    group: "Tableau de bord",
    items: [{ id:"dashboard", label:"Vue d'ensemble", icon: <DashboardIcon /> }],
  },
  {
    group: "Gestion des sources",
    items: [
      { id:"auteurs",     label:"Auteurs",     badge:"S1+S2+S3", icon: <PersonIcon /> },
      { id:"themes",      label:"Thèmes",      badge:"S1+S2+S3", icon: <StyleIcon /> },
      { id:"livres",      label:"Livres",      badge:"S1+S2+S3", icon: <MenuBookIcon /> },
      { id:"exemplaires", label:"Exemplaires", badge:"S1+S2+S3", icon: <CategoryIcon /> },
    ],
  },
  {
    group: "Personnes",
    items: [
      { id:"personnes",   label:"Toutes les personnes", badge:"S1+S2+S3", icon: <GroupIcon /> },
      { id:"adherents",   label:"Adhérents",            badge:"S1+S2+S3", icon: <EmojiPeopleIcon /> },
      { id:"enseignants", label:"Enseignants",          badge:"S1+S2+S3", icon: <SchoolIcon /> },
    ],
  },
  {
    group: "Activités",
    items: [
      { id:"emprunts",    label:"Emprunts",    badge:"S1+S3",   badgeColor:"#f59e0b", badgeText:"#fff", icon: <LocalLibraryIcon /> },
      { id:"suggestions", label:"Suggestions", badge:"S1+S2+S3", icon: <ChatIcon /> },
    ],
  },
  {
    group: "Intégration",
    items: [
      { id:"sourcecrud", label:"CRUD Local", icon: <EditNoteIcon />, highlight:true },
      { id:"sql",     label:"Requêtes SQL",        icon: <StorageIcon /> },
      { id:"sources", label:"Données par Source",   icon: <CompareIcon />, badge:"S1·S2·S3", highlight:true },
      { id:"lav",     label:"LAV — Local As View",  highlight:true, icon: <SettingsInputComponentIcon /> },
      { id:"health",  label:"État des sources",     icon: <HealingIcon /> },
    ],
  },
];

export default function Sidebar({ active, onNav, collapsed, onToggle }) {
  return (
    <Box sx={{
      width: collapsed ? 64 : 260,
      flexShrink: 0,
      bgcolor: "#0f172a", // Dark background
      color: "#f1f5f9",
      borderRight: "1px solid #1e293b",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.2s ease",
      overflow: "hidden",
    }}>
      {/* Header */}
      <Box sx={{
        display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between",
        p: 2,
        borderBottom: "1px solid #1e293b",
      }}>
        {!collapsed && (
          <Typography variant="subtitle1" fontWeight={600} color="white" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <MenuBookIcon color="primary" />
            Bibliothèque
          </Typography>
        )}
        <IconButton onClick={onToggle} size="small" sx={{ color: "#94a3b8" }}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      {/* Nav */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 2 }}>
        {MENU.map(section => (
          <Box key={section.group} sx={{ mb: 2 }}>
            {!collapsed && (
              <Typography variant="overline" sx={{ px: 3, color: "#64748b", fontWeight: 600, letterSpacing: 1 }}>
                {section.group}
              </Typography>
            )}
            
            <List disablePadding>
              {section.items.map(item => {
                const isActive = active === item.id;
                
                const btn = (
                  <ListItemButton
                    onClick={() => onNav(item.id)}
                    sx={{
                      py: 1, px: collapsed ? 2 : 3,
                      justifyContent: collapsed ? "center" : "flex-start",
                      borderLeft: "3px solid transparent",
                      borderColor: isActive ? "primary.main" : "transparent",
                      bgcolor: isActive ? "rgba(37, 99, 235, 0.1)" : "transparent",
                      "&:hover": {
                        bgcolor: "rgba(255, 255, 255, 0.05)",
                      }
                    }}
                  >
                    <ListItemIcon sx={{ 
                      minWidth: collapsed ? 0 : 36, 
                      color: isActive ? "primary.main" : "#94a3b8",
                      justifyContent: "center"
                    }}>
                      {item.icon}
                    </ListItemIcon>
                    
                    {!collapsed && (
                      <ListItemText 
                        primary={item.label} 
                        primaryTypographyProps={{ 
                          fontSize: '0.875rem', 
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? "white" : "#cbd5e1"
                        }} 
                      />
                    )}
                    
                    {!collapsed && item.badge && (
                      <Box sx={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 600,
                        bgcolor: item.badgeColor || "rgba(255,255,255,0.1)", 
                        color: item.badgeText || "#94a3b8",
                        px: 1, py: 0.5, borderRadius: 1 
                      }}>
                        {item.badge}
                      </Box>
                    )}
                  </ListItemButton>
                );

                return collapsed ? (
                  <Tooltip key={item.id} title={item.label} placement="right" arrow>
                    <ListItem disablePadding>
                      {btn}
                    </ListItem>
                  </Tooltip>
                ) : (
                  <ListItem disablePadding key={item.id}>
                    {btn}
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
