/**
 * Schedule.tsx
 * Colin Brown May 20, 2026
 */

import React from "react";
import {
  Avatar,
  Box,
  Button,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Typography,
  Snackbar,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import EditIcon from "@mui/icons-material/Edit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Link as RouterLink } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import { queryRows, runSql } from "../db/sqlite";
import {
  generateScheduleForMonday,
  getScheduleAssignmentsByMonday,
  getScheduleIdByMonday,
  type ScheduleAssignmentRow,
} from "../db/schedule";

type CasualRow = {
  id: number;
  name: string;
};

type ScheduleShiftGroup = {
  key: string;
  title: string;
  branchId: number | null;
  branchName: string;
  rows: ScheduleAssignmentRow[];
};

type ScheduleStatsRow = {
  id: number;
  name: string;
  shiftCount: number;
  minutesAssigned: number;
};

export default function Schedule({
  selectedWeekStart,
}: {
  selectedWeekStart: Dayjs | null;
}) {
  const [hasScheduleForWeek, setHasScheduleForWeek] = React.useState(false);
  const [scheduleRows, setScheduleRows] = React.useState<
    ScheduleAssignmentRow[]
  >([]);
  const [casuals, setCasuals] = React.useState<CasualRow[]>([]);
  const [displayBy, setDisplayBy] = React.useState<"branch" | "casual">(
    () =>
      (localStorage.getItem("scheduleDisplayBy") as "branch" | "casual") ||
      "branch",
  );
  const [isWorking, setIsWorking] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [copyMessage, setCopyMessage] = React.useState<string | null>(null);
  const [confirmRerollOpen, setConfirmRerollOpen] = React.useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = React.useState(false);
  const [selectedShift, setSelectedShift] =
    React.useState<ScheduleAssignmentRow | null>(null);
  const [selectedCasualId, setSelectedCasualId] = React.useState<number | null>(
    null,
  );

  const getWeekStart = (date: Dayjs | null) => {
    if (!date) {
      return null;
    }

    const monday = date.clone().startOf("week").add(1, "day");

    return date.day() === 0 ? monday.subtract(7, "day") : monday;
  };

  const getMondayString = () =>
    getWeekStart(selectedWeekStart)?.format("YYYY-MM-DD");

  React.useEffect(() => {
    try {
      localStorage.setItem("scheduleDisplayBy", displayBy);
    } catch (error) {
      // ignore browser storage errors
    }
  }, [displayBy]);

  const loadScheduleForWeek = React.useCallback(async () => {
    const monday = getMondayString();

    if (!monday) {
      setHasScheduleForWeek(false);
      setScheduleRows([]);
      return;
    }

    try {
      const scheduleId = await getScheduleIdByMonday(monday);
      setHasScheduleForWeek(Boolean(scheduleId));

      if (!scheduleId) {
        setScheduleRows([]);
        return;
      }

      const rows = await getScheduleAssignmentsByMonday(monday);
      setScheduleRows(rows.filter((row) => row.shiftId));
      setErrorMsg(null);
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Failed to load schedule",
      );
    }
  }, [selectedWeekStart]);

  React.useEffect(() => {
    void loadScheduleForWeek();
  }, [loadScheduleForWeek]);

  const getShiftMinutes = (row: ScheduleAssignmentRow) => {
    const [startHour, startMinute] = row.shiftStartTime.split(":").map(Number);
    const [endHour, endMinute] = row.shiftEndTime.split(":").map(Number);
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;

    return endTotal >= startTotal
      ? endTotal - startTotal
      : 24 * 60 - startTotal + endTotal;
  };

  React.useEffect(() => {
    let isActive = true;

    async function loadCasuals() {
      try {
        const rows = await queryRows<CasualRow>(
          `
            SELECT id, name
            FROM Casual
            ORDER BY name
          `,
        );

        if (isActive) {
          setCasuals(rows);
        }
      } catch (error) {
        if (isActive) {
          setErrorMsg(
            error instanceof Error ? error.message : "Failed to load casuals",
          );
        }
      }
    }

    void loadCasuals();

    return () => {
      isActive = false;
    };
  }, []);

  const weekStart = getWeekStart(selectedWeekStart);
  const weekEnd = weekStart?.add(6, "day");

  const assignedStats = React.useMemo<ScheduleStatsRow[]>(() => {
    const statsByCasualId = new Map<number, ScheduleStatsRow>();

    for (const casual of casuals) {
      statsByCasualId.set(casual.id, {
        id: casual.id,
        name: casual.name,
        shiftCount: 0,
        minutesAssigned: 0,
      });
    }

    for (const row of scheduleRows) {
      if (!row.casualId) {
        continue;
      }

      const current = statsByCasualId.get(row.casualId);

      if (!current) {
        continue;
      }

      current.shiftCount += 1;
      current.minutesAssigned += getShiftMinutes(row);
    }

    return Array.from(statsByCasualId.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [casuals, scheduleRows]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) {
      return `${remainingMinutes}m`;
    }

    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  };

  const generateSchedule = async () => {
    const monday = getMondayString();

    if (!monday) {
      setErrorMsg("Please choose a week first");
      return;
    }

    setIsWorking(true);
    setErrorMsg(null);

    try {
      await generateScheduleForMonday(monday);
      await loadScheduleForWeek();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Failed to generate schedule",
      );
    } finally {
      setIsWorking(false);
      setConfirmRerollOpen(false);
    }
  };

  const openAssignmentDialog = (row: ScheduleAssignmentRow) => {
    setSelectedShift(row);
    setSelectedCasualId(row.casualId);
    setAssignmentDialogOpen(true);
    setErrorMsg(null);
  };

  const closeAssignmentDialog = () => {
    setAssignmentDialogOpen(false);
    setSelectedShift(null);
    setSelectedCasualId(null);
  };

  const saveAssignment = async () => {
    if (!selectedShift) {
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await runSql(
        `
          UPDATE ScheduleShift
          SET casual_id = ?
          WHERE schedule_id = ? AND shift_id = ?
        `,
        [selectedCasualId, selectedShift.scheduleId, selectedShift.shiftId],
      );

      await loadScheduleForWeek();
      closeAssignmentDialog();
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Failed to update assignment",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getSectionsByBranch = (): ScheduleShiftGroup[] => {
    const grouped = new Map<number | null, ScheduleShiftGroup>();

    for (const row of scheduleRows) {
      const key = row.branchId;
      const existing = grouped.get(key);

      if (existing) {
        existing.rows.push(row);
        continue;
      }

      grouped.set(key, {
        key: String(key ?? "unassigned"),
        title: row.branchName || "Unassigned branch",
        branchId: row.branchId,
        branchName: row.branchName || "Unassigned branch",
        rows: [row],
      });
    }

    return Array.from(grouped.values()).map((section) => ({
      ...section,
      rows: section.rows.sort((a, b) => {
        const dateCompare = a.shiftDate.localeCompare(b.shiftDate);
        if (dateCompare !== 0) {
          return dateCompare;
        }

        const startCompare = a.shiftStartTime.localeCompare(b.shiftStartTime);
        if (startCompare !== 0) {
          return startCompare;
        }

        return a.shiftEndTime.localeCompare(b.shiftEndTime);
      }),
    }));
  };

  const getSectionsByCasual = (): ScheduleShiftGroup[] => {
    const grouped = new Map<number | null, ScheduleShiftGroup>();

    for (const row of scheduleRows) {
      const key = row.casualId;
      const existing = grouped.get(key);
      const label = row.casualName || "Unassigned";

      if (existing) {
        existing.rows.push(row);
        continue;
      }

      grouped.set(key, {
        key: String(key ?? "unassigned"),
        title: label,
        branchId: null,
        branchName: label,
        rows: [row],
      });
    }

    if (!grouped.has(null)) {
      grouped.set(null, {
        key: "unassigned",
        title: "Unassigned",
        branchId: null,
        branchName: "Unassigned",
        rows: scheduleRows.filter((row) => !row.casualId),
      });
    }

    return Array.from(grouped.values())
      .filter((section) => section.rows.length > 0)
      .map((section) => ({
        ...section,
        rows: section.rows.sort((a, b) => {
          const dateCompare = a.shiftDate.localeCompare(b.shiftDate);
          if (dateCompare !== 0) {
            return dateCompare;
          }

          const startCompare = a.shiftStartTime.localeCompare(b.shiftStartTime);
          if (startCompare !== 0) {
            return startCompare;
          }

          return a.shiftEndTime.localeCompare(b.shiftEndTime);
        }),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  };

  const buildBranchEmailText = (branchRows: ScheduleAssignmentRow[]) => {
    if (!weekStart || !weekEnd) {
      return "";
    }

    const branchName = branchRows[0]?.branchName || "Branch";

    const rowsByDate = new Map<string, ScheduleAssignmentRow[]>();
    for (const row of branchRows) {
      const existing = rowsByDate.get(row.shiftDate) || [];
      rowsByDate.set(row.shiftDate, [...existing, row]);
    }

    const lines: string[] = [];

    branchRows.length > 1
      ? lines.push(`Here are the casuals coming to ${branchName} next week!\n`)
      : lines.push(`Here is the casual coming to ${branchName} next week!\n`);

    for (const date of Array.from(rowsByDate.keys()).sort((a, b) =>
      a.localeCompare(b),
    )) {
      lines.push(dayjs(date).format("dddd MMM D:"));
      const rows = rowsByDate.get(date) || [];

      for (const row of rows) {
        lines.push(
          `${row.casualName || "Unassigned"}: ${dayjs(`1900-01-01T${row.shiftStartTime}`).format("h:mm A")} to ${dayjs(`1900-01-01T${row.shiftEndTime}`).format("h:mm A")}`,
        );
      }

      lines.push("");
    }

    return lines.join("\n").trim();
  };

  const copyBranchEmail = async (branchRows: ScheduleAssignmentRow[]) => {
    const text = buildBranchEmailText(branchRows);

    if (!text) {
      setCopyMessage("Unable to copy email text.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(
        `Copied ${branchRows[0]?.branchName || "branch"} email text.`,
      );
    } catch (error) {
      setCopyMessage(
        error instanceof Error ? error.message : "Failed to copy email text.",
      );
    }
  };

  const branchSections = getSectionsByBranch();
  const casualSections = getSectionsByCasual();

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
          <Stack direction={"column"} spacing={1}>
            <Typography variant="h4">Schedule</Typography>
            <Box>
              <Button
                variant="contained"
                disabled={isWorking}
                onClick={() => {
                  if (hasScheduleForWeek) {
                    setConfirmRerollOpen(true);
                  } else {
                    void generateSchedule();
                  }
                }}
              >
                {isWorking
                  ? "Working..."
                  : hasScheduleForWeek
                    ? "Reroll Schedule"
                    : "Generate Schedule"}
              </Button>
            </Box>
          </Stack>
          <FormControl>
            <FormLabel id="schedule-display-by-label">Display by:</FormLabel>
            <RadioGroup
              aria-labelledby="schedule-display-by-label"
              value={displayBy}
              onChange={(event) =>
                setDisplayBy(event.target.value as "branch" | "casual")
              }
              row
            >
              <FormControlLabel
                value="branch"
                control={<Radio />}
                label="Branch"
              />
              <FormControlLabel
                value="casual"
                control={<Radio />}
                label="Casual"
              />
            </RadioGroup>
          </FormControl>
        </Stack>

        {errorMsg ? (
          <Typography color="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Typography>
        ) : null}

        {!hasScheduleForWeek ? (
          <Typography color="text.secondary">
            No schedule generated for this week.
          </Typography>
        ) : (
          <Stack spacing={2}>
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Schedule Stats
              </Typography>
              <Grid container spacing={1.5}>
                {assignedStats.map((stat) => (
                  <Grid
                    size={{ xs: 6, sm: 4, md: 3, lg: 2, xl: 1.5 }}
                    key={stat.id}
                  >
                    <Box
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 1.25,
                      }}
                    >
                      <Typography variant="subtitle1">{stat.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stat.shiftCount} shift
                        {stat.shiftCount === 1 ? "" : "s"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatMinutes(stat.minutesAssigned)}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {displayBy === "branch" ? (
              <Stack spacing={2}>
                {branchSections.map((section) => (
                  <Box
                    key={section.key}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1.5,
                        gap: 1,
                      }}
                    >
                      <Typography variant="h6">{section.title}</Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => {
                          void copyBranchEmail(section.rows);
                        }}
                      >
                        Copy Email
                      </Button>
                    </Stack>
                    <Grid container spacing={1.5}>
                      {section.rows.map((row) => (
                        <Grid
                          size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}
                          key={row.shiftId}
                        >
                          <Box
                            sx={{
                              border: "solid",
                              borderColor: "divider",
                              borderWidth: "1px",
                              borderRadius: "3px",
                              padding: "10px",
                            }}
                          >
                            <Stack
                              direction="row"
                              sx={{ justifyContent: "space-between", gap: 1 }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1">
                                  {dayjs(row.shiftDate).format("ddd MMM D")}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {dayjs(
                                    `1900-01-01T${row.shiftStartTime}`,
                                  ).format("h:mm A")}{" "}
                                  -{" "}
                                  {dayjs(
                                    `1900-01-01T${row.shiftEndTime}`,
                                  ).format("h:mm A")}
                                </Typography>
                              </Box>
                              <Box>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<EditIcon />}
                                  onClick={() => {
                                    openAssignmentDialog(row);
                                  }}
                                >
                                  Edit
                                </Button>
                              </Box>
                            </Stack>
                            <Divider sx={{ my: 1 }} />
                            <Typography
                              sx={{
                                color: !row.casualName
                                  ? "error.main"
                                  : "text.primary",
                              }}
                            >
                              {row.casualName || "Unassigned"}
                              {row.lockedCasualId &&
                              row.casualId === row.lockedCasualId
                                ? " (Locked)"
                                : row.lockedCasualId
                                  ? " (Locked to someone else)"
                                  : ""}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Grid container spacing={2}>
                {casualSections.map((section) => (
                  <Grid
                    size={{ xs: 12, lg: 6 }}
                    key={section.key}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <Stack
                      direction={"row"}
                      spacing={1}
                      sx={{ alignItems: "center", mb: 1 }}
                    >
                      {section.title !== "Unassigned" && (
                        <Avatar sx={{ width: 40, height: 40, flexShrink: 0 }}>
                          {section.title.charAt(0).toUpperCase()}
                        </Avatar>
                      )}
                      <Typography
                        variant="h6"
                        sx={{
                          mb: 1.5,
                          color:
                            section.title === "Unassigned"
                              ? "error.main"
                              : "text.primary",
                        }}
                      >
                        {section.title}
                      </Typography>
                    </Stack>
                    <Grid container spacing={1.5}>
                      {section.rows.map((row) => (
                        <Grid
                          size={{ xs: 12, sm: 6, md: 4, lg: 6 }}
                          key={row.shiftId}
                        >
                          <Box
                            sx={{
                              border: "solid",
                              borderColor: "divider",
                              borderWidth: "1px",
                              borderRadius: "3px",
                              padding: "10px",
                            }}
                          >
                            <Stack
                              direction="row"
                              sx={{ justifyContent: "space-between", gap: 1 }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1">
                                  {row.branchName}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {dayjs(row.shiftDate).format("ddd MMM D")}:{" "}
                                  {dayjs(
                                    `1900-01-01T${row.shiftStartTime}`,
                                  ).format("h:mm A")}{" "}
                                  -{" "}
                                  {dayjs(
                                    `1900-01-01T${row.shiftEndTime}`,
                                  ).format("h:mm A")}
                                </Typography>
                              </Box>
                              <Box>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<EditIcon />}
                                  onClick={() => {
                                    openAssignmentDialog(row);
                                  }}
                                >
                                  Shift
                                </Button>
                              </Box>
                            </Stack>
                            {row.lockedCasualId && (
                              <>
                                <Divider sx={{ my: 1 }} />
                                <Typography>
                                  {row.casualId === row.lockedCasualId
                                    ? " (Locked)"
                                    : row.lockedCasualId
                                      ? " (Locked to someone else)"
                                      : ""}
                                </Typography>
                              </>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>
        )}

        <Dialog
          open={confirmRerollOpen}
          onClose={() => {
            setConfirmRerollOpen(false);
          }}
        >
          <DialogTitle>Reroll Schedule?</DialogTitle>
          <DialogContent>
            <Typography>
              This will overwrite the current generated schedule for this week.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setConfirmRerollOpen(false);
              }}
              disabled={isWorking}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={isWorking}
              onClick={() => {
                void generateSchedule();
              }}
            >
              Reroll
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(copyMessage)}
          autoHideDuration={3500}
          onClose={(_, reason) => {
            if (reason === "clickaway") {
              return;
            }

            setCopyMessage(null);
          }}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => {
              setCopyMessage(null);
            }}
            severity="success"
            variant="filled"
            sx={{ width: "100%" }}
          >
            {copyMessage}
          </Alert>
        </Snackbar>

        <Dialog
          open={assignmentDialogOpen}
          onClose={closeAssignmentDialog}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            Edit assignment for {selectedShift?.branchName || "shift"}
          </DialogTitle>
          <DialogContent>
            {selectedShift ? (
              <Box>
                <Typography sx={{ mb: 1 }}>
                  {dayjs(selectedShift.shiftDate).format("ddd MMM D")}{" "}
                  {dayjs(`1900-01-01T${selectedShift.shiftStartTime}`).format(
                    "h:mm A",
                  )}{" "}
                  -{" "}
                  {dayjs(`1900-01-01T${selectedShift.shiftEndTime}`).format(
                    "h:mm A",
                  )}
                </Typography>
                {selectedShift.lockedCasualId ? (
                  <Typography color="text.secondary" sx={{ mb: 1 }}>
                    This shift is locked. You can still change the schedule
                    assignment.
                  </Typography>
                ) : null}
                <FormControl fullWidth>
                  <InputLabel id="assignment-casual-label">
                    Assigned casual
                  </InputLabel>
                  <Select
                    labelId="assignment-casual-label"
                    label="Assigned casual"
                    value={
                      selectedCasualId === null ? "" : String(selectedCasualId)
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedCasualId(value === "" ? null : Number(value));
                    }}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {casuals.map((casual) => (
                      <MenuItem key={casual.id} value={String(casual.id)}>
                        {casual.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeAssignmentDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                void saveAssignment();
              }}
              disabled={isSaving || !selectedShift}
            >
              {isSaving ? "Saving..." : "Save Assignment"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}
