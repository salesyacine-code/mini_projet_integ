import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  Stack,
  CircularProgress
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const Modal = ({ isOpen, onClose, title, children }) => {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">{title}</Typography>

        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Body */}
      <DialogContent dividers sx={{ maxHeight: "70vh" }}>
        {children}
      </DialogContent>
    </Dialog>
  );
};

export default Modal;

export const FormField = ({ label, children }) => (
  <Box mb={2}>
    <Typography variant="body2" sx={{ mb: 0.5 }}>
      {label}
    </Typography>
    {children}
  </Box>
);


export const FormActions = ({
  onCancel,
  submitLabel = "Enregistrer",
  loading = false,
}) => (
  <Stack
    direction="row"
    spacing={2}
    justifyContent="flex-end"
    mt={3}
    pt={2}
    borderTop="1px solid #e0e0e0"
  >
    <Button variant="outlined" onClick={onCancel}>
      Annuler
    </Button>

    <Button
      type="submit"
      variant="contained"
      disabled={loading}
    >
      {loading ? <CircularProgress size={20} /> : submitLabel}
    </Button>
  </Stack>
);