import { NavLink } from "react-router-dom";
import { Drawer, List, ListItemButton, ListItemText } from "@mui/material";

export default function Sidebar() {
  return (
    <Drawer variant="permanent" anchor="left">
      <div className="w-64 h-full bg-gray-900 text-white">
        <h2 className="text-xl font-bold p-4 border-b border-gray-700">
          Admin Panel
        </h2>

        <List>
          {/* Use 'component={NavLink}' to integrate them properly */}
          <ListItemButton component={NavLink} to="/sources">
            <ListItemText primary="Sources" />
          </ListItemButton>

          <ListItemButton component={NavLink} to="/content">
            <ListItemText primary="Content" />
          </ListItemButton>

          <ListItemButton component={NavLink} to="/queries">
            <ListItemText primary="Queries" />
          </ListItemButton>
        </List>
      </div>
    </Drawer>
  );
}