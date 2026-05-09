import {
  Box, Typography, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Tooltip,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PersonIcon from "@mui/icons-material/Person";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import GroupIcon from "@mui/icons-material/Group";
import SchoolIcon from "@mui/icons-material/School";
import HealingIcon from "@mui/icons-material/Healing";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import StyleIcon from "@mui/icons-material/Style";
import CategoryIcon from "@mui/icons-material/Category";
import ChatIcon from "@mui/icons-material/Chat";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

// ═══════════════════════════════════════════════════════════════
// MENU — 1 seule section (Requêtes unifiées)
// ═══════════════════════════════════════════════════════════════
const MENU = [
  // REQUÊTES — moteur GAV & LAV unifié sur le schéma global
  {
    group: "Requêtes",
    items: [
      {
        id: "sql",
        label: "Requêtes GAV & LAV",
        icon: <AccountTreeIcon />,
        highlight: true,
        badge: "GAV · LAV",
        badgeColor: "#6366f1",
        badgeText: "#fff",
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
export default function Sidebar({ active, onNav, collapsed, onToggle }) {
  return (
    <Box sx={{
      width: collapsed ? 64 : 272,
      flexShrink: 0,
      bgcolor: "#0f172a",
      color: "#f1f5f9",
      borderRight: "1px solid #1e293b",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      overflow: "hidden",
      userSelect: "none",
    }}>

      {/* ── Header / Logo ── */}
      <Box sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        px: 2, py: 1.5,
        minHeight: 58,
        borderBottom: "1px solid #1e293b",
      }}>
        {!collapsed && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, overflow: "hidden" }}>
            <Box sx={{
              width: 32, height: 32, borderRadius: 1.5,
              bgcolor: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <MenuBookIcon sx={{ fontSize: 18, color: "white" }} />
            </Box>
            <Box sx={{ overflow: "hidden" }}>
              <Typography variant="subtitle2" fontWeight={700} color="white" noWrap>
                Bibliothèque
              </Typography>
              <Typography sx={{ fontSize: "0.65rem", color: "#475569", display: "block" }} noWrap>
                Médiation multi-sources
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton
          onClick={onToggle}
          size="small"
          sx={{ color: "#475569", "&:hover": { color: "#94a3b8", bgcolor: "rgba(255,255,255,0.05)" } }}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* ── Navigation list ── */}
      <Box sx={{
        flex: 1,
        overflowY: "auto",
        py: 1,
        "&::-webkit-scrollbar": { width: 3 },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": { background: "#1e293b", borderRadius: 4 },
      }}>
        {MENU.map((section, si) => (
          <Box key={section.group}>
            {/* Section separator / label */}
            {collapsed ? (
              si > 0 && (
                <Box sx={{ mx: "auto", my: 0.75, width: 28, height: "1px", bgcolor: "#1e293b" }} />
              )
            ) : (
              <Typography sx={{
                display: "block",
                px: 2.5,
                pt: si === 0 ? 1 : 2,
                pb: 0.75,
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#334155",
              }}>
                {section.group}
              </Typography>
            )}

            {/* Items */}
            <List disablePadding>
              {section.items.map(item => {
                const isActive = active === item.id;

                const btn = (
                  <ListItemButton
                    onClick={() => onNav(item.id)}
                    sx={{
                      py: 0.8,
                      px: collapsed ? 0 : 1.5,
                      mx: collapsed ? 0 : 1,
                      borderRadius: collapsed ? 0 : 1.5,
                      justifyContent: collapsed ? "center" : "flex-start",
                      position: "relative",
                      bgcolor: isActive ? "rgba(37, 99, 235, 0.18)" : "transparent",
                      // Active left border accent
                      "&::after": !collapsed && isActive ? {
                        content: '""',
                        position: "absolute",
                        left: -8, top: "18%", bottom: "18%",
                        width: 3,
                        borderRadius: "0 2px 2px 0",
                        bgcolor: "#3b82f6",
                      } : {},
                      "&:hover": {
                        bgcolor: isActive
                          ? "rgba(37, 99, 235, 0.22)"
                          : "rgba(255,255,255,0.04)",
                      },
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    {/* Icon */}
                    <ListItemIcon sx={{
                      minWidth: collapsed ? 0 : 34,
                      justifyContent: "center",
                      color: isActive ? "#60a5fa" : item.highlight ? "#818cf8" : "#475569",
                      "& .MuiSvgIcon-root": { fontSize: 18 },
                      transition: "color 0.15s",
                    }}>
                      {item.icon}
                    </ListItemIcon>

                    {/* Label + badge */}
                    {!collapsed && (
                      <>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: "0.8125rem",
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? "#f1f5f9" : item.highlight ? "#a5b4fc" : "#94a3b8",
                            noWrap: true,
                          }}
                        />
                        {item.badge && (
                          <Box sx={{
                            fontSize: "0.58rem",
                            fontWeight: 700,
                            bgcolor: item.badgeColor || "rgba(255,255,255,0.06)",
                            color: item.badgeText || "#475569",
                            px: 0.75, py: 0.25,
                            borderRadius: 0.75,
                            flexShrink: 0,
                            ml: 0.5,
                            lineHeight: 1.6,
                          }}>
                            {item.badge}
                          </Box>
                        )}
                      </>
                    )}
                  </ListItemButton>
                );

                return collapsed ? (
                  <Tooltip key={item.id} title={`${section.group} › ${item.label}`} placement="right" arrow>
                    <ListItem disablePadding>{btn}</ListItem>
                  </Tooltip>
                ) : (
                  <ListItem disablePadding key={item.id}>{btn}</ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* ── Footer — status indicator ── */}
      <Box sx={{
        borderTop: "1px solid #1e293b",
        px: 2, py: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 1,
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <Box sx={{
          width: 7, height: 7, borderRadius: "50%",
          bgcolor: "#22c55e",
          boxShadow: "0 0 6px #22c55e",
          flexShrink: 0,
        }} />
        {!collapsed && (
          <Typography sx={{ fontSize: "0.68rem", color: "#334155", fontWeight: 500 }} noWrap>
            MySQL · MongoDB · Neo4j
          </Typography>
        )}
      </Box>
    </Box>
  );
}
