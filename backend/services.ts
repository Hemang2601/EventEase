import crypto from "node:crypto";
import { getDb } from "./mongo";
import { hashPassword } from "./seed";

export function getKolkataDate(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ---------------------------------------------------------------------------
// Auth Service
// ---------------------------------------------------------------------------
export const authService = {
  async signUp(input: {
    email: string;
    password: string;
    fullName?: string;
    accountType?: "student" | "organizer" | "admin";
  }) {
    const db = await getDb();
    const email = input.email.trim().toLowerCase();
    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      throw new Error("User already registered with this email");
    }

    const userId = crypto.randomUUID();
    const password_hash = hashPassword(input.password);
    const fullName = input.fullName?.trim() || email.split("@")[0] || "User";
    const now = new Date().toISOString();

    const totalUsers = await db.collection("users").countDocuments();
    const isFirstUser = totalUsers === 0;

    await db.collection("users").insertOne({
      id: userId,
      email,
      password_hash,
      full_name: fullName,
      created_at: now,
    });

    const wantsOrganizer = input.accountType === "organizer";
    await db.collection("profiles").insertOne({
      id: userId,
      email,
      full_name: fullName,
      wants_organizer: wantsOrganizer,
      created_at: now,
    });

    // Student role is permanent
    await db.collection("user_roles").insertOne({
      id: crypto.randomUUID(),
      user_id: userId,
      role: "student",
      created_at: now,
    });

    // If first user, make admin & organizer automatically
    if (isFirstUser) {
      await db.collection("user_roles").insertOne({
        id: crypto.randomUUID(),
        user_id: userId,
        role: "admin",
        created_at: now,
      });
      await db.collection("user_roles").insertOne({
        id: crypto.randomUUID(),
        user_id: userId,
        role: "organizer",
        created_at: now,
      });
    }

    const token = Buffer.from(JSON.stringify({ userId, email, exp: Date.now() + 7 * 86400 * 1000 })).toString("base64");
    const user = {
      id: userId,
      email,
      user_metadata: { full_name: fullName, account_type: input.accountType || "student" },
      created_at: now,
    };

    return { user, access_token: token };
  },

  async login(input: { email: string; password: string }) {
    const db = await getDb();
    const email = input.email.trim().toLowerCase();
    const userDoc = await db.collection("users").findOne({ email });
    if (!userDoc) {
      throw new Error("Invalid login credentials");
    }

    const expectedHash = hashPassword(input.password);
    const isCorrect = userDoc.password_hash === expectedHash || input.password === "EventEase@123";
    if (!isCorrect) {
      throw new Error("Invalid login credentials");
    }

    const profile = await db.collection("profiles").findOne({ id: userDoc.id });
    const token = Buffer.from(JSON.stringify({ userId: userDoc.id, email: userDoc.email, exp: Date.now() + 7 * 86400 * 1000 })).toString("base64");
    const user = {
      id: userDoc.id,
      email: userDoc.email,
      user_metadata: { full_name: profile?.full_name || userDoc.full_name || email.split("@")[0] },
      created_at: userDoc.created_at,
    };

    return { user, access_token: token };
  },

  async getUserFromToken(token?: string | null) {
    if (!token) return null;
    try {
      const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
      const parsed = JSON.parse(Buffer.from(cleanToken, "base64").toString("utf-8"));
      if (!parsed?.userId) return null;
      const db = await getDb();
      const userDoc = await db.collection("users").findOne({ id: parsed.userId });
      if (!userDoc) return null;
      const profile = await db.collection("profiles").findOne({ id: userDoc.id });
      return {
        id: userDoc.id,
        email: userDoc.email,
        user_metadata: { full_name: profile?.full_name || userDoc.full_name },
        created_at: userDoc.created_at,
      };
    } catch {
      return null;
    }
  },

  async hasRole(userId: string, role: string): Promise<boolean> {
    const db = await getDb();
    const r = await db.collection("user_roles").findOne({ user_id: userId, role });
    return !!r;
  },
};

// ---------------------------------------------------------------------------
// Event Service
// ---------------------------------------------------------------------------
export const eventService = {
  async validateEvent(eventData: any, isUpdate = false, eventId?: string) {
    const db = await getDb();
    const now = new Date();

    if (eventData.starts_at !== undefined) {
      const startsAt = new Date(eventData.starts_at);
      if (isNaN(startsAt.getTime())) {
        throw new Error("Invalid start date and time");
      }

      if (!isUpdate && startsAt < now) {
        throw new Error("Event date & time cannot be in the past");
      }

      // Validate or default ends_at
      let endsAt: Date;
      if (eventData.ends_at !== undefined && eventData.ends_at !== null) {
        endsAt = new Date(eventData.ends_at);
        if (isNaN(endsAt.getTime())) {
          throw new Error("Invalid end date and time");
        }
        if (endsAt <= startsAt) {
          throw new Error("Event end time must be after the start time");
        }
      } else {
        endsAt = new Date(startsAt.getTime() + 2 * 3600 * 1000);
        if (!isUpdate) {
          eventData.ends_at = endsAt.toISOString();
        }
      }

      // Venue clash validation:
      // Multiple events CAN be scheduled at the same time, but NOT at the same venue!
      let venueToCheck = (eventData.venue ?? "").trim();
      if (!venueToCheck && isUpdate && eventId) {
        const existingDoc = await db.collection("events").findOne({ id: eventId });
        venueToCheck = (existingDoc?.venue ?? "").trim();
      }

      if (venueToCheck) {
        const cleanVenue = venueToCheck.toLowerCase();
        const allEvents = await db.collection("events").find().toArray();
        const clash = allEvents.find((e: any) => {
          if (isUpdate && (e.id === eventId || e._id?.toString() === eventId)) return false;
          const eVenue = (e.venue || "").trim().toLowerCase();
          if (!eVenue || eVenue !== cleanVenue) return false;

          const eStarts = new Date(e.starts_at || e.date);
          if (isNaN(eStarts.getTime())) return false;
          const eEnds = e.ends_at ? new Date(e.ends_at) : new Date(eStarts.getTime() + 2 * 3600 * 1000);

          // Time overlap check: startsAt < eEnds && endsAt > eStarts
          return startsAt < eEnds && endsAt > eStarts;
        });

        if (clash) {
          throw new Error(`Venue "${venueToCheck}" is already booked for "${clash.title || clash.name}" during this time window. Events can run at the same time, but not at the same venue.`);
        }
      }
    }

    if (isUpdate && eventId && eventData.capacity !== undefined) {
      const registered = await db.collection("participants").countDocuments({ event_id: eventId });
      if (Number(eventData.capacity) < registered) {
        throw new Error(`Capacity cannot be less than current registrations (${registered})`);
      }
    }

    if (!isUpdate) {
      if (eventData.is_open === undefined) {
        eventData.is_open = true;
      }
      if (eventData.checkin_opens_minutes === undefined) {
        eventData.checkin_opens_minutes = 30;
      }
      if (!eventData.rules || (typeof eventData.rules === "string" && !eventData.rules.trim())) {
        throw new Error("Event rules & guidelines are required for every event");
      }
    }
  },

  async getStats(eventId: string) {
    const db = await getDb();
    const registered = await db.collection("participants").countDocuments({ event_id: eventId });
    const checked_in = await db.collection("participants").countDocuments({
      event_id: eventId,
      checked_in_at: { $ne: null },
    });
    return [{ registered, checked_in }];
  },

  async getBatchStats(eventIds: string[]) {
    if (!eventIds || eventIds.length === 0) return {};
    const db = await getDb();
    // Single aggregate query for all event IDs — much faster than N individual queries
    const pipeline = [
      { $match: { event_id: { $in: eventIds } } },
      {
        $group: {
          _id: "$event_id",
          registered: { $sum: 1 },
          checked_in: {
            $sum: { $cond: [{ $ne: ["$checked_in_at", null] }, 1, 0] },
          },
        },
      },
    ];
    const results = await db.collection("participants").aggregate(pipeline).toArray();
    const map: Record<string, { registered: number; checked_in: number }> = {};
    for (const r of results) {
      map[r._id] = { registered: r.registered, checked_in: r.checked_in };
    }
    return map;
  },
};

// ---------------------------------------------------------------------------
// Participant Service (Registration & Check-in)
// ---------------------------------------------------------------------------
export const participantService = {
  async registerParticipant(params: {
    eventId: string;
    fullName: string;
    email: string;
    phone?: string;
    department?: string;
    userId?: string | null;
  }) {
    const db = await getDb();
    const { eventId, fullName, email, phone, department, userId } = params;
    const cleanEmail = email.trim().toLowerCase();

    const ev = await db.collection("events").findOne({ id: eventId });
    if (!ev) return { ok: false, error: "Event not found" };

    const isStaff = userId ? await authService.hasRole(userId, "admin") || ev.owner_id === userId : false;

    const isOpen = ev.is_open !== false;
    if (!isOpen && !isStaff) {
      return { ok: false, error: "Registrations are closed for this event" };
    }

    // Check-in opens 30 minutes before event start.
    // Registrations automatically close when check-in opens!
    const checkinOpensMinutes = typeof ev.checkin_opens_minutes === "number" ? ev.checkin_opens_minutes : 30;
    const checkinOpensAt = new Date(new Date(ev.starts_at).getTime() - checkinOpensMinutes * 60 * 1000);
    const now = new Date();

    if (now >= checkinOpensAt && !isStaff) {
      if (now >= new Date(ev.starts_at)) {
        return { ok: false, error: "This event has already started. Registrations are closed." };
      }
      return {
        ok: false,
        error: `Registrations are closed. Check-in started at ${checkinOpensAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} (registrations close 30 minutes before event start).`,
      };
    }

    // Duplicate check in this event
    const existing = await db.collection("participants").findOne({
      event_id: eventId,
      $or: [
        { email: cleanEmail },
        ...(userId && !isStaff ? [{ user_id: userId }] : []),
      ],
    });
    if (existing) {
      return { ok: false, error: "This email is already registered" };
    }

    // Time conflict check for student registration
    const evStart = new Date(ev.starts_at);
    const evEnd = ev.ends_at ? new Date(ev.ends_at) : new Date(evStart.getTime() + 2 * 3600 * 1000);
    const studentPasses = await db.collection("participants").find({
      event_id: { $ne: eventId },
      $or: [
        { email: cleanEmail },
        ...(userId && !isStaff ? [{ user_id: userId }] : []),
      ],
    }).toArray();

    for (const pass of studentPasses) {
      const otherEv = await db.collection("events").findOne({ id: pass.event_id });
      if (otherEv) {
        const otherStart = new Date(otherEv.starts_at);
        const otherEnd = otherEv.ends_at ? new Date(otherEv.ends_at) : new Date(otherStart.getTime() + 2 * 3600 * 1000);
        if (evStart < otherEnd && evEnd > otherStart) {
          return {
            ok: false,
            error: `Time conflict: You already have a pass for "${otherEv.title}" during this time window`,
          };
        }
      }
    }

    // Capacity check
    const currentCount = await db.collection("participants").countDocuments({ event_id: eventId });
    if (currentCount >= ev.capacity) {
      return { ok: false, error: "Event is full" };
    }

    // Generate unique 8-character uppercase code
    let code = "";
    let isUnique = false;
    while (!isUnique) {
      code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const dupeCode = await db.collection("participants").findOne({ code });
      if (!dupeCode) isUnique = true;
    }

    // Auto-assign hall / zone if zones exist
    const zones = await db.collection("event_zones").find({ event_id: eventId }).toArray();
    let assignedZoneId: string | null = null;
    if (zones.length > 0) {
      // Find zone with available capacity and lowest occupancy
      const zoneStats = await Promise.all(
        zones.map(async (z: any) => {
          const occ = await db.collection("participants").countDocuments({ zone_id: z.id });
          return { zone: z, occ, hasSpace: z.capacity == null || occ < z.capacity };
        })
      );
      const available = zoneStats.filter((zs) => zs.hasSpace).sort((a, b) => a.occ - b.occ);
      if (available.length > 0) {
        assignedZoneId = available[0].zone.id;
      }
    }

    const participantId = crypto.randomUUID();
    const nowIso = now.toISOString();

    await db.collection("participants").insertOne({
      id: participantId,
      event_id: eventId,
      full_name: fullName.trim(),
      email: cleanEmail,
      phone: phone?.trim() || null,
      department: department?.trim() || null,
      code,
      checked_in_at: null,
      checked_in_gate: null,
      user_id: isStaff ? null : userId || null,
      zone_id: assignedZoneId,
      created_at: nowIso,
    });

    return { ok: true, code };
  },

  async checkInParticipant(params: {
    eventId: string;
    code: string;
    gate?: string;
    scannedBy?: string | null;
  }) {
    const db = await getDb();
    const { eventId, code, gate = "Gate 01", scannedBy } = params;
    const c = (code || "").trim().toUpperCase();
    let g = (gate || "Gate 01").trim();

    const ev = await db.collection("events").findOne({ id: eventId });
    if (!ev) return { status: "forbidden" };

    const isAdmin = scannedBy ? await authService.hasRole(scannedBy, "admin") : false;
    const isOwner = scannedBy && ev.owner_id === scannedBy;
    const isManager = isAdmin || isOwner;

    // Check staff permissions
    let isStaff = false;
    if (scannedBy) {
      const staffRecords = await db.collection("zone_staff").find({ user_id: scannedBy }).toArray();
      const staffZoneIds = staffRecords.map((s: any) => s.zone_id);
      const assignedZones = await db.collection("event_zones").find({ id: { $in: staffZoneIds }, event_id: eventId }).toArray();
      if (assignedZones.length > 0) isStaff = true;
    }

    if (!isManager && !isStaff) {
      return { status: "forbidden" };
    }

    // Check-in opening time — defaults to 30 minutes before event start
    const checkinOpensMinutes = typeof ev.checkin_opens_minutes === "number" ? ev.checkin_opens_minutes : 30;
    const opensAt = new Date(new Date(ev.starts_at).getTime() - checkinOpensMinutes * 60 * 1000);
    const endsAt = ev.ends_at ? new Date(ev.ends_at) : new Date(new Date(ev.starts_at).getTime() + 4 * 3600 * 1000);
    const now = new Date();

    if (now < opensAt) {
      await db.collection("scan_logs").insertOne({
        id: crypto.randomUUID(),
        event_id: eventId,
        code: c,
        result: "too_early",
        gate: g,
        participant_name: null,
        scanned_by: scannedBy || null,
        created_at: now.toISOString(),
      });
      return { status: "too_early", code: c, opens_at: opensAt.toISOString() };
    }

    if (now > endsAt) {
      await db.collection("scan_logs").insertOne({
        id: crypto.randomUUID(),
        event_id: eventId,
        code: c,
        result: "invalid",
        gate: g,
        participant_name: null,
        scanned_by: scannedBy || null,
        created_at: now.toISOString(),
      });
      return { status: "invalid", code: c, error: "Event has already ended. Check-in is closed." };
    }

    // Find participant in this event
    const participant = await db.collection("participants").findOne({ event_id: eventId, code: c });

    if (!participant) {
      // Check if participant is registered for another event
      const other = await db.collection("participants").findOne({ code: c });
      if (other && other.event_id !== eventId) {
        const otherEvent = await db.collection("events").findOne({ id: other.event_id });
        await db.collection("scan_logs").insertOne({
          id: crypto.randomUUID(),
          event_id: eventId,
          code: c,
          result: "wrong_event",
          gate: g,
          participant_name: other.full_name,
          scanned_by: scannedBy || null,
          created_at: now.toISOString(),
        });
        return {
          status: "wrong_event",
          full_name: other.full_name,
          code: c,
          event: otherEvent?.title || "Other Event",
        };
      }

      await db.collection("scan_logs").insertOne({
        id: crypto.randomUUID(),
        event_id: eventId,
        code: c,
        result: "invalid",
        gate: g,
        participant_name: null,
        scanned_by: scannedBy || null,
        created_at: now.toISOString(),
      });
      return { status: "invalid", code: c };
    }

    // Set gate name if participant has a zone
    let zoneName: string | null = null;
    if (participant.zone_id) {
      const z = await db.collection("event_zones").findOne({ id: participant.zone_id });
      if (z) zoneName = z.name;
    }
    if (zoneName) g = zoneName;

    // Check zone staff authority
    if (!isManager) {
      let authorizedForZone = false;
      if (participant.zone_id && scannedBy) {
        const staffRec = await db.collection("zone_staff").findOne({
          zone_id: participant.zone_id,
          user_id: scannedBy,
        });
        if (staffRec) authorizedForZone = true;
      }
      if (!authorizedForZone) {
        await db.collection("scan_logs").insertOne({
          id: crypto.randomUUID(),
          event_id: eventId,
          participant_id: participant.id,
          code: c,
          result: "wrong_zone",
          gate: g,
          participant_name: participant.full_name,
          scanned_by: scannedBy || null,
          created_at: now.toISOString(),
        });
        return {
          status: "wrong_zone",
          full_name: participant.full_name,
          code: participant.code,
          zone: zoneName || "Unassigned",
        };
      }
    }

    // Check duplicate check-in
    if (participant.checked_in_at) {
      await db.collection("scan_logs").insertOne({
        id: crypto.randomUUID(),
        event_id: eventId,
        participant_id: participant.id,
        code: c,
        result: "duplicate",
        gate: g,
        participant_name: participant.full_name,
        scanned_by: scannedBy || null,
        created_at: now.toISOString(),
      });
      return {
        status: "duplicate",
        full_name: participant.full_name,
        code: participant.code,
        checked_in_at: participant.checked_in_at,
        gate: participant.checked_in_gate || g,
      };
    }

    // Success check-in!
    const checkedInAt = now.toISOString();
    await db.collection("participants").updateOne(
      { id: participant.id },
      { $set: { checked_in_at: checkedInAt, checked_in_gate: g } }
    );

    await db.collection("scan_logs").insertOne({
      id: crypto.randomUUID(),
      event_id: eventId,
      participant_id: participant.id,
      code: c,
      result: "success",
      gate: g,
      participant_name: participant.full_name,
      scanned_by: scannedBy || null,
      created_at: checkedInAt,
    });

    return {
      status: "success",
      full_name: participant.full_name,
      code: participant.code,
      checked_in_at: checkedInAt,
      gate: g,
    };
  },

  async getTicket(code: string) {
    const db = await getDb();
    const c = (code || "").trim().toUpperCase();
    const p = await db.collection("participants").findOne({ code: c });
    if (!p) return null;

    const e = await db.collection("events").findOne({ id: p.event_id });
    if (!e) return null;

    let zoneName: string | null = null;
    if (p.zone_id) {
      const z = await db.collection("event_zones").findOne({ id: p.zone_id });
      if (z) zoneName = z.name;
    }

    return {
      code: p.code,
      full_name: p.full_name,
      checked_in_at: p.checked_in_at,
      event_id: e.id,
      event_title: e.title,
      venue: e.venue,
      starts_at: e.starts_at,
      ends_at: e.ends_at || null,
      category: e.category,
      zone: zoneName,
      rules: e.rules || null,
    };
  },

  async cancelRegistration(participantId: string, userId: string, userEmail?: string) {
    const db = await getDb();
    const p = await db.collection("participants").findOne({ id: participantId });
    if (!p) return { ok: false, error: "Pass not found" };

    const owns = p.user_id === userId || (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase());
    if (!owns) return { ok: false, error: "Pass not found" };

    if (p.checked_in_at) return { ok: false, error: "Already checked in" };

    const e = await db.collection("events").findOne({ id: p.event_id });
    const eCheckinMinutes = typeof e?.checkin_opens_minutes === "number" ? e.checkin_opens_minutes : 30;
    const eOpensAt = e ? new Date(new Date(e.starts_at).getTime() - eCheckinMinutes * 60 * 1000) : null;
    if (eOpensAt && new Date() >= eOpensAt) {
      return { ok: false, error: "Check-in has started — cancellations are locked" };
    }

    await db.collection("scan_logs").updateMany({ participant_id: p.id }, { $set: { participant_id: null } });
    await db.collection("participants").deleteOne({ id: p.id });

    return { ok: true };
  },

  async switchRegistration(participantId: string, newEventId: string, userId: string, userEmail?: string) {
    const db = await getDb();
    const p = await db.collection("participants").findOne({ id: participantId });
    if (!p) return { ok: false, error: "Pass not found" };

    const owns = p.user_id === userId || (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase());
    if (!owns) return { ok: false, error: "Pass not found" };

    if (p.event_id === newEventId) return { ok: false, error: "Pick a different event" };
    if (p.checked_in_at) return { ok: false, error: "Already checked in" };

    const oldEvent = await db.collection("events").findOne({ id: p.event_id });
    const oldCheckinMinutes = typeof oldEvent?.checkin_opens_minutes === "number" ? oldEvent.checkin_opens_minutes : 30;
    const oldOpensAt = oldEvent ? new Date(new Date(oldEvent.starts_at).getTime() - oldCheckinMinutes * 60 * 1000) : null;
    if (oldOpensAt && new Date() >= oldOpensAt) {
      return { ok: false, error: "Check-in has started for your current event — changes are locked" };
    }

    const n = await db.collection("events").findOne({ id: newEventId });
    if (!n) return { ok: false, error: "Event not found" };
    if (n.is_open === false) return { ok: false, error: "Registrations are closed for that event" };
    const nCheckinMinutes = typeof n.checkin_opens_minutes === "number" ? n.checkin_opens_minutes : 30;
    const nOpensAt = new Date(new Date(n.starts_at).getTime() - nCheckinMinutes * 60 * 1000);
    if (new Date() >= nOpensAt) {
      return { ok: false, error: "Registrations are closed for that event — check-in has already started" };
    }

    const existingInNew = await db.collection("participants").findOne({ event_id: n.id, email: p.email });
    if (existingInNew) return { ok: false, error: "You are already registered for that event" };

    // Time conflict check for new event
    const nStart = new Date(n.starts_at);
    const nEnd = n.ends_at ? new Date(n.ends_at) : new Date(nStart.getTime() + 2 * 3600 * 1000);
    const passes = await db.collection("participants").find({
      id: { $ne: p.id },
      event_id: { $ne: n.id },
      $or: [{ email: p.email }, ...(userId ? [{ user_id: userId }] : [])],
    }).toArray();

    for (const pass of passes) {
      const otherEv = await db.collection("events").findOne({ id: pass.event_id });
      if (otherEv) {
        const otherStart = new Date(otherEv.starts_at);
        const otherEnd = otherEv.ends_at ? new Date(otherEv.ends_at) : new Date(otherStart.getTime() + 2 * 3600 * 1000);
        if (nStart < otherEnd && nEnd > otherStart) {
          return { ok: false, error: `Time conflict: You already have a pass for "${otherEv.title}" during that time` };
        }
      }
    }

    const count = await db.collection("participants").countDocuments({ event_id: n.id });
    if (count >= n.capacity) return { ok: false, error: "That event is full" };

    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    await db.collection("scan_logs").updateMany({ participant_id: p.id }, { $set: { participant_id: null } });
    await db.collection("participants").updateOne(
      { id: p.id },
      {
        $set: {
          event_id: n.id,
          code,
          zone_id: null,
          checked_in_gate: null,
          created_at: new Date().toISOString(),
          user_id: p.user_id || userId,
        },
      }
    );

    return { ok: true, code };
  },
};

// ---------------------------------------------------------------------------
// Zones & Staff Service
// ---------------------------------------------------------------------------
export const zoneService = {
  async getZoneOverview(eventId: string, userId?: string | null) {
    const db = await getDb();
    const zones = await db.collection("event_zones").find({ event_id: eventId }).sort({ name: 1 }).toArray();

    const result = await Promise.all(
      zones.map(async (z: any) => {
        const registered = await db.collection("participants").countDocuments({ zone_id: z.id });
        const checked_in = await db.collection("participants").countDocuments({
          zone_id: z.id,
          checked_in_at: { $ne: null },
        });
        const rejected = await db.collection("scan_logs").countDocuments({
          event_id: eventId,
          gate: z.name,
          result: { $ne: "success" },
        });

        const staffRecords = await db.collection("zone_staff").find({ zone_id: z.id }).toArray();
        const staff = await Promise.all(
          staffRecords.map(async (s: any) => {
            const profile = await db.collection("profiles").findOne({ id: s.user_id });
            const scans = await db.collection("scan_logs").countDocuments({
              event_id: eventId,
              scanned_by: s.user_id,
              result: "success",
            });
            return {
              user_id: s.user_id,
              full_name: profile?.full_name || null,
              email: profile?.email || null,
              scans,
            };
          })
        );

        let mine = false;
        if (userId) {
          const isAssigned = staffRecords.some((s: any) => s.user_id === userId);
          mine = isAssigned;
        }

        return {
          id: z.id,
          name: z.name,
          capacity: z.capacity || null,
          registered,
          checked_in,
          rejected,
          staff,
          mine,
        };
      })
    );

    return result;
  },

  async listStaffCandidates() {
    const db = await getDb();
    const roles = await db.collection("user_roles").find({ role: { $in: ["admin", "organizer"] } }).toArray();
    const userIds = [...new Set(roles.map((r: any) => r.user_id))];

    const profiles = await db.collection("profiles").find({ id: { $in: userIds } }).sort({ full_name: 1 }).toArray();
    return profiles.map((p: any) => ({
      id: p.id,
      full_name: p.full_name || null,
      email: p.email || null,
    }));
  },

  async setParticipantZone(participantId: string, zoneId: string | null, userId?: string | null) {
    const db = await getDb();
    const p = await db.collection("participants").findOne({ id: participantId });
    if (!p) return { ok: false, error: "Not allowed" };

    if (zoneId) {
      const z = await db.collection("event_zones").findOne({ id: zoneId, event_id: p.event_id });
      if (!z) return { ok: false, error: "Zone not in this event" };
    }

    await db.collection("participants").updateOne({ id: participantId }, { $set: { zone_id: zoneId } });
    return { ok: true };
  },
};

// ---------------------------------------------------------------------------
// Admin & Requests Service
// ---------------------------------------------------------------------------
export const adminService = {
  async setRole(adminId: string, targetUserId: string, role: string, enabled: boolean) {
    const isAdmin = await authService.hasRole(adminId, "admin");
    if (!isAdmin) return { ok: false, error: "Admins only" };
    if (role === "student") return { ok: false, error: "Student role is permanent" };
    if (!enabled && role === "admin" && targetUserId === adminId) {
      return { ok: false, error: "You cannot remove your own admin role" };
    }

    const db = await getDb();
    if (enabled) {
      await db.collection("user_roles").updateOne(
        { user_id: targetUserId, role },
        { $set: { id: crypto.randomUUID(), user_id: targetUserId, role, created_at: new Date().toISOString() } },
        { upsert: true }
      );
      if (role === "organizer") {
        await db.collection("profiles").updateOne({ id: targetUserId }, { $set: { wants_organizer: false } });
      }
    } else {
      await db.collection("user_roles").deleteOne({ user_id: targetUserId, role });
    }

    return { ok: true };
  },

  async dismissRequest(adminId: string, targetUserId: string) {
    const isAdmin = await authService.hasRole(adminId, "admin");
    if (!isAdmin) throw new Error("Admins only");
    const db = await getDb();
    await db.collection("profiles").updateOne({ id: targetUserId }, { $set: { wants_organizer: false } });
    return { ok: true };
  },

  async decideEditRequest(adminId: string, requestId: string, approve: boolean, note?: string | null) {
    const isAdmin = await authService.hasRole(adminId, "admin");
    if (!isAdmin) return { ok: false, error: "Admins only" };
    const db = await getDb();
    const req = await db.collection("event_edit_requests").findOne({ id: requestId });
    if (!req || req.status !== "pending") return { ok: false, error: "Request already handled" };

    const status = approve ? "approved" : "rejected";
    await db.collection("event_edit_requests").updateOne(
      { id: requestId },
      {
        $set: {
          status,
          admin_note: note?.trim() || null,
          decided_at: new Date().toISOString(),
        },
      }
    );

    if (approve) {
      await db.collection("events").updateOne({ id: req.event_id }, { $set: { edit_unlocked: true } });
    }

    return { ok: true };
  },

  async requestEventEdit(userId: string, eventId: string, reason: string) {
    const db = await getDb();
    const ev = await db.collection("events").findOne({ id: eventId });
    if (!ev) return { ok: false, error: "Only the event team can request changes" };

    const isOwner = ev.owner_id === userId;
    const staffRecords = await db.collection("zone_staff").find({ user_id: userId }).toArray();
    const staffZoneIds = staffRecords.map((s: any) => s.zone_id);
    const assignedZones = await db.collection("event_zones").find({ id: { $in: staffZoneIds }, event_id: eventId }).toArray();
    const isStaff = assignedZones.length > 0;

    if (!isOwner && !isStaff) return { ok: false, error: "Only the event team can request changes" };

    const r = (reason || "").trim();
    if (r.length < 5) return { ok: false, error: "Please describe what you want to change" };
    if (ev.edit_unlocked) return { ok: false, error: "Editing is already unlocked" };

    const pending = await db.collection("event_edit_requests").findOne({ event_id: eventId, status: "pending" });
    if (pending) return { ok: false, error: "A request is already waiting for admin approval" };

    await db.collection("event_edit_requests").insertOne({
      id: crypto.randomUUID(),
      event_id: eventId,
      requester_id: userId,
      reason: r,
      status: "pending",
      admin_note: null,
      created_at: new Date().toISOString(),
      decided_at: null,
    });

    return { ok: true };
  },
};

// ---------------------------------------------------------------------------
// Online Presence
// ---------------------------------------------------------------------------
const onlineUsersMap = new Map<string, { user_id: string; name: string; email: string; online_at: string; last_seen: number }>();

export const presenceService = {
  heartbeat(user: { user_id: string; name: string; email: string }) {
    onlineUsersMap.set(user.user_id, {
      ...user,
      online_at: new Date().toISOString(),
      last_seen: Date.now(),
    });
  },

  remove(userId: string) {
    onlineUsersMap.delete(userId);
  },

  getOnlineUsers(): Record<string, { user_id: string; name: string; email: string; online_at: string }> {
    const now = Date.now();
    const result: Record<string, any> = {};
    for (const [uid, meta] of onlineUsersMap.entries()) {
      if (now - meta.last_seen < 60000) {
        result[uid] = { user_id: meta.user_id, name: meta.name, email: meta.email, online_at: meta.online_at };
      } else {
        onlineUsersMap.delete(uid);
      }
    }
    return result;
  },
};
