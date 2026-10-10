import { describe, expect, it } from "vitest";
import { findVenueClash, addHoursToLocalInput } from "@/lib/event-dates";
import {
  fmtDateRange,
  getCheckInOpensAt,
  getRegistrationDeadline,
  isRegistrationOpen,
  isCheckInActive,
} from "@/lib/events";

describe("Venue scheduling & End Time logic", () => {
  const existingEvents = [
    {
      id: "ev-1",
      title: "AI Hackathon",
      starts_at: "2026-10-15T09:00:00.000Z",
      ends_at: "2026-10-15T13:00:00.000Z",
      venue: "Main Auditorium",
    },
    {
      id: "ev-2",
      title: "Robotics Workshop",
      starts_at: "2026-10-15T14:00:00.000Z",
      ends_at: "2026-10-15T18:00:00.000Z",
      venue: "Lab 3",
    },
  ];

  it("allows concurrent events at the same time if venues are different", () => {
    // New event at same time as ev-1 (09:00 to 13:00) but at Seminar Hall
    const clash = findVenueClash(
      existingEvents,
      "2026-10-15T09:00:00.000Z",
      "2026-10-15T13:00:00.000Z",
      "Seminar Hall"
    );
    expect(clash).toBeNull();
  });

  it("detects clash when an event overlaps at the exact same venue", () => {
    // Overlaps ev-1 (Main Auditorium) 10:00 to 12:00
    const clash = findVenueClash(
      existingEvents,
      "2026-10-15T10:00:00.000Z",
      "2026-10-15T12:00:00.000Z",
      "main auditorium" // case-insensitive
    );
    expect(clash).not.toBeNull();
    expect(clash?.title).toBe("AI Hackathon");
  });

  it("does not clash with itself when editing", () => {
    const clash = findVenueClash(
      existingEvents,
      "2026-10-15T09:00:00.000Z",
      "2026-10-15T13:00:00.000Z",
      "Main Auditorium",
      "ev-1" // self ID
    );
    expect(clash).toBeNull();
  });

  it("allows consecutive events at the same venue that do not overlap", () => {
    // 13:00 to 15:00 at Main Auditorium (starts exactly when ev-1 ends)
    const clash = findVenueClash(
      existingEvents,
      "2026-10-15T13:00:00.000Z",
      "2026-10-15T15:00:00.000Z",
      "Main Auditorium"
    );
    expect(clash).toBeNull();
  });

  it("addHoursToLocalInput correctly calculates end time", () => {
    const next = addHoursToLocalInput("2026-10-15T10:00", 3);
    expect(next).toBe("2026-10-15T13:00");
  });

  it("fmtDateRange formats single day date and time span cleanly", () => {
    const str = fmtDateRange("2026-10-15T09:00:00.000Z", "2026-10-15T13:00:00.000Z");
    expect(str).toContain("–");
  });

  it("ignores whitespace differences when matching venue", () => {
    const clash = findVenueClash(
      existingEvents,
      "2026-10-15T10:00:00.000Z",
      "2026-10-15T12:00:00.000Z",
      "   Main Auditorium   "
    );
    expect(clash).not.toBeNull();
    expect(clash?.id).toBe("ev-1");
  });

  it("allows multiple events on same date & time at different venues", () => {
    // Exact same time window as ev-1, but at "Auditorium 2"
    const clash = findVenueClash(
      existingEvents,
      "2026-10-15T09:00:00.000Z",
      "2026-10-15T13:00:00.000Z",
      "Auditorium 2"
    );
    expect(clash).toBeNull();
  });

  it("detects overlap when one event ends after the other starts", () => {
    // Starts at 12:30 (before ev-1 ends at 13:00) at Main Auditorium
    const clash = findVenueClash(
      existingEvents,
      "2026-10-15T12:30:00.000Z",
      "2026-10-15T15:00:00.000Z",
      "Main Auditorium"
    );
    expect(clash).not.toBeNull();
    expect(clash?.title).toBe("AI Hackathon");
  });

  it("check-in opens exactly 30 minutes before event start time", () => {
    // If event is at 11:00 AM, check-in starts at 10:30 AM
    const startsAt = "2026-10-15T11:00:00.000Z";
    const opensAt = getCheckInOpensAt(startsAt, 30);
    expect(opensAt.toISOString()).toBe("2026-10-15T10:30:00.000Z");
  });

  it("registration deadline is 30 minutes before event start (closes when check-in begins)", () => {
    // If event starts at 11:00 AM, registrations close at 10:30 AM
    const startsAt = "2026-10-15T11:00:00.000Z";
    const deadline = getRegistrationDeadline(startsAt, 30);
    expect(deadline.toISOString()).toBe("2026-10-15T10:30:00.000Z");
  });

  it("isRegistrationOpen returns false when check-in has already started (within 30 mins)", () => {
    // Event starts in 15 minutes -> within 30m window -> check-in underway, registrations closed
    const in15Minutes = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    expect(isRegistrationOpen({ starts_at: in15Minutes, is_open: true })).toBe(false);

    // Event starts in 120 minutes -> check-in not open yet -> registration open
    const in2Hours = new Date(Date.now() + 120 * 60 * 1000).toISOString();
    expect(isRegistrationOpen({ starts_at: in2Hours, is_open: true })).toBe(true);
  });
});
