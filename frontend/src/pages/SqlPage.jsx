import { useState } from "react";
import { api } from "../Api";

// MUI
import {
  Box,
  Typography,
  Paper,
  Button,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
} from "@mui/material";

const PREDEFINED = [
  { label: "Tous les livres avec auteur", sql: `SELECT ...` },
  { label: "Emprunts en cours", sql: `SELECT ...` },
  { label: "Livres par catégorie", sql: `SELECT ...` },
  { label: "Suggestions par enseignant", sql: `SELECT ...` },
  { label: "Exemplaires disponibles", sql: `SELECT ...` },
  { label: "Adhérents les plus actifs", sql: `SELECT ...` },
  { label: "Livres jamais empruntés", sql: `SELECT ...` },
  { label: "Vue GAV multi-sources", sql: `SELECT ...` },
];

export default function SqlPage() {
  const [sql, setSql] = useState(PREDEFINED[0].sql);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await api.runSQL(sql);
      setResult(r);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pickPredefined = (i) => {
    setSelected(i);
    setSql(PREDEFINED[i].sql);
    setResult(null);
    setError(null);
  };

  return (
    <Box p={3}>
      
      {/* Title */}
      <Typography variant="h5" gutterBottom>
        Requêtes SQL
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Exécution de requêtes SELECT sur S1 (MySQL).
      </Typography>

      <Box display="grid" gridTemplateColumns="250px 1fr" gap={2}>
        
        {/* Sidebar */}
        <Paper elevation={2}>
          <Typography variant="caption" sx={{ p:2, display:"block" }}>
            Requêtes prédéfinies
          </Typography>

          <List dense>
            {PREDEFINED.map((q, i) => (
              <ListItemButton
                key={i}
                selected={selected === i}
                onClick={() => pickPredefined(i)}
              >
                <ListItemText primary={q.label} />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* Editor + Results */}
        <Box>
          
          {/* Editor */}
          <Paper sx={{ mb:2 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              p={1.5}
              borderBottom="1px solid #e0e0e0"
            >
              <Typography variant="caption">
                SQL — Source S1
              </Typography>

              <Button
                variant="contained"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Exécution..." : "Exécuter"}
              </Button>
            </Box>

            <TextField
              multiline
              minRows={6}
              fullWidth
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              variant="outlined"
              sx={{ fontFamily: "monospace" }}
            />
          </Paper>

          {/* Error */}
          {error && (
            <Alert severity="error" sx={{ mb:2 }}>
              {error}
            </Alert>
          )}

          {/* Results */}
          {result && (
            <Paper>
              
              <Box
                p={1.5}
                display="flex"
                gap={2}
                borderBottom="1px solid #e0e0e0"
              >
                <Typography variant="body2">
                  {result.total} lignes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {result.columns?.length} colonnes
                </Typography>
              </Box>

              <Box sx={{ overflowX:"auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {(result.columns || []).map(col => (
                        <TableCell key={col}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {(result.rows || []).map((row, i) => (
                      <TableRow key={i}>
                        {(result.columns || []).map(col => (
                          <TableCell key={col}>
                            {String(row[col] ?? "NULL")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>

                </Table>
              </Box>

            </Paper>
          )}

        </Box>
      </Box>
    </Box>
  );
}