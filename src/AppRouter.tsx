/** AppRouter.tsx
 * Colin Brown
 **/

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Shifts from "./pages/Shifts";
import Casuals from "./pages/Casuals";
import Availability from "./pages/Availability";
import Schedule from "./pages/Schedule";
import { getDatabase } from "./db/sqlite";
import dayjs, { Dayjs } from "dayjs";

export default function AppRouter() {
  const [selectedWeekStart, setSelectedWeekStart] =
    React.useState<Dayjs | null>(dayjs());
  const [selectedDate, setSelectedDate] = React.useState<Dayjs | null>(dayjs());

  React.useEffect(() => {
    void getDatabase();
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route
          path="/"
          element={
            <Home
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedWeekStart={selectedWeekStart}
              setSelectedWeekStart={setSelectedWeekStart}
            />
          }
        />
        <Route
          path="/shifts"
          element={<Shifts selectedWeekStart={selectedWeekStart} />}
        />
        <Route
          path="/casuals"
          element={<Casuals selectedWeekStart={selectedWeekStart} />}
        />
        <Route
          path="/availability"
          element={<Availability selectedWeekStart={selectedWeekStart} />}
        />
        <Route
          path="/schedule"
          element={<Schedule selectedWeekStart={selectedWeekStart} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
