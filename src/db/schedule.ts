import { queryRows, runSql } from "./sqlite";

type ScheduleIdRow = {
  id: number;
};

type ShiftCandidateRow = {
  id: number;
  startTime: string;
  endTime: string;
  lockedCasualId: number | null;
};

type AvailablePairRow = {
  casualId: number;
  shiftId: number;
};

export type ScheduleAssignmentRow = {
  scheduleId: number;
  shiftId: number;
  branchId: number | null;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  branchName: string;
  casualId: number | null;
  casualName: string | null;
  lockedCasualId: number | null;
};

export async function getScheduleIdByMonday(monday: string) {
  const rows = await queryRows<ScheduleIdRow>(
    `
      SELECT id
      FROM Schedule
      WHERE monday = ?
      LIMIT 1
    `,
    [monday],
  );

  return rows[0]?.id ?? null;
}

async function createSchedule(monday: string) {
  await runSql(
    `
      INSERT INTO Schedule (monday)
      VALUES (?)
    `,
    [monday],
  );

  const id = await getScheduleIdByMonday(monday);

  if (!id) {
    throw new Error("Failed to create schedule");
  }

  return id;
}

function getShiftDurationMinutes(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  // Support overnight shifts by wrapping into the next day.
  return endTotal >= startTotal
    ? endTotal - startTotal
    : 24 * 60 - startTotal + endTotal;
}

function getRandomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function getLongestShiftId(
  shiftIds: number[],
  shiftDurationMinutesById: Map<number, number>,
) {
  if (shiftIds.length === 0) {
    return null;
  }

  let longestMinutes = -1;
  const longestShiftIds: number[] = [];

  for (const shiftId of shiftIds) {
    const minutes = shiftDurationMinutesById.get(shiftId) ?? 0;

    if (minutes > longestMinutes) {
      longestMinutes = minutes;
      longestShiftIds.length = 0;
      longestShiftIds.push(shiftId);
      continue;
    }

    if (minutes === longestMinutes) {
      longestShiftIds.push(shiftId);
    }
  }

  return getRandomItem(longestShiftIds);
}

export async function generateScheduleForMonday(monday: string) {
  const existingScheduleId = await getScheduleIdByMonday(monday);
  const scheduleId = existingScheduleId ?? (await createSchedule(monday));

  await runSql(
    `
      DELETE FROM ScheduleShift
      WHERE schedule_id = ?
    `,
    [scheduleId],
  );

  const shifts = await queryRows<ShiftCandidateRow>(
    `
      SELECT
        Shift.id,
        Shift.start_time AS startTime,
        Shift.end_time AS endTime,
        Shift.locked AS lockedCasualId
      FROM Shift
      LEFT JOIN Branch ON Branch.id = Shift.branch_id
      WHERE Shift.date >= ? AND Shift.date < date(?, '+7 day')
      ORDER BY Branch.name, Shift.date, Shift.start_time, Shift.end_time
    `,
    [monday, monday],
  );

  const availablePairs = await queryRows<AvailablePairRow>(
    `
      SELECT
        Available.casual_id AS casualId,
        Available.shift_id AS shiftId
      FROM Available
      LEFT JOIN Shift ON Shift.id = Available.shift_id
      WHERE Shift.date >= ? AND Shift.date < date(?, '+7 day')
    `,
    [monday, monday],
  );

  const shiftDurationMinutesById = new Map<number, number>();
  for (const shift of shifts) {
    shiftDurationMinutesById.set(
      shift.id,
      getShiftDurationMinutes(shift.startTime, shift.endTime),
    );
  }

  const availableShiftIdsByCasual = new Map<number, Set<number>>();
  for (const pair of availablePairs) {
    const existingSet = availableShiftIdsByCasual.get(pair.casualId) || new Set<number>();
    existingSet.add(pair.shiftId);
    availableShiftIdsByCasual.set(pair.casualId, existingSet);
  }

  const casualIds = Array.from(availableShiftIdsByCasual.keys());
  const unassignedShiftIds = new Set<number>(shifts.map((shift) => shift.id));
  const assignedCasualByShiftId = new Map<number, number>();
  const assignedMinutesByCasualId = new Map<number, number>();

  const assignShiftToCasual = (shiftId: number, casualId: number) => {
    if (!unassignedShiftIds.has(shiftId)) {
      return false;
    }

    assignedCasualByShiftId.set(shiftId, casualId);
    unassignedShiftIds.delete(shiftId);

    const currentMinutes = assignedMinutesByCasualId.get(casualId) || 0;
    const shiftMinutes = shiftDurationMinutesById.get(shiftId) || 0;
    assignedMinutesByCasualId.set(casualId, currentMinutes + shiftMinutes);

    return true;
  };

  const getRemainingAvailabilityCount = (casualId: number) => {
    const availableShiftIds = availableShiftIdsByCasual.get(casualId);

    if (!availableShiftIds) {
      return 0;
    }

    let count = 0;
    for (const shiftId of availableShiftIds) {
      if (unassignedShiftIds.has(shiftId)) {
        count += 1;
      }
    }

    return count;
  };

  const getRemainingAvailableShiftIds = (casualId: number) => {
    const availableShiftIds = availableShiftIdsByCasual.get(casualId);

    if (!availableShiftIds) {
      return [];
    }

    return Array.from(availableShiftIds).filter((shiftId) =>
      unassignedShiftIds.has(shiftId),
    );
  };

  // Step 1: Assign each locked shift first so locks are always respected.
  for (const shift of shifts) {
    if (shift.lockedCasualId) {
      assignShiftToCasual(shift.id, shift.lockedCasualId);
    }
  }

  // Step 2: Sort casuals by number of shifts they are available for.
  const casualsSortedByAvailability = casualIds
    .map((casualId) => ({
      casualId,
      availableCount: getRemainingAvailabilityCount(casualId),
      tieBreaker: Math.random(),
    }))
    .sort((a, b) => {
      if (a.availableCount !== b.availableCount) {
        return a.availableCount - b.availableCount;
      }

      // Step 3a tie-breaker: random casual when availability counts are equal.
      return a.tieBreaker - b.tieBreaker;
    });

  // Step 3: Give each casual their longest currently available shift in order.
  for (const row of casualsSortedByAvailability) {
    const candidateShiftIds = getRemainingAvailableShiftIds(row.casualId);
    const chosenShiftId = getLongestShiftId(candidateShiftIds, shiftDurationMinutesById);

    if (chosenShiftId) {
      // Step 3a tie-breaker for equal shift lengths happens inside getLongestShiftId.
      assignShiftToCasual(chosenShiftId, row.casualId);
    }
  }

  // Step 4 + Step 5:
  // Repeatedly rank casuals by least assigned hours, then least remaining availability,
  // assign their longest remaining shift, and re-rank after each assignment.
  while (true) {
    const rankedCasuals = casualIds
      .map((casualId) => ({
        casualId,
        assignedMinutes: assignedMinutesByCasualId.get(casualId) || 0,
        remainingAvailability: getRemainingAvailabilityCount(casualId),
        tieBreaker: Math.random(),
      }))
      .filter((row) => row.remainingAvailability > 0)
      .sort((a, b) => {
        if (a.assignedMinutes !== b.assignedMinutes) {
          return a.assignedMinutes - b.assignedMinutes;
        }

        if (a.remainingAvailability !== b.remainingAvailability) {
          return a.remainingAvailability - b.remainingAvailability;
        }

        return a.tieBreaker - b.tieBreaker;
      });

    if (rankedCasuals.length === 0) {
      break;
    }

    const nextCasualId = rankedCasuals[0].casualId;
    const candidateShiftIds = getRemainingAvailableShiftIds(nextCasualId);
    const chosenShiftId = getLongestShiftId(candidateShiftIds, shiftDurationMinutesById);

    if (!chosenShiftId) {
      break;
    }

    assignShiftToCasual(chosenShiftId, nextCasualId);
  }

  for (const shift of shifts) {
    const assignedCasualId = assignedCasualByShiftId.get(shift.id) ?? null;

    await runSql(
      `
        INSERT INTO ScheduleShift (schedule_id, shift_id, casual_id)
        VALUES (?, ?, ?)
      `,
      [scheduleId, shift.id, assignedCasualId],
    );
  }

  return scheduleId;
}

export async function getScheduleAssignmentsByMonday(monday: string) {
  return queryRows<ScheduleAssignmentRow>(
    `
      SELECT
        Schedule.id AS scheduleId,
        Shift.id AS shiftId,
        Shift.branch_id AS branchId,
        Shift.date AS shiftDate,
        Shift.start_time AS shiftStartTime,
        Shift.end_time AS shiftEndTime,
        Branch.name AS branchName,
        ScheduleShift.casual_id AS casualId,
        Casual.name AS casualName,
        Shift.locked AS lockedCasualId
      FROM Schedule
      LEFT JOIN ScheduleShift ON ScheduleShift.schedule_id = Schedule.id
      LEFT JOIN Shift ON Shift.id = ScheduleShift.shift_id
      LEFT JOIN Branch ON Branch.id = Shift.branch_id
      LEFT JOIN Casual ON Casual.id = ScheduleShift.casual_id
      WHERE Schedule.monday = ?
      ORDER BY Branch.name, Shift.date, Shift.start_time, Shift.end_time
    `,
    [monday],
  );
}
