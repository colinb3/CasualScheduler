/**
 * Availability.tsx
 * Colin Brown May 18, 2026
 */

import React from "react";
import {
  Box,
  Button,
  Checkbox,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography,
  Avatar,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  RadioGroup,
  Radio,
  Divider,
  Tooltip,
  Snackbar,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import { queryRows, runSql } from "../db/sqlite";
import {
  generateScheduleForMonday,
  getScheduleIdByMonday,
} from "../db/schedule";

type CasualRow = {
  id: number;
  name: string;
};

type AvailabilityRow = {
  id: number;
  casualId: number;
  casualName: string;
  shiftId: number;
  shiftDate: string;
  startTime: string;
  endTime: string;
  branchName: string;
};

type ShiftRow = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  branchName: string;
  branchId: number;
  lockedCasualId: number | null;
};

type ShiftGroup = {
  key: string;
  title: string;
  shifts: ShiftRow[];
};

type AvailabilityDialogTarget =
  | { kind: "casual"; id: number }
  | { kind: "shift"; id: number };

export default function Availability({
  selectedWeekStart,
}: {
  selectedWeekStart: Dayjs | null;
}) {
  const navigate = useNavigate();
  const [displayBy, setDisplayBy] = React.useState<"casual" | "shift">(
    () =>
      (localStorage.getItem("availabilityDisplayBy") as "casual" | "shift") ||
      "casual",
  );
  const [casuals, setCasuals] = React.useState<CasualRow[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [addAvailDialogOpen, setAddAvailDialogOpen] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [availabilities, setAvailabilities] = React.useState<AvailabilityRow[]>(
    [],
  );
  const [shifts, setShifts] = React.useState<ShiftRow[]>([]);
  const [shiftDisplayBy, setShiftDisplayBy] = React.useState<"date" | "branch">(
    () =>
      (localStorage.getItem("availabilityShiftDisplayBy") as
        | "date"
        | "branch") || "date",
  );
  const [dialogTarget, setDialogTarget] =
    React.useState<AvailabilityDialogTarget | null>(null);
  const [selectedShiftIds, setSelectedShiftIds] = React.useState<number[]>([]);
  const [selectedCasualIds, setSelectedCasualIds] = React.useState<number[]>(
    [],
  );
  const [hasScheduleForWeek, setHasScheduleForWeek] = React.useState(false);
  const [isScheduleActionLoading, setIsScheduleActionLoading] =
    React.useState(false);
  const [lockMessage, setLockMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      localStorage.setItem("availabilityDisplayBy", displayBy);
    } catch (error) {
      // ignore browser storage errors
    }
  }, [displayBy]);

  React.useEffect(() => {
    let isActive = true;

    async function loadCasual() {
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

  React.useEffect(() => {
    let isActive = true;

    const weekStart = getWeekStart(selectedWeekStart);
    const weekEnd = weekStart?.add(7, "day");

    async function loadAvailability() {
      try {
        const rows = await queryRows<AvailabilityRow>(
          `
            SELECT 
            Available.id AS id, 
            Available.casual_id AS casualId, 
            Available.shift_id AS shiftId,
            Casual.name AS casualName,
            Shift.date AS shiftDate,
            Shift.start_time AS startTime, 
            Shift.end_time AS endTime, 
            Branch.name AS branchName
            FROM Available 
            LEFT JOIN Shift ON Shift.id = Available.shift_id
            LEFT JOIN Branch ON Shift.branch_id = Branch.id
            LEFT JOIN Casual ON Casual.id = Available.casual_id
              WHERE Shift.date >= ? AND Shift.date < ?
              ORDER BY Branch.name, Shift.date, Shift.start_time, Shift.end_time, Casual.name;
          `,
          [
            weekStart?.format("YYYY-MM-DD") || null,
            weekEnd?.format("YYYY-MM-DD") || null,
          ],
        );

        if (isActive) {
          setAvailabilities(rows);
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

    void loadAvailability();

    return () => {
      isActive = false;
    };
  }, [selectedWeekStart]);

  React.useEffect(() => {
    let isActive = true;

    const weekStart = getWeekStart(selectedWeekStart);
    const weekEnd = weekStart?.add(7, "day");

    async function loadShifts() {
      try {
        const rows = await queryRows<ShiftRow>(
          `
            SELECT Shift.id, 
            Shift.date, 
            Shift.start_time AS startTime, 
            Shift.end_time as endTime,
            Branch.name as branchName,
            Shift.branch_id as branchId,
            Shift.locked AS lockedCasualId
            FROM Shift 
            LEFT JOIN Branch ON Shift.branch_id = Branch.id
            WHERE Shift.date >= ? AND Shift.date < ?
              ORDER BY Branch.name, Shift.date, Shift.start_time, Shift.end_time;
          `,
          [
            weekStart?.format("YYYY-MM-DD") || null,
            weekEnd?.format("YYYY-MM-DD") || null,
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
    };
  }, [selectedWeekStart]);

  React.useEffect(() => {
    let isActive = true;

    async function loadScheduleStatus() {
      const monday = getWeekStart(selectedWeekStart)?.format("YYYY-MM-DD");

      if (!monday) {
        if (isActive) {
          setHasScheduleForWeek(false);
        }
        return;
      }

      try {
        const scheduleId = await getScheduleIdByMonday(monday);

        if (isActive) {
          setHasScheduleForWeek(Boolean(scheduleId));
        }
      } catch (error) {
        if (isActive) {
          setErrorMsg(
            error instanceof Error
              ? error.message
              : "Failed to load schedule status",
          );
        }
      }
    }

    void loadScheduleStatus();

    return () => {
      isActive = false;
    };
  }, [selectedWeekStart]);

  React.useEffect(() => {
    try {
      localStorage.setItem("availabilityShiftDisplayBy", shiftDisplayBy);
    } catch (error) {
      // ignore browser storage errors
    }
  }, [shiftDisplayBy]);

  const refreshData = async () => {
    try {
      const weekStart = getWeekStart(selectedWeekStart);
      const weekEnd = weekStart?.add(7, "day");

      const casualRows = await queryRows<CasualRow>(
        `
            SELECT id, name
            FROM Casual
            ORDER BY name
          `,
      );
      setCasuals(casualRows);

      const availRows = await queryRows<AvailabilityRow>(
        `
            SELECT 
            Available.id AS id, 
            Available.casual_id AS casualId, 
            Available.shift_id AS shiftId,
            Casual.name AS casualName,
            Shift.date AS shiftDate,
            Shift.start_time AS startTime, 
            Shift.end_time AS endTime, 
            Branch.name AS branchName
            FROM Available 
            LEFT JOIN Shift ON Shift.id = Available.shift_id
            LEFT JOIN Branch ON Shift.branch_id = Branch.id
            LEFT JOIN Casual ON Casual.id = Available.casual_id
            WHERE Shift.date >= ? AND Shift.date < ?
            ORDER BY Branch.name, Shift.date, Shift.start_time, Shift.end_time, Casual.name;
          `,
        [
          weekStart?.format("YYYY-MM-DD") || null,
          weekEnd?.format("YYYY-MM-DD") || null,
        ],
      );
      setAvailabilities(availRows);

      const shiftRows = await queryRows<ShiftRow>(
        `
            SELECT Shift.id, 
            Shift.date, 
            Shift.start_time AS startTime, 
            Shift.end_time as endTime,
            Branch.name as branchName,
            Shift.branch_id as branchId,
            Shift.locked AS lockedCasualId
            FROM Shift 
            LEFT JOIN Branch ON Shift.branch_id = Branch.id
            WHERE Shift.date >= ? AND Shift.date < ?
            ORDER BY Branch.name, Shift.date, Shift.start_time, Shift.end_time;
          `,
        [
          weekStart?.format("YYYY-MM-DD") || null,
          weekEnd?.format("YYYY-MM-DD") || null,
        ],
      );
      setShifts(shiftRows);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? "Database refresh error: " + error.message
          : "Database error. Failed to refresh data.",
      );
    }
  };

  const getWeekStart = (date: Dayjs | null) => {
    if (!date) {
      return null;
    }

    const monday = date.clone().startOf("week").add(1, "day");

    return date.day() === 0 ? monday.subtract(7, "day") : monday;
  };

  const handleOpenAddAvailabilityForCasual = (casualId: number) => {
    setDialogTarget({ kind: "casual", id: casualId });
    setSelectedShiftIds([
      ...new Set(
        availabilities
          .filter((availability) => availability.casualId === casualId)
          .map((availability) => availability.shiftId),
      ),
    ]);
    setSelectedCasualIds([]);
    setSaveError(null);
    setAddAvailDialogOpen(true);
  };

  const handleOpenAddAvailabilityForShift = (shiftId: number) => {
    setDialogTarget({ kind: "shift", id: shiftId });
    setSelectedCasualIds([
      ...new Set(
        availabilities
          .filter((availability) => availability.shiftId === shiftId)
          .map((availability) => availability.casualId),
      ),
    ]);
    setSelectedShiftIds([]);
    setSaveError(null);
    setAddAvailDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setAddAvailDialogOpen(false);
    setSaveError(null);
    setDialogTarget(null);
    setSelectedShiftIds([]);
    setSelectedCasualIds([]);
  };

  const toggleSelection = (id: number) => {
    if (dialogTarget?.kind === "casual") {
      setSelectedShiftIds((current) =>
        current.includes(id)
          ? current.filter((shiftId) => shiftId !== id)
          : [...current, id],
      );
      return;
    }

    setSelectedCasualIds((current) =>
      current.includes(id)
        ? current.filter((casualId) => casualId !== id)
        : [...current, id],
    );
  };

  const toggleCheckAll = () => {
    if (dialogTarget?.kind === "casual") {
      const visibleIds = shifts.map((shift) => shift.id);
      const allSelected =
        visibleIds.length > 0 &&
        visibleIds.every((shiftId) => selectedShiftIds.includes(shiftId));

      setSelectedShiftIds(allSelected ? [] : visibleIds);
      return;
    }

    const visibleIds = casuals.map((casual) => casual.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((casualId) => selectedCasualIds.includes(casualId));

    setSelectedCasualIds(allSelected ? [] : visibleIds);
  };

  const getShiftGroups = (): ShiftGroup[] => {
    // When displaying by date, ensure groups are ordered Monday -> Sunday
    if (shiftDisplayBy === "date") {
      const grouped = new Map<string, ShiftRow[]>();

      for (const shift of shifts) {
        const existing = grouped.get(shift.date) || [];
        grouped.set(shift.date, [...existing, shift]);
      }

      const weekStart = getWeekStart(selectedWeekStart);

      if (!weekStart) {
        // fallback: return dates in natural ascending order
        return Array.from(grouped.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, groupedShifts]) => ({
            key: date,
            title: dayjs(date).format("dddd, MMM D"),
            shifts: groupedShifts,
          }));
      }

      const sections: ShiftGroup[] = [];
      for (let i = 0; i < 7; i++) {
        const d = weekStart.add(i, "day");
        const key = d.format("YYYY-MM-DD");
        const groupedShifts = grouped.get(key);

        if (groupedShifts && groupedShifts.length > 0) {
          sections.push({
            key,
            title: d.format("dddd, MMM D"),
            shifts: groupedShifts,
          });
        }
      }

      return sections;
    }

    // Otherwise group by branch in insertion order
    const grouped = new Map<string, ShiftRow[]>();

    for (const shift of shifts) {
      const key = shift.branchName || "Unassigned branch";
      const existing = grouped.get(key) || [];
      grouped.set(key, [...existing, shift]);
    }

    return Array.from(grouped.entries()).map(([key, groupedShifts]) => {
      const sampleShift = groupedShifts[0];

      return {
        key,
        title: sampleShift.branchName || "Unassigned branch",
        shifts: groupedShifts,
      };
    });
  };

  const getShiftSections = () => {
    const grouped = new Map<string, ShiftRow[]>();

    for (const shift of shifts) {
      const existing = grouped.get(shift.date) || [];
      grouped.set(shift.date, [...existing, shift]);
    }

    const weekStart = getWeekStart(selectedWeekStart);

    if (!weekStart) {
      // fallback: return dates in natural ascending order
      return Array.from(grouped.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, groupedShifts]) => ({
          key: date,
          title: dayjs(date).format("dddd, MMM D"),
          shifts: groupedShifts,
        }));
    }

    const sections: ShiftGroup[] = [];
    for (let i = 0; i < 7; i++) {
      const d = weekStart.add(i, "day");
      const key = d.format("YYYY-MM-DD");
      const groupedShifts = grouped.get(key);

      if (groupedShifts && groupedShifts.length > 0) {
        sections.push({
          key,
          title: d.format("dddd, MMM D"),
          shifts: groupedShifts,
        });
      }
    }

    return sections;
  };

  const getDialogOptionCount = () =>
    dialogTarget?.kind === "casual" ? shifts.length : casuals.length;

  const getDialogSelectedCount = () =>
    dialogTarget?.kind === "casual"
      ? selectedShiftIds.length
      : selectedCasualIds.length;

  const isDialogOptionChecked = (id: number) =>
    dialogTarget?.kind === "casual"
      ? selectedShiftIds.includes(id)
      : selectedCasualIds.includes(id);

  const getDialogTargetName = () => {
    if (dialogTarget?.kind === "casual") {
      return (
        casuals.find((casual) => casual.id === dialogTarget.id)?.name ?? ""
      );
    }

    if (dialogTarget?.kind === "shift") {
      const shift = shifts.find((item) => item.id === dialogTarget.id);

      return shift
        ? `${shift.branchName} ${dayjs(shift.date).format("ddd MMM D")} ${dayjs(`1900-01-01T${shift.startTime}`).format("h:mm A")} - ${dayjs(`1900-01-01T${shift.endTime}`).format("h:mm A")}`
        : "";
    }

    return "";
  };

  const handleAddAvailability = async () => {
    if (!dialogTarget) {
      setSaveError("Please choose a casual or shift first");
      return;
    }

    const shouldInsert =
      dialogTarget.kind === "casual" ? selectedShiftIds : selectedCasualIds;

    setIsSaving(true);
    setSaveError(null);

    try {
      if (dialogTarget.kind === "casual") {
        const currentShiftIds = availabilities
          .filter((availability) => availability.casualId === dialogTarget.id)
          .map((availability) => availability.shiftId);

        const shiftsToInsert = shouldInsert.filter(
          (shiftId) => !currentShiftIds.includes(shiftId),
        );
        const shiftsToDelete = currentShiftIds.filter(
          (shiftId) => !shouldInsert.includes(shiftId),
        );

        for (const shiftId of shiftsToInsert) {
          await runSql(
            `
              INSERT INTO Available (casual_id, shift_id)
              VALUES (?, ?)
            `,
            [dialogTarget.id, shiftId],
          );
        }

        for (const shiftId of shiftsToDelete) {
          await runSql(
            `
              DELETE FROM Available
              WHERE casual_id = ? AND shift_id = ?
            `,
            [dialogTarget.id, shiftId],
          );
        }
      } else {
        const currentCasualIds = availabilities
          .filter((availability) => availability.shiftId === dialogTarget.id)
          .map((availability) => availability.casualId);

        const casualsToInsert = shouldInsert.filter(
          (casualId) => !currentCasualIds.includes(casualId),
        );
        const casualsToDelete = currentCasualIds.filter(
          (casualId) => !shouldInsert.includes(casualId),
        );

        for (const casualId of casualsToInsert) {
          await runSql(
            `
              INSERT INTO Available (casual_id, shift_id)
              VALUES (?, ?)
            `,
            [casualId, dialogTarget.id],
          );
        }

        for (const casualId of casualsToDelete) {
          await runSql(
            `
              DELETE FROM Available
              WHERE casual_id = ? AND shift_id = ?
            `,
            [casualId, dialogTarget.id],
          );
        }
      }

      await refreshData();

      setAddAvailDialogOpen(false);
      setDialogTarget(null);
      setSelectedShiftIds([]);
      setSelectedCasualIds([]);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to add availability",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleButtonClick = async () => {
    const monday = getWeekStart(selectedWeekStart)?.format("YYYY-MM-DD");

    if (!monday) {
      setErrorMsg("Please choose a week first");
      return;
    }

    if (hasScheduleForWeek) {
      navigate("/schedule");
      return;
    }

    setIsScheduleActionLoading(true);
    setErrorMsg(null);

    try {
      await generateScheduleForMonday(monday);
      setHasScheduleForWeek(true);
      navigate("/schedule");
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Failed to generate schedule",
      );
    } finally {
      setIsScheduleActionLoading(false);
    }
  };

  const handleLockCasualToShift = async (shiftId: number, casualId: number) => {
    const shift = shifts.find((item) => item.id === shiftId);

    if (!shift) {
      setLockMessage("Unable to lock shift. Shift not found.");
      return;
    }

    if (shift.lockedCasualId && shift.lockedCasualId !== casualId) {
      const lockedName =
        casuals.find((casual) => casual.id === shift.lockedCasualId)?.name ||
        "another casual";
      setLockMessage(
        `This shift is already locked to ${lockedName}. Remove that lock before choosing someone else.`,
      );
      return;
    }

    try {
      const nextLockValue = shift.lockedCasualId === casualId ? null : casualId;

      await runSql(
        `
          UPDATE Shift
          SET locked = ?
          WHERE id = ?
        `,
        [nextLockValue, shiftId],
      );

      setLockMessage(null);
      await refreshData();
    } catch (error) {
      setLockMessage(
        error instanceof Error ? error.message : "Failed to update shift lock",
      );
    }
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
          <Stack direction={"column"} spacing={1}>
            <Typography variant="h4">Availability</Typography>
            <Box>
              <Button
                variant="contained"
                onClick={() => {
                  void handleScheduleButtonClick();
                }}
                disabled={isScheduleActionLoading}
              >
                {isScheduleActionLoading
                  ? "Working..."
                  : hasScheduleForWeek
                    ? "View Schedule"
                    : "Generate Schedule"}
              </Button>
            </Box>
          </Stack>
          <FormControl>
            <FormLabel id="display-by-label">Display by:</FormLabel>
            <RadioGroup
              aria-labelledby="display-by-label"
              value={displayBy}
              onChange={(e) =>
                setDisplayBy(e.target.value as "casual" | "shift")
              }
              row
            >
              <FormControlLabel
                value="casual"
                control={<Radio />}
                label="Casual"
              />
              <FormControlLabel
                value="shift"
                control={<Radio />}
                label="Shift"
              />
            </RadioGroup>
          </FormControl>
        </Stack>

        {errorMsg ? (
          <Typography color="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Typography>
        ) : null}
        {displayBy === "casual" ? (
          <Grid container spacing={2}>
            {casuals.map((casual) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={casual.id}>
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
                    direction={"row"}
                    spacing={1}
                    sx={{
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
                        {" ("}
                        {
                          availabilities.filter(
                            (availability) =>
                              availability.casualId === casual.id,
                          ).length
                        }
                        {" shift"}
                        {availabilities.filter(
                          (availability) => availability.casualId === casual.id,
                        ).length === 1
                          ? ")"
                          : "s)"}
                      </Typography>
                    </Stack>
                    <Box>
                      <Button
                        variant="contained"
                        onClick={() =>
                          handleOpenAddAvailabilityForCasual(casual.id)
                        }
                        startIcon={<EditIcon />}
                        size="small"
                      >
                        Availability
                      </Button>
                    </Box>
                  </Stack>
                  <Divider sx={{ mt: 1.5, mb: 0.5, color: "b" }} />
                  {availabilities.filter(
                    (availability) => availability.casualId === casual.id,
                  ).length === 0 && (
                    <Typography
                      color="text.secondary"
                      sx={{ mt: 1.5, mb: 0.5, color: "b" }}
                    >
                      No availability set
                    </Typography>
                  )}
                  <Stack direction={"column"} spacing={0.75} sx={{ mt: 0.5 }}>
                    {availabilities
                      .filter(
                        (availability) => availability.casualId === casual.id,
                      )
                      .map((availability) => (
                        <Stack
                          key={availability.id}
                          direction="row"
                          sx={{
                            py: 0.5,
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Typography sx={{ minWidth: 0 }}>
                            <b>{availability.branchName}</b> -{" "}
                            {dayjs(availability.shiftDate).format("ddd MMM D")}:{" "}
                            {dayjs(
                              `1900-01-01T${availability.startTime}`,
                            ).format("h:mm A")}{" "}
                            -{" "}
                            {dayjs(`1900-01-01T${availability.endTime}`).format(
                              "h:mm A",
                            )}
                          </Typography>
                          <Tooltip
                            title={
                              shifts.find(
                                (shift) => shift.id === availability.shiftId,
                              )?.lockedCasualId === availability.casualId
                                ? "Unlock shift from " + casual.name
                                : "Lock shift to " + casual.name
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={() => {
                                void handleLockCasualToShift(
                                  availability.shiftId,
                                  availability.casualId,
                                );
                              }}
                            >
                              {shifts.find(
                                (shift) => shift.id === availability.shiftId,
                              )?.lockedCasualId === availability.casualId ? (
                                <LockIcon />
                              ) : (
                                <LockOpenIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ))}
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Stack spacing={2}>
            {getShiftSections().map((section) => (
              <Box
                key={section.key}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  {section.title}
                </Typography>
                <Grid container spacing={1.5}>
                  {section.shifts.map((shift) => {
                    const shiftCasuals = availabilities.filter(
                      (availability) => availability.shiftId === shift.id,
                    );

                    return (
                      <Grid size={{ xs: 12, md: 6, lg: 4 }} key={shift.id}>
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
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <Box>
                              <Typography variant="subtitle1">
                                {shift.branchName}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {dayjs(`1900-01-01T${shift.startTime}`).format(
                                  "h:mm A",
                                )}{" "}
                                -{" "}
                                {dayjs(`1900-01-01T${shift.endTime}`).format(
                                  "h:mm A",
                                )}
                              </Typography>
                            </Box>
                            <Button
                              variant="contained"
                              onClick={() =>
                                handleOpenAddAvailabilityForShift(shift.id)
                              }
                              startIcon={<EditIcon />}
                              size="small"
                            >
                              Availability
                            </Button>
                          </Stack>
                          <Divider sx={{ my: 1 }} />
                          <Stack spacing={0.5}>
                            {shiftCasuals.length > 0 ? (
                              shiftCasuals.map((availability) => (
                                <Stack
                                  key={availability.id}
                                  direction="row"
                                  sx={{
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Typography>
                                    {availability.casualName}
                                  </Typography>
                                  <Tooltip
                                    title={
                                      shifts.find(
                                        (shift) =>
                                          shift.id === availability.shiftId,
                                      )?.lockedCasualId ===
                                      availability.casualId
                                        ? "Unlock shift from " +
                                          availability.casualName
                                        : "Lock shift to " +
                                          availability.casualName
                                    }
                                  >
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        void handleLockCasualToShift(
                                          shift.id,
                                          availability.casualId,
                                        );
                                      }}
                                    >
                                      {shift.lockedCasualId ===
                                      availability.casualId ? (
                                        <LockIcon />
                                      ) : (
                                        <LockOpenIcon />
                                      )}
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              ))
                            ) : (
                              <Typography color="text.secondary">
                                No casuals added/available.
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            ))}
          </Stack>
        )}
        <Box sx={{ mt: 2 }}>
          {casuals.length !== 0 || shifts.length !== 0 ? (
            <Button
              variant="contained"
              onClick={() => {
                void handleScheduleButtonClick();
              }}
              disabled={isScheduleActionLoading}
            >
              {isScheduleActionLoading
                ? "Working..."
                : hasScheduleForWeek
                  ? "View Schedule"
                  : "Generate Schedule"}
            </Button>
          ) : (
            <Typography
              color="text.secondary"
              sx={{ mt: 1.5, mb: 0.5, color: "black" }}
            >
              No data found for this week.
            </Typography>
          )}
        </Box>
        <Dialog
          open={addAvailDialogOpen}
          onClose={handleCloseDialog}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle>
            {dialogTarget?.kind === "casual"
              ? "Edit Availability for "
              : "Edit Shift Availability for "}
            {getDialogTargetName()}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ py: 1 }}>
              {dialogTarget?.kind === "casual" ? (
                <>
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1,
                    }}
                  >
                    <FormControl>
                      <FormLabel id="shift-select-label">
                        Display shifts by
                      </FormLabel>
                      <RadioGroup
                        row
                        aria-labelledby="shift-select-label"
                        value={shiftDisplayBy}
                        onChange={(event) =>
                          setShiftDisplayBy(
                            event.target.value as "date" | "branch",
                          )
                        }
                      >
                        <FormControlLabel
                          value="date"
                          control={<Radio />}
                          label="Date"
                        />
                        <FormControlLabel
                          value="branch"
                          control={<Radio />}
                          label="Branch"
                        />
                      </RadioGroup>
                    </FormControl>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={toggleCheckAll}
                    >
                      {getDialogSelectedCount() === getDialogOptionCount() &&
                      getDialogOptionCount() > 0
                        ? "Uncheck All"
                        : "Check All"}
                    </Button>
                  </Stack>
                  <Grid container spacing={1}>
                    {getShiftGroups().map((group) => (
                      <Grid size={{ xs: 12, md: 6 }} key={group.key}>
                        <Box
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            p: 1.5,
                          }}
                        >
                          <Typography variant="subtitle1" sx={{ mb: 0 }}>
                            {group.title}
                          </Typography>
                          <Stack spacing={0.5}>
                            {group.shifts.map((shift) => (
                              <FormControlLabel
                                key={shift.id}
                                control={
                                  <Checkbox
                                    checked={isDialogOptionChecked(shift.id)}
                                    onChange={() => toggleSelection(shift.id)}
                                    sx={{ my: -0.25 }}
                                  />
                                }
                                label={
                                  shiftDisplayBy === "date"
                                    ? `${shift.branchName}: ${dayjs(`1900-01-01T${shift.startTime}`).format("h:mm A")} - ${dayjs(`1900-01-01T${shift.endTime}`).format("h:mm A")}`
                                    : `${dayjs(shift.date).format("ddd MMM D")}: ${dayjs(`1900-01-01T${shift.startTime}`).format("h:mm A")} - ${dayjs(`1900-01-01T${shift.endTime}`).format("h:mm A")}`
                                }
                              />
                            ))}
                          </Stack>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </>
              ) : (
                <>
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Select casuals for this shift.
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={toggleCheckAll}
                    >
                      {getDialogSelectedCount() === getDialogOptionCount() &&
                      getDialogOptionCount() > 0
                        ? "Uncheck All"
                        : "Check All"}
                    </Button>
                  </Stack>
                  <Grid container spacing={1}>
                    {casuals.map((casual) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={casual.id}>
                        <FormControlLabel
                          key={casual.id}
                          control={
                            <Checkbox
                              checked={isDialogOptionChecked(casual.id)}
                              onChange={() => toggleSelection(casual.id)}
                            />
                          }
                          label={casual.name}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}
              {saveError && (
                <Typography color="error" variant="body2">
                  {saveError}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              disabled={isSaving}
              onClick={() => {
                void handleAddAvailability();
              }}
            >
              {isSaving ? "Saving..." : "Add Availability"}
            </Button>
            <Button onClick={handleCloseDialog} disabled={isSaving}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(lockMessage)}
          autoHideDuration={4000}
          onClose={(_, reason) => {
            if (reason === "clickaway") {
              return;
            }

            setLockMessage(null);
          }}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => {
              setLockMessage(null);
            }}
            severity="error"
            variant="filled"
            sx={{ width: "100%" }}
          >
            {lockMessage}
          </Alert>
        </Snackbar>
      </Box>
    </>
  );
}
