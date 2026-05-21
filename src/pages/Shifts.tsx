/**
 * Shifts.tsx
 * Colin Brown May 10, 2026
 */

import React from "react";
import {
  Box,
  Button,
  Chip,
  Select,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs, { Dayjs } from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import HomeIcon from "@mui/icons-material/Home";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import { Link as RouterLink } from "react-router-dom";
import { queryRows, runSql } from "../db/sqlite";

type BranchRow = {
  id: number;
  name: string;
};

type BranchShiftCountRow = {
  id: number;
  shiftCount: number;
};

type ShiftRow = {
  id: number;
  branch_id: number;
  date: string;
  startTime: string;
  endTime: string;
};

type ShiftCountRow = {
  shiftCount: number;
};

export default function Shifts({
  selectedWeekStart,
}: {
  selectedWeekStart: Dayjs | null;
}) {
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchCounts, setBranchCounts] = React.useState<BranchShiftCountRow[]>(
    [],
  );
  const [shifts, setShifts] = React.useState<ShiftRow[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [addShiftDialogOpen, setAddShiftDialogOpen] = React.useState(false);
  const [selectedBranchId, setSelectedBranchId] = React.useState<number | null>(
    null,
  );
  const [selectedWeekDay, setSelectedWeekDay] = React.useState<Dayjs | null>(
    null,
  );
  const [shiftStartTime, setShiftStartTime] = React.useState<Dayjs | null>(
    dayjs(),
  );
  const [shiftEndTime, setShiftEndTime] = React.useState<Dayjs | null>(dayjs());
  const [editingShiftId, setEditingShiftId] = React.useState<number | null>(
    null,
  );
  const [deleteShiftDialogOpen, setDeleteShiftDialogOpen] =
    React.useState(false);
  const [shiftToDelete, setShiftToDelete] = React.useState<ShiftRow | null>(
    null,
  );
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [shiftCount, setShiftCount] = React.useState<number | null>(null);
  const [displayBy, setDisplayBy] = React.useState<"branch" | "date">(
    () =>
      (localStorage.getItem("shiftsDisplayBy") as "branch" | "date") ||
      "branch",
  );

  React.useEffect(() => {
    async function loadShiftCount() {
      try {
        const shiftCountRows = await queryRows<ShiftCountRow>(
          `
              SELECT count(id) AS shiftCount 
              FROM shift 
              WHERE date > ? AND date < ?;
            `,
          [
            getWeekStart(selectedWeekStart)?.format("YYYY-MM-DD"),
            getWeekStart(selectedWeekStart)?.add(7, "day").format("YYYY-MM-DD"),
          ],
        );
        setShiftCount(shiftCountRows[0].shiftCount);
      } catch (error) {
        console.error("Error loading shift counts:", error);
      }
    }

    void loadShiftCount();
  }, [selectedWeekStart]);

  React.useEffect(() => {
    try {
      localStorage.setItem("shiftsDisplayBy", displayBy);
    } catch (e) {
      // ignore
    }
  }, [displayBy]);

  React.useEffect(() => {
    let isActive = true;

    async function loadBranches() {
      try {
        const branchRows = await queryRows<BranchRow>(
          `
            SELECT
              id,
              name
            FROM Branch
            ORDER BY Branch.name
          `,
        );

        const branchCountRows = await queryRows<BranchShiftCountRow>(
          `
            SELECT
              Branch.id,
              COUNT(Shift.id) AS shiftCount
            FROM Branch
            LEFT JOIN Shift ON Shift.branch_id = Branch.id
            WHERE date >= ? AND date < ?
            GROUP BY Branch.id, Branch.name
            ORDER BY Branch.name
        `,
          [
            getWeekStart(selectedWeekStart)?.format("YYYY-MM-DD"),
            getWeekStart(selectedWeekStart)?.add(7, "day").format("YYYY-MM-DD"),
          ],
        );

        if (isActive) {
          setBranches(branchRows);
          setBranchCounts(branchCountRows);
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

    void loadBranches();

    return () => {
      isActive = false;
    };
  }, [selectedWeekStart]);

  React.useEffect(() => {
    let isActive = true;

    async function loadShifts() {
      try {
        const rows = await queryRows<ShiftRow>(
          `
            SELECT
              id,
              date,
              start_time AS startTime,
              end_time AS endTime,
              branch_id
            FROM Shift
            WHERE date >= ? AND date < ?
            ORDER BY date, start_time
          `,
          [
            getWeekStart(selectedWeekStart)?.format("YYYY-MM-DD"),
            getWeekStart(selectedWeekStart)?.add(7, "day").format("YYYY-MM-DD"),
          ],
        );

        if (isActive) {
          setShifts(rows);
          setErrorMsg(null);
        }
      } catch (error) {
        if (isActive) {
          setErrorMsg(
            error instanceof Error ? error.message : "Failed to load shifts",
          );
        }
      }
    }

    void loadShifts();

    return () => {
      isActive = false;
      console.log(shifts);
    };
  }, [selectedWeekStart]);

  // Refresh the branchs and shifts shown, would ideally be in a try/catch statement
  const refreshData = async () => {
    try {
      const branchRows = await queryRows<BranchRow>(
        `
          SELECT
            id,
            name
          FROM Branch
          ORDER BY Branch.name
        `,
      );
      setBranches(branchRows);

      const branchCountRows = await queryRows<BranchShiftCountRow>(
        `
            SELECT
              Branch.id,
              COUNT(Shift.id) AS shiftCount
            FROM Branch
            LEFT JOIN Shift ON Shift.branch_id = Branch.id
            WHERE date >= ? AND date < ?
            GROUP BY Branch.id, Branch.name
            ORDER BY Branch.name
        `,
        [
          getWeekStart(selectedWeekStart)?.format("YYYY-MM-DD"),
          getWeekStart(selectedWeekStart)?.add(7, "day").format("YYYY-MM-DD"),
        ],
      );
      setBranchCounts(branchCountRows);

      const shiftRows = await queryRows<ShiftRow>(
        `
            SELECT
              id,
              date,
              start_time AS startTime,
              end_time AS endTime,
              branch_id
            FROM Shift
            WHERE date >= ? AND date < ?
            ORDER BY date, start_time
          `,
        [
          getWeekStart(selectedWeekStart)?.format("YYYY-MM-DD"),
          getWeekStart(selectedWeekStart)?.add(7, "day").format("YYYY-MM-DD"),
        ],
      );
      setShifts(shiftRows);

      const shiftCountRows = await queryRows<ShiftCountRow>(
        `
              SELECT count(id) AS shiftCount FROM Shift WHERE date > ? AND date < ?;
            `,
        [
          getWeekStart(selectedWeekStart)?.format("YYYY-MM-DD"),
          getWeekStart(selectedWeekStart)?.add(7, "day").format("YYYY-MM-DD"),
        ],
      );
      setShiftCount(shiftCountRows[0].shiftCount);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? "Database refresh error: " + error.message
          : "Database error. Failed to refresh data.",
      );
    }
  };

  const handleOpenAddShiftSortBranch = (branchId: number) => {
    setSelectedBranchId(branchId);
    setSelectedWeekDay(null);
    setEditingShiftId(null);
    setSaveError(null);
    setAddShiftDialogOpen(true);
  };

  const handleOpenAddShiftSortDay = (day: Dayjs) => {
    setSelectedBranchId(null);
    setSelectedWeekDay(day);
    setEditingShiftId(null);
    setSaveError(null);
    setAddShiftDialogOpen(true);
  };

  const handleOpenEditShift = (shift: ShiftRow) => {
    setSelectedBranchId(shift.branch_id);
    setSelectedWeekDay(dayjs(shift.date));
    setShiftStartTime(dayjs(`2000-01-01T${shift.startTime}`));
    setShiftEndTime(dayjs(`2000-01-01T${shift.endTime}`));
    setEditingShiftId(shift.id);
    setSaveError(null);
    setAddShiftDialogOpen(true);
  };

  const handleOpenDeleteShift = (shift: ShiftRow) => {
    setShiftToDelete(shift);
    setDeleteShiftDialogOpen(true);
  };

  const getWeekStart = (date: Dayjs | null) => {
    if (!date) {
      return null;
    }

    const monday = date.clone().startOf("week").add(1, "day");

    return date.day() === 0 ? monday.subtract(7, "day") : monday;
  };

  const getWeekDays = (date: Dayjs | null) => {
    const monday = getWeekStart(date);

    if (!monday) {
      return [];
    }

    const days = [];

    for (let i = 0; i < 7; i++) {
      days.push(monday.add(i, "day"));
    }

    return days;
  };

  const formatShiftTime = (time: string) => {
    const [hourText, minuteText] = time.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return time;
    }

    const hour12 = hour % 12 || 12;
    const period = hour < 12 ? "AM" : "PM";
    const paddedMinute = minute.toString().padStart(2, "0");

    return `${hour12}:${paddedMinute} ${period}`;
  };

  const handleAddShift = async () => {
    if (
      !selectedBranchId ||
      !selectedWeekDay ||
      !shiftStartTime ||
      !shiftEndTime
    ) {
      setSaveError("Please select a day and both times");
      return;
    }

    if (shiftEndTime.isBefore(shiftStartTime)) {
      setSaveError("Shift end time must be after the start time");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const shiftDateStr = selectedWeekDay.format("YYYY-MM-DD");
      const shiftStartStr = shiftStartTime.format("HH:mm");
      const shiftEndStr = shiftEndTime.format("HH:mm");
      if (editingShiftId !== null) {
        await runSql(
          `
            UPDATE Shift
            SET date = ?, start_time = ?, end_time = ?, branch_id = ?
            WHERE id = ?
          `,
          [
            shiftDateStr,
            shiftStartStr,
            shiftEndStr,
            selectedBranchId,
            editingShiftId,
          ],
        );
      } else {
        await runSql(
          `
            INSERT INTO Shift (date, start_time, end_time, branch_id)
            VALUES (?, ?, ?, ?)
          `,
          [shiftDateStr, shiftStartStr, shiftEndStr, selectedBranchId],
        );
      }

      setAddShiftDialogOpen(false);
      setSelectedWeekDay(null);
      setEditingShiftId(null);

      void refreshData();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to add shift",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveShift = async (rmId: number) => {
    try {
      await runSql(
        `DELETE FROM Shift 
      WHERE id = ?`,
        [rmId],
      );

      void refreshData();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Failed to remove shift",
      );
    }
  };

  const handleConfirmDeleteShift = async () => {
    if (!shiftToDelete) {
      return;
    }

    await handleRemoveShift(shiftToDelete.id);
    setDeleteShiftDialogOpen(false);
    setShiftToDelete(null);
  };

  const handleCloseDialog = () => {
    setAddShiftDialogOpen(false);
    setSaveError(null);
    setSelectedWeekDay(null);
    setSelectedBranchId(null);
    setEditingShiftId(null);
    setShiftStartTime(dayjs());
    setShiftEndTime(dayjs());
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
          <Button component={RouterLink} to="/" startIcon={<HomeIcon />}>
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
          direction="row"
          sx={{ justifyContent: "space-between", spacing: 2, mb: 2 }}
        >
          <Stack direction={"column"}>
            <Typography variant="h4" sx={{ mb: 0 }}>
              Shifts
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: "nowrap" }}>
              Shifts this week:{" "}
              {shiftCount !== null ? shiftCount : "Loading..."}
            </Typography>
          </Stack>
          <FormControl>
            <FormLabel id="display-by-label">Display by:</FormLabel>
            <RadioGroup
              aria-labelledby="display-by-label"
              value={displayBy}
              onChange={(e) =>
                setDisplayBy(e.target.value as "branch" | "date")
              }
              row
            >
              <FormControlLabel
                value="branch"
                control={<Radio />}
                label="Branch"
              />
              <FormControlLabel value="date" control={<Radio />} label="Date" />
            </RadioGroup>
          </FormControl>
        </Stack>

        <Box sx={{ mb: 2 }}>
          <LocalizationProvider
            dateAdapter={AdapterDayjs}
          ></LocalizationProvider>
        </Box>

        {errorMsg ? (
          <Typography color="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Typography>
        ) : null}

        {displayBy === "branch" ? (
          <Grid container spacing={2}>
            {branches.map((branch) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={branch.id}>
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
                    sx={{ spacing: 2, justifyContent: "space-between" }}
                  >
                    <Stack direction={"column"}>
                      <Typography sx={{ fontWeight: "3em" }}>
                        {branch.name}
                      </Typography>
                      <Typography variant="body2">
                        {branchCounts.find((bc) => bc.id === branch.id)
                          ?.shiftCount || 0}{" "}
                        scheduled shift
                        {(branchCounts.find((bc) => bc.id === branch.id)
                          ?.shiftCount || 0) === 1
                          ? ""
                          : "s"}
                      </Typography>
                    </Stack>
                    <Box>
                      <Button
                        variant="contained"
                        onClick={() => handleOpenAddShiftSortBranch(branch.id)}
                        startIcon={<AddIcon />}
                        size="small"
                      >
                        Shift
                      </Button>
                    </Box>
                  </Stack>
                  {branchCounts.find((bc) => bc.id === branch.id)
                    ?.shiftCount && <Divider sx={{ mt: 1.5, mb: 0.5 }} />}
                  <Box>
                    {shifts.map((shift) => (
                      <React.Fragment key={shift.id}>
                        {branch.id === shift.branch_id && (
                          <Stack
                            direction={"row"}
                            sx={{
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Typography>
                              {dayjs(shift.date).format("ddd MMM D")}
                              {": "}
                              {formatShiftTime(shift.startTime)}
                              {" - "}
                              {formatShiftTime(shift.endTime)}
                            </Typography>
                            <Stack direction={"row"} spacing={0.25}>
                              <Tooltip title="Edit Shift">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => {
                                    handleOpenEditShift(shift);
                                  }}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Remove Shift">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    handleOpenDeleteShift(shift);
                                  }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        )}
                      </React.Fragment>
                    ))}
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={2}>
            {getWeekDays(selectedWeekStart).map((day) => {
              const dateKey = day.format("YYYY-MM-DD");
              const shiftsForDate = shifts.filter((s) => s.date === dateKey);
              return (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={dateKey}>
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
                      sx={{ spacing: 2, justifyContent: "space-between" }}
                    >
                      <Stack direction={"column"}>
                        <Typography sx={{ fontWeight: "3em" }}>
                          {day.format("ddd MMM D")}
                        </Typography>
                        <Typography variant="body2">
                          {shiftsForDate.length} scheduled shift
                          {shiftsForDate.length === 1 ? "" : "s"}
                        </Typography>
                      </Stack>
                      <Box>
                        <Button
                          variant="contained"
                          onClick={() => handleOpenAddShiftSortDay(day)}
                          startIcon={<AddIcon />}
                          size="small"
                        >
                          Shift
                        </Button>
                      </Box>
                    </Stack>
                    {shiftsForDate.length > 0 && (
                      <Divider sx={{ mt: 1.5, mb: 0.5, color: "border" }} />
                    )}
                    <Box>
                      {shiftsForDate.map((shift) => (
                        <React.Fragment key={shift.id}>
                          <Stack
                            direction={"row"}
                            sx={{
                              justifyContent: "space-between",
                              alignItems: "center",
                              mt: 1,
                            }}
                          >
                            <Typography>
                              {branches.find((b) => b.id === shift.branch_id)
                                ?.name || "Branch"}
                              {": "}
                              {formatShiftTime(shift.startTime)} -{" "}
                              {formatShiftTime(shift.endTime)}
                            </Typography>
                            <Stack direction="row" spacing={0.25}>
                              <Tooltip title="Edit Shift">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => {
                                    handleOpenEditShift(shift);
                                  }}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Remove Shift">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    handleOpenDeleteShift(shift);
                                  }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        </React.Fragment>
                      ))}
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
        <Dialog open={addShiftDialogOpen} onClose={handleCloseDialog}>
          <DialogTitle>
            {editingShiftId ? "Edit Shift" : "Add Shift"} to{" "}
            {displayBy === "branch"
              ? selectedBranchId
                ? branches.find((b) => b.id === selectedBranchId)?.name
                : ""
              : selectedWeekDay
                ? selectedWeekDay.format("ddd MMM D")
                : ""}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ py: 1 }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Stack direction={"column"} spacing={2}>
                  {displayBy === "branch" ? (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 2 }}>
                        Select Day of Week
                      </Typography>
                      <Stack
                        direction="row"
                        sx={{
                          flexWrap: "wrap",
                          gap: "4px",
                          alignItems: "flex-start",
                        }}
                      >
                        {getWeekDays(selectedWeekStart).map((day) => (
                          <Chip
                            key={day.format("YYYY-MM-DD")}
                            label={day.format("ddd MMM D")}
                            onClick={() => setSelectedWeekDay(day)}
                            variant={
                              selectedWeekDay?.format("YYYY-MM-DD") ===
                              day.format("YYYY-MM-DD")
                                ? "filled"
                                : "outlined"
                            }
                            color={
                              selectedWeekDay?.format("YYYY-MM-DD") ===
                              day.format("YYYY-MM-DD")
                                ? "primary"
                                : "default"
                            }
                            sx={{}}
                          />
                        ))}
                      </Stack>
                    </>
                  ) : (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 2 }}>
                        Select Branch for {selectedWeekDay?.format("ddd MMM D")}
                      </Typography>
                      <Select
                        value={selectedBranchId ?? ""}
                        onChange={(e) =>
                          setSelectedBranchId(Number(e.target.value))
                        }
                        displayEmpty
                      >
                        <MenuItem value="">Choose branch</MenuItem>
                        {branches.map((b) => (
                          <MenuItem key={b.id} value={b.id}>
                            {b.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </>
                  )}
                  <TimePicker
                    label="Shift Start Time"
                    value={shiftStartTime}
                    onChange={(newValue) => setShiftStartTime(newValue)}
                  />
                  <TimePicker
                    label="Shift End Time"
                    value={shiftEndTime}
                    onChange={(newValue) => setShiftEndTime(newValue)}
                  />
                  {saveError && (
                    <Typography color="error" variant="body2">
                      {saveError}
                    </Typography>
                  )}
                </Stack>
              </LocalizationProvider>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              disabled={isSaving}
              onClick={() => {
                void handleAddShift();
              }}
            >
              {isSaving
                ? "Saving..."
                : editingShiftId
                  ? "Save Changes"
                  : "Add Shift"}
            </Button>
            <Button onClick={handleCloseDialog} disabled={isSaving}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={deleteShiftDialogOpen}
          onClose={() => {
            setDeleteShiftDialogOpen(false);
            setShiftToDelete(null);
          }}
        >
          <DialogTitle>Delete Shift?</DialogTitle>
          <DialogContent>
            <Typography>
              Delete{" "}
              {shiftToDelete
                ? `${branches.find((b) => b.id === shiftToDelete.branch_id)?.name ?? "Branch"} on ${dayjs(shiftToDelete.date).format("ddd MMM D")} from ${formatShiftTime(shiftToDelete.startTime)} to ${formatShiftTime(shiftToDelete.endTime)}`
                : "this shift"}
              ?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              color="error"
              variant="contained"
              onClick={() => void handleConfirmDeleteShift()}
            >
              Delete
            </Button>
            <Button
              onClick={() => {
                setDeleteShiftDialogOpen(false);
                setShiftToDelete(null);
              }}
            >
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}
