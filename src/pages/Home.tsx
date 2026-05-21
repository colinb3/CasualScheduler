/**
 * Home.tsx
 * Colin Brown May 10, 2026
 */

import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Link as RouterLink } from "react-router-dom";
import type { Dayjs } from "dayjs";

export default function Home({
  selectedDate,
  setSelectedDate,
  selectedWeekStart,
  setSelectedWeekStart,
}: {
  selectedDate: Dayjs | null;
  setSelectedDate: React.Dispatch<React.SetStateAction<Dayjs | null>>;
  selectedWeekStart: Dayjs | null;
  setSelectedWeekStart: React.Dispatch<React.SetStateAction<Dayjs | null>>;
}) {
  const getWeekStart = (date: Dayjs | null) => {
    if (!date) {
      return null;
    }

    const monday = date.clone().startOf("week").add(1, "day");

    return date.day() === 0 ? monday.subtract(7, "day") : monday;
  };

  const chanageSelectedDate = (newValue: Dayjs | null) => {
    setSelectedDate(newValue);
    setSelectedWeekStart(getWeekStart(newValue));
  };

  return (
    <Box sx={{ padding: 1 }}>
      <Typography variant="h4" sx={{ mb: 1.5 }}>
        LPL Casual Scheduler
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "start", sm: "center" }, mb: 2 }}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Select Week"
            value={selectedDate}
            onChange={(newValue) => chanageSelectedDate(newValue)}
          />
        </LocalizationProvider>
        {selectedWeekStart && getWeekStart(selectedWeekStart) && (
          <Stack direction={"column"}>
            <Typography variant="body1" sx={{ whiteSpace: "nowrap" }}>
              Selected Week: {getWeekStart(selectedWeekStart)?.format("MMM D")}{" "}
              - {getWeekStart(selectedWeekStart)?.add(6, "day").format("MMM D")}
            </Typography>
          </Stack>
        )}
      </Stack>

      <Stack direction="row" sx={{ spacing: 2, mb: 1.5, gap: 1 }}>
        <Button variant="contained" component={RouterLink} to="/shifts">
          View Shifts
        </Button>
        <Button variant="contained" component={RouterLink} to="/casuals">
          View Casuals
        </Button>
        <Button variant="contained" component={RouterLink} to="/availability">
          Add Availability
        </Button>
        <Button variant="contained" component={RouterLink} to="/schedule">
          View Schedule
        </Button>
      </Stack>
      <Typography variant="body1">
        Welcome to the LPL Casual Scheduler! Use the buttons above to add
        shifts, manage casual staff, and generate schedules. This tool is
        designed to help you easily create schedules and track casual work
        assignments.{" "}
        <b>
          All data entered here is saved on-device. No data is sent over the
          internet
        </b>
        .
      </Typography>
    </Box>
  );
}
