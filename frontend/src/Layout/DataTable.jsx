import React from "react";
import {
  Box, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Button, Stack, Typography, CircularProgress,
  IconButton, Tooltip, Alert
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

const SOURCES = [
  { id: "",    label: "Toutes sources" },
  { id: "S1",  label: "S1 MySQL" },
  { id: "S2",  label: "S2 MongoDB" },
  { id: "S3",  label: "S3 Neo4j" },
];

const DataTable = ({ 
  columns = [], 
  rows = [], 
  loading = false, 
  error = null,
  onEdit, 
  onDelete, 
  onAdd, 
  addLabel = "Ajouter",
  sourceFilter, 
  onSourceFilter 
}) => {
  
  const handleSourceChange = (sourceId) => {
    if (onSourceFilter) onSourceFilter(sourceId || null);
  };

  const safeData = Array.isArray(rows) ? rows : [];

  return (
    <Box>
      {/* Top Bar: Filters and Actions */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: { xs: 1, sm: 0 } }}>
          {SOURCES.map((src) => (
            <Button
              key={src.id} 
              size="small"
              disableElevation
              variant={(sourceFilter || "") === src.id ? "contained" : "outlined"}
              onClick={() => handleSourceChange(src.id)}
              sx={{ 
                borderRadius: 4, 
                px: 2,
                bgcolor: (sourceFilter || "") === src.id ? "primary.main" : "transparent",
                borderColor: (sourceFilter || "") === src.id ? "primary.main" : "divider",
                color: (sourceFilter || "") === src.id ? "primary.contrastText" : "text.secondary",
                "&:hover": {
                  bgcolor: (sourceFilter || "") === src.id ? "primary.dark" : "action.hover",
                }
              }}
            >
              {src.label}
            </Button>
          ))}
        </Stack>

        {onAdd && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={onAdd}
            disableElevation
          >
            {addLabel}
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {/* Table Container */}
      <Paper elevation={0} sx={{ 
        borderRadius: 2, 
        overflow: "hidden", 
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper"
      }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: "background.default" }}>
              <TableRow>
                {columns.map((col, i) => (
                  <TableCell key={i} sx={{ fontWeight: 600, color: "text.secondary", borderBottom: "2px solid", borderColor: "divider" }} width={col.width}>
                    {col.label || col.header}
                  </TableCell>
                ))}
                {(onEdit || onDelete) && (
                  <TableCell align="right" sx={{ fontWeight: 600, color: "text.secondary", borderBottom: "2px solid", borderColor: "divider" }}>
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} align="center" sx={{ py: 8 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : safeData.length > 0 ? (
                safeData.map((row, rowIndex) => (
                  <TableRow key={rowIndex} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    {columns.map((col, colIndex) => (
                      <TableCell key={colIndex}>
                        {col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}
                      </TableCell>
                    ))}
                    {(onEdit || onDelete) && (
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {onEdit && (
                            <Tooltip title="Modifier">
                              <IconButton size="small" onClick={() => onEdit(row)} color="primary" sx={{ bgcolor: "primary.50", "&:hover": { bgcolor: "primary.100" } }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {onDelete && (
                            <Tooltip title="Supprimer">
                              <IconButton size="small" onClick={() => onDelete(row)} color="error" sx={{ bgcolor: "error.50", "&:hover": { bgcolor: "error.100" } }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                    align="center" sx={{ py: 6 }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Aucune donnée trouvée.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider", bgcolor: "background.default", display: "flex", justifyContent: "space-between" }}>
           <Typography variant="caption" color="text.secondary">
             {safeData.length} élément(s) au total
           </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default DataTable;