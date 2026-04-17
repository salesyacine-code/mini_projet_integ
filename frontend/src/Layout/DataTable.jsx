import React, { useState } from "react";
import {
  Box, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Button, Stack, Typography,
} from "@mui/material";

const DataTable = ({ columns = [], data = [], actions, onSourceFilterChange }) => {
  const [activeSource, setActiveSource] = useState("ALL");

  const sources = [
    { id: "ALL", label: "Toutes les sources" },
    { id: "S1",  label: "Source 1 (BDD)" },
    { id: "S2",  label: "Source 2 (RDF)" },
    { id: "S3",  label: "Source 3 (Externe)" },
  ];

  const handleSourceChange = (sourceId) => {
    setActiveSource(sourceId);
    onSourceFilterChange?.(sourceId);
  };

  const safeData = Array.isArray(data) ? data : [];

  const filteredData =
    activeSource === "ALL"
      ? safeData
      : safeData.filter(
          (row) =>
            row.source === activeSource ||
            (Array.isArray(row.sources) && row.sources.includes(activeSource))
        );

  return (
    <Paper elevation={2} sx={{ borderRadius: 2, overflow: "hidden" }}>

      {/* Filters */}
      <Box
        px={2} py={1.5}
        display="flex" justifyContent="space-between" alignItems="center"
        borderBottom="1px solid #e0e0e0" bgcolor="#fafafa"
      >
        <Stack direction="row" spacing={1}>
          {sources.map((src) => (
            <Button
              key={src.id} size="small"
              variant={activeSource === src.id ? "contained" : "outlined"}
              onClick={() => handleSourceChange(src.id)}
            >
              {src.label}
            </Button>
          ))}
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {filteredData.length} résultat(s)
        </Typography>
      </Box>

      {/* Table */}
      <Box sx={{ overflowX: "auto" }}>
        <Table>
          <TableHead sx={{ bgcolor: "#f5f5f5" }}>
            <TableRow>
              {columns.map((col, i) => (
                <TableCell key={i} sx={{ fontWeight: 600 }}>{col.header}</TableCell>
              ))}
              {actions && (
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              )}
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredData.length > 0 ? (
              filteredData.map((row, rowIndex) => (
                <TableRow key={rowIndex} hover>
                  {columns.map((col, colIndex) => (
                    <TableCell key={colIndex}>
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? "—"}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell align="right">{actions(row)}</TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  align="center" sx={{ py: 6 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Aucune donnée ne correspond à cette source.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};

export default DataTable;