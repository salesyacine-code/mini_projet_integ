import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Divider, Typography, IconButton, Tooltip, Box, Chip
} from "@mui/material";
import DashboardIcon        from "@mui/icons-material/Dashboard";
import PersonIcon           from "@mui/icons-material/Person";
import LabelIcon            from "@mui/icons-material/Label";
import MenuBookIcon         from "@mui/icons-material/MenuBook";
import LibraryBooksIcon     from "@mui/icons-material/LibraryBooks";
import GroupIcon            from "@mui/icons-material/Group";
import SwapHorizIcon        from "@mui/icons-material/SwapHoriz";
import LightbulbIcon        from "@mui/icons-material/Lightbulb";
import CodeIcon             from "@mui/icons-material/Code";
import MonitorHeartIcon     from "@mui/icons-material/MonitorHeart";
import ChevronLeftIcon      from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon     from "@mui/icons-material/ChevronRight";

const BADGE_STYLES = {
  S1: { bg: "#EEF2FF", color: "#3730A3", border: "#C7D2FE" },
  S2: { bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE" },
  S3: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
};

const MENU = [
  {
    title: "Accueil",
    items: [{ name: "Dashboard", path: "/", icon: <DashboardIcon fontSize="small" /> }],
  },
  {
    title: "Catalogue",
    items: [
      { name: "Auteurs",      path: "/auteurs",      icon: <PersonIcon fontSize="small" />,       badges: ["S1", "S3"] },
      { name: "Thèmes",       path: "/themes",       icon: <LabelIcon fontSize="small" />,        badges: ["S2"] },
      { name: "Livres",       path: "/livres",       icon: <MenuBookIcon fontSize="small" />,     badges: ["S1", "S2"] },
      { name: "Exemplaires",  path: "/exemplaires",  icon: <LibraryBooksIcon fontSize="small" />, badges: ["S1"] },
    ],
  },
  {
    title: "Utilisateurs",
    items: [
      { name: "Personnes", path: "/personnes", icon: <GroupIcon fontSize="small" />, badges: ["S1"] },
    ],
  },
  {
    title: "Opérations",
    items: [
      { name: "Emprunts",    path: "/emprunts",    icon: <SwapHorizIcon fontSize="small" />, badges: ["S1"] },
      { name: "Suggestions", path: "/suggestions", icon: <LightbulbIcon fontSize="small" />, badges: ["S2"] },
    ],
  },
  {
    title: "Système",
    items: [
      { name: "Requêtes SQL",  path: "/sql",    icon: <CodeIcon fontSize="small" /> },
      { name: "État (Health)", path: "/health", icon: <MonitorHeartIcon fontSize="small" /> },
    ],
  },
];

const COLLAPSED_W = 64;
const EXPANDED_W  = 240;

export default function SideBar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? COLLAPSED_W : EXPANDED_W,
        flexShrink: 0,
        transition: "width 0.25s",
        "& .MuiDrawer-paper": {
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          transition: "width 0.25s",
          overflowX: "hidden",
          bgcolor: "#111827",
          color: "white",
          borderRight: "none",
          boxSizing: "border-box",
        },
      }}
    >
      {/* Header */}
      <Box className="flex items-center justify-between px-4 py-3 border-b border-gray-800 min-h-[56px]">
        {!collapsed && (
          <Typography variant="subtitle2" className="font-bold text-white truncate">
            Projet Intégration
          </Typography>
        )}
        <IconButton
          size="small"
          onClick={() => setCollapsed(c => !c)}
          className="text-gray-400 hover:text-white ml-auto"
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Nav */}
      <Box className="flex-1 overflow-y-auto py-3">
        {MENU.map((section, si) => (
          <Box key={si} className="mb-4">
            {!collapsed && (
              <Typography
                variant="caption"
                className="px-4 mb-1 block font-semibold tracking-widest uppercase text-gray-500"
                sx={{ fontSize: 10 }}
              >
                {section.title}
              </Typography>
            )}
            {collapsed && si > 0 && <Divider className="border-gray-800 mx-2 mb-2" />}

            <List dense disablePadding>
              {section.items.map((item) => (
                <ListItem key={item.path} disablePadding className="px-2">
                  <Tooltip title={collapsed ? item.name : ""} placement="right">
                    <ListItemButton
                      component={NavLink}
                      to={item.path}
                      end={item.path === "/"}
                      className="rounded-lg mb-0.5"
                      sx={{
                        minHeight: 40,
                        px: collapsed ? 1.5 : 1.5,
                        borderRadius: "8px",
                        color: "#D1D5DB",
                        "&:hover": { bgcolor: "#1F2937", color: "white" },
                        "&.active": { bgcolor: "#2563EB", color: "white" },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: "inherit" }}>
                        {item.icon}
                      </ListItemIcon>
                      {!collapsed && (
                        <>
                          <ListItemText
                            primary={item.name}
                            primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
                          />
                          {item.badges && (
                            <Box className="flex gap-1 ml-1">
                              {item.badges.map(b => {
                                const s = BADGE_STYLES[b];
                                return (
                                  <Chip
                                    key={b} label={b} size="small"
                                    sx={{
                                      height: 18, fontSize: 10, fontFamily: "monospace",
                                      bgcolor: s.bg, color: s.color,
                                      border: `1px solid ${s.border}`,
                                      "& .MuiChip-label": { px: "5px" },
                                    }}
                                  />
                                );
                              })}
                            </Box>
                          )}
                        </>
                      )}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              ))}
            </List>
          </Box>
        ))}
      </Box>
    </Drawer>
  );
}