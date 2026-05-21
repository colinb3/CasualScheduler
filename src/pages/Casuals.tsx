/**
 * Casuals.tsx
 * Colin Brown May 11, 2026
 */

import React from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  TextField,
  Avatar,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { Link as RouterLink } from "react-router-dom";
import { queryRows, runSql } from "../db/sqlite";
import type { Dayjs } from "dayjs";

type CasualRow = {
  id: number;
  name: string;
};

export default function Casuals({
  selectedWeekStart,
}: {
  selectedWeekStart: Dayjs | null;
}) {
  const [casuals, setCasuals] = React.useState<CasualRow[]>([]);
  const [addCasualDialogOpen, setAddCasualDialogOpen] =
    React.useState<boolean>(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [newEditCasualName, setNewEditCasualName] = React.useState<
    string | null
  >(null);
  const [editCasualDialogOpen, setEditCasualDialogOpen] =
    React.useState<boolean>(false);
  const [editCasualId, setEditCasualId] = React.useState<number | null>(null);

  React.useEffect(() => {
    let isActive = true;

    async function loadCasual() {
      try {
        const rows = await queryRows<CasualRow>(
          `
              SELECT id, name
              FROM Casual
            `,
        );

        if (isActive) {
          setCasuals(rows);
          setErrorMsg(null);
        }
      } catch (error) {
        if (isActive) {
          setErrorMsg(
            error instanceof Error ? error.message : "Failed to load branches",
          );
        }
      }
    }

    void loadCasual();

    return () => {
      isActive = false;
    };
  }, []);

  const refreshData = async () => {
    try {
      const branchRows = await queryRows<CasualRow>(
        `
            SELECT id, name
            FROM Casual
          `,
      );
      setCasuals(branchRows);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? "Database refresh error: " + error.message
          : "Database error. Failed to refresh data.",
      );
    }
  };

  const handleOpenAddCasual = () => {
    setSaveError(null);
    setAddCasualDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddCasualDialogOpen(false);
    setSaveError(null);
    setNewEditCasualName(null);
  };

  const handleCloseEditDialog = () => {
    setEditCasualDialogOpen(false);
    setSaveError(null);
    setNewEditCasualName(null);
  };

  const handleEditCasual = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await runSql(
        `
            UPDATE Casual
            SET name = ?
            WHERE id = ?
          `,
        [newEditCasualName, editCasualId],
      );

      setEditCasualDialogOpen(false);

      refreshData();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to edit casual",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCasual = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await runSql(
        `
            INSERT INTO Casual (name)
            VALUES (?)
          `,
        [newEditCasualName],
      );

      setAddCasualDialogOpen(false);
      setNewEditCasualName(null);

      refreshData();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to add casual",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveCasual = async (rmId: number) => {
    try {
      await runSql(
        `DELETE FROM Casual 
        WHERE id = ?`,
        [rmId],
      );

      refreshData();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Failed to remove casual",
      );
    }
  };

  const handleOpenEditCasual = (id: number, name: string) => {
    setEditCasualId(id);
    setNewEditCasualName(name);
    setSaveError(null);
    setEditCasualDialogOpen(true);
  };

  const getWeekStart = (date: Dayjs | null) => {
    if (!date) {
      return null;
    }

    const monday = date.clone().startOf("week").add(1, "day");

    return date.day() === 0 ? monday.subtract(7, "day") : monday;
  };

  return (
    <>
      <Box sx={{ padding: 1 }}>
        <Stack
          direction={"row"}
          sx={{
            spacing: 1,
            mb: 1,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Button
            sx={{ mb: 1 }}
            component={RouterLink}
            to="/"
            startIcon={<HomeIcon />}
          >
            Home
          </Button>
          {selectedWeekStart && getWeekStart(selectedWeekStart) && (
            <Typography sx={{ whiteSpace: "nowrap" }}>
              Week: {getWeekStart(selectedWeekStart)?.format("MMM D")} -{" "}
              {getWeekStart(selectedWeekStart)?.add(6, "day").format("MMM D")}
            </Typography>
          )}
        </Stack>
        <Stack
          direction={"row"}
          sx={{ justifyContent: "space-between", spacing: 2, mb: 2 }}
        >
          <Typography variant="h4">Casuals</Typography>
          <Button
            variant="contained"
            onClick={handleOpenAddCasual}
            startIcon={<AddIcon />}
            size="small"
          >
            Casual
          </Button>
        </Stack>

        {errorMsg ? (
          <Typography color="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Typography>
        ) : null}
        {casuals.length === 0 ? (
          <Typography>Click "+ Casual" to add your first casual.</Typography>
        ) : (
          <Grid container spacing={2}>
            {casuals.map((casual) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={casual.id}>
                <Box
                  sx={{
                    border: "solid",
                    borderWidth: "1px",
                    borderColor: "divider",
                    borderRadius: "3px",
                    padding: "10px",
                  }}
                >
                  <Stack
                    direction={"row"}
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack
                      direction={"row"}
                      spacing={1.5}
                      sx={{
                        alignItems: "center",
                      }}
                    >
                      <Avatar sx={{ width: 40, height: 40, flexShrink: 0 }}>
                        {casual.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography
                        variant="body1"
                        sx={{
                          minWidth: 0,
                          flex: 1,
                          overflowWrap: "anywhere",
                          whiteSpace: "normal",
                        }}
                      >
                        {casual.name}
                      </Typography>
                    </Stack>
                    <Stack direction={"row"} spacing={0.25}>
                      <Tooltip title="Edit Casual">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => {
                            handleOpenEditCasual(casual.id, casual.name);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove Casual">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            handleRemoveCasual(casual.id);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}

        <Dialog open={addCasualDialogOpen} onClose={handleCloseAddDialog}>
          <DialogTitle>Add Casual</DialogTitle>
          <DialogContent>
            <Box sx={{ py: 1 }}>
              <Stack direction={"column"} spacing={2}>
                <TextField
                  label="Casual Name"
                  variant="outlined"
                  sx={{ mt: 2 }}
                  value={newEditCasualName || ""}
                  onChange={(e) => setNewEditCasualName(e.target.value)}
                />

                {saveError && (
                  <Typography color="error" variant="body2">
                    {saveError}
                  </Typography>
                )}
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              disabled={isSaving}
              onClick={() => {
                void handleAddCasual();
              }}
            >
              {isSaving ? "Saving..." : "Add Shift"}
            </Button>
            <Button onClick={handleCloseAddDialog} disabled={isSaving}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={editCasualDialogOpen} onClose={handleCloseEditDialog}>
          <DialogTitle>Edit Casual</DialogTitle>
          <DialogContent>
            <Box sx={{ py: 1 }}>
              <Stack direction={"column"} spacing={2}>
                <TextField
                  label="Casual Name"
                  variant="outlined"
                  sx={{ mt: 2 }}
                  value={newEditCasualName || ""}
                  onChange={(e) => setNewEditCasualName(e.target.value)}
                />

                {saveError && (
                  <Typography color="error" variant="body2">
                    {saveError}
                  </Typography>
                )}
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              disabled={isSaving}
              onClick={() => {
                void handleEditCasual();
              }}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button onClick={handleCloseEditDialog} disabled={isSaving}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}
