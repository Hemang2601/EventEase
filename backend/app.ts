import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./mongo";
import {
  authService,
  eventService,
  participantService,
  zoneService,
  adminService,
  presenceService,
} from "./services";
import { seedDatabase } from "./seed";

export const app = express();

const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static(uploadsDir));

// Ensure DB is initialized and seeded
let isSeeded = false;
async function ensureDbReady() {
  if (!isSeeded) {
    try {
      await seedDatabase(false);
      isSeeded = true;
    } catch (err) {
      console.warn("[App] Initial seed check warning:", err);
    }
  }
}

// Middleware to extract user from Authorization header
async function userMiddleware(req: Request, _res: Response, next: NextFunction) {
  await ensureDbReady();
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const user = await authService.getUserFromToken(authHeader);
    (req as any).user = user;
  }
  next();
}

app.use(userMiddleware);

// ---------------------------------------------------------------------------
// Health & Seed
// ---------------------------------------------------------------------------
app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    res.json({ ok: true, database: db.databaseName, time: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/seed", async (_req: Request, res: Response) => {
  try {
    await seedDatabase(true);
    res.json({ ok: true, message: "Database seeded successfully" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Image & Storage Upload
// ---------------------------------------------------------------------------
app.post(["/api/storage/upload", "/api/upload"], async (req: Request, res: Response) => {
  try {
    const { bucket, path: uploadPath, dataUrl, base64 } = req.body;
    const rawData = dataUrl || base64;
    if (!rawData) {
      return res.status(400).json({ data: null, error: { message: "No image data provided" } });
    }

    // Extract base64 and mime type
    const matches = typeof rawData === "string" ? rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/) : null;
    let ext = "jpg";
    let buffer: Buffer;

    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes("png")) ext = "png";
      else if (mime.includes("webp")) ext = "webp";
      else if (mime.includes("gif")) ext = "gif";
      buffer = Buffer.from(matches[2], "base64");
    } else {
      buffer = Buffer.from(rawData, "base64");
    }

    const filename = `img_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;
    console.log(`[Storage] Saved uploaded image: ${filename} (${buffer.length} bytes)`);

    return res.json({
      data: {
        path: publicUrl,
        publicUrl,
        fullPath: publicUrl,
      },
      error: null,
    });
  } catch (err: any) {
    console.error("[Storage] Upload error:", err);
    return res.status(500).json({ data: null, error: { message: err.message || "Failed to upload image" } });
  }
});

// ---------------------------------------------------------------------------
// Auth Endpoints
// ---------------------------------------------------------------------------
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, options } = req.body;
    const fullName = options?.data?.full_name || req.body.full_name;
    const accountType = options?.data?.account_type || req.body.account_type;

    const result = await authService.signUp({ email, password, fullName, accountType });
    res.json({ data: { user: result.user, session: { access_token: result.access_token, user: result.user } }, error: null });
  } catch (err: any) {
    res.json({ data: { user: null, session: null }, error: { message: err.message } });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json({ data: { user: result.user, session: { access_token: result.access_token, user: result.user } }, error: null });
  } catch (err: any) {
    res.json({ data: { user: null, session: null }, error: { message: err.message } });
  }
});

app.get("/api/auth/user", async (req: Request, res: Response) => {
  const user = (req as any).user || null;
  res.json({ data: { user }, error: null });
});

app.get("/api/auth/session", async (req: Request, res: Response) => {
  const user = (req as any).user || null;
  const token = req.headers.authorization?.replace("Bearer ", "") || null;
  res.json({
    data: {
      session: user && token ? { access_token: token, user } : null,
    },
    error: null,
  });
});

app.post("/api/auth/logout", (_req: Request, res: Response) => {
  res.json({ error: null });
});

app.put("/api/auth/user", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { data } = req.body;
    const db = await getDb();
    if (data?.full_name) {
      await db.collection("profiles").updateOne({ id: user.id }, { $set: { full_name: data.full_name } });
      await db.collection("users").updateOne({ id: user.id }, { $set: { full_name: data.full_name } });
      user.user_metadata.full_name = data.full_name;
    }
    res.json({ data: { user }, error: null });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// RPC Endpoints
// ---------------------------------------------------------------------------
app.post("/api/rpc/:functionName", async (req: Request, res: Response) => {
  const { functionName } = req.params;
  const args = req.body || {};
  const user = (req as any).user;

  try {
    switch (functionName) {
      case "register_participant": {
        const result = await participantService.registerParticipant({
          eventId: args._event_id,
          fullName: args._full_name,
          email: args._email,
          phone: args._phone,
          department: args._department,
          userId: user?.id,
        });
        return res.json({ data: result, error: null });
      }

      case "check_in_participant": {
        const result = await participantService.checkInParticipant({
          eventId: args._event_id,
          code: args._code,
          gate: args._gate,
          scannedBy: user?.id,
        });
        return res.json({ data: result, error: null });
      }

      case "get_ticket": {
        const result = await participantService.getTicket(args._code);
        return res.json({ data: result, error: null });
      }

      case "event_stats": {
        const result = await eventService.getStats(args._event_id);
        return res.json({ data: result, error: null });
      }

      case "batch_event_stats": {
        const result = await eventService.getBatchStats(args._event_ids ?? []);
        return res.json({ data: result, error: null });
      }

      case "zone_overview": {
        const result = await zoneService.getZoneOverview(args._event_id, user?.id);
        return res.json({ data: result, error: null });
      }

      case "list_staff_candidates": {
        const result = await zoneService.listStaffCandidates();
        return res.json({ data: result, error: null });
      }

      case "cancel_registration": {
        const result = await participantService.cancelRegistration(args._participant_id, user?.id, user?.email);
        return res.json({ data: result, error: null });
      }

      case "switch_registration": {
        const result = await participantService.switchRegistration(args._participant_id, args._new_event_id, user?.id, user?.email);
        return res.json({ data: result, error: null });
      }

      case "admin_set_role": {
        const result = await adminService.setRole(user?.id, args._user_id, args._role, args._enabled);
        return res.json({ data: result, error: null });
      }

      case "admin_dismiss_request": {
        const result = await adminService.dismissRequest(user?.id, args._user_id);
        return res.json({ data: result, error: null });
      }

      case "admin_decide_edit_request": {
        const result = await adminService.decideEditRequest(user?.id, args._request_id, args._approve, args._note);
        return res.json({ data: result, error: null });
      }

      case "request_event_edit": {
        const result = await adminService.requestEventEdit(user?.id, args._event_id, args._reason);
        return res.json({ data: result, error: null });
      }

      case "set_participant_zone": {
        const result = await zoneService.setParticipantZone(args._participant_id, args._zone_id, user?.id);
        return res.json({ data: result, error: null });
      }

      case "has_role": {
        const result = await authService.hasRole(args._user_id, args._role);
        return res.json({ data: result, error: null });
      }

      default:
        return res.status(404).json({ data: null, error: { message: `Function '${functionName}' not found` } });
    }
  } catch (err: any) {
    return res.json({ data: null, error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// Database Collection Queries (/api/data/:collection)
// ---------------------------------------------------------------------------
function normalizeEventDoc(doc: any) {
  if (!doc) return doc;
  return {
    ...doc,
    id: doc.id || doc._id?.toString(),
    title: doc.title || doc.name || "Untitled Event",
    starts_at: doc.starts_at
      ? (typeof doc.starts_at === "string" ? doc.starts_at : new Date(doc.starts_at).toISOString())
      : (doc.date ? new Date(doc.date).toISOString() : new Date().toISOString()),
    ends_at: doc.ends_at
      ? (typeof doc.ends_at === "string" ? doc.ends_at : new Date(doc.ends_at).toISOString())
      : null,
    is_open: doc.is_open !== undefined ? doc.is_open : (doc.isActive !== undefined ? !!doc.isActive : true),
    category: ["Technology", "Hackathon", "Workshop", "Cultural", "Networking"].includes(doc.category)
      ? doc.category
      : (doc.category === "Cultural" ? "Cultural" : "Technology"),
    checkin_opens_minutes: typeof doc.checkin_opens_minutes === "number" ? doc.checkin_opens_minutes : 30,
    venue: doc.venue ?? "",
    description: doc.description ?? "",
    rules: doc.rules ?? "",
    capacity: typeof doc.capacity === "number" ? doc.capacity : 100,
    owner_id: doc.owner_id || (doc.createdBy ? doc.createdBy.toString() : ""),
    cover_url: doc.cover_url || doc.banner || null,
    host_photo_url: doc.host_photo_url || null,
    host_name: doc.host_name || null,
  };
}

function normalizeParticipantDoc(doc: any) {
  if (!doc) return doc;
  return {
    ...doc,
    id: doc.id || doc._id?.toString(),
    event_id: doc.event_id ? doc.event_id.toString() : (doc.eventId ? doc.eventId.toString() : ""),
    full_name: doc.full_name || doc.name || "Participant",
    code: doc.code || doc.entryCode || "",
    email: doc.email || "",
    checked_in_at: doc.checked_in_at || (doc.checkInTime ? new Date(doc.checkInTime).toISOString() : null),
  };
}

app.post("/api/data/:collection", async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { action, query, data: bodyData } = req.body;
  const user = (req as any).user;
  const db = await getDb();
  const col = db.collection(collection);

  try {
    switch (action) {
      case "select": {
        let filter: any = {};

        // Parse filters
        if (query?.filters && Array.isArray(query.filters)) {
          for (const f of query.filters) {
            if (f.op === "eq") filter[f.col] = f.val;
            else if (f.op === "neq") filter[f.col] = { $ne: f.val };
            else if (f.op === "gt") filter[f.col] = { $gt: f.val };
            else if (f.op === "gte") filter[f.col] = { $gte: f.val };
            else if (f.op === "lt") filter[f.col] = { $lt: f.val };
            else if (f.op === "lte") filter[f.col] = { $lte: f.val };
            else if (f.op === "in") filter[f.col] = { $in: f.val };
            else if (f.op === "ilike") filter[f.col] = { $regex: new RegExp(f.val.replace(/[%]/g, ".*"), "i") };
          }
        }

        if (query?.or) {
          // Parse PostgREST or format e.g. "user_id.eq.xxx,email.ilike.yyy"
          const orParts = query.or.split(",").map((p: string) => p.trim());
          const orConditions: any[] = [];
          for (const part of orParts) {
            const [c, op, ...rest] = part.split(".");
            const val = rest.join(".");
            if (op === "eq") orConditions.push({ [c]: val });
            else if (op === "ilike") orConditions.push({ [c]: { $regex: new RegExp(val.replace(/[%]/g, ".*"), "i") } });
            else if (op === "in") {
              const inVals = val.replace(/^\(|\)$/g, "").split(",");
              orConditions.push({ [c]: { $in: inVals } });
            }
          }
          if (orConditions.length) {
            if (Object.keys(filter).length > 0) {
              filter = { $and: [filter, { $or: orConditions }] };
            } else {
              filter = { $or: orConditions };
            }
          }
        }

        let cursor = col.find(filter);

        if (query?.order) {
          const sortDir = query.order.ascending ? 1 : -1;
          cursor = cursor.sort({ [query.order.col]: sortDir });
        }

        if (query?.limit) {
          cursor = cursor.limit(Number(query.limit));
        }

        let results = await cursor.toArray();

        // Handle relational joins if requested in select
        // 1. event_edit_requests -> events(title, starts_at)
        if (collection === "event_edit_requests" && query?.select?.includes("events(")) {
          const eventIds = [...new Set(results.map((r) => r.event_id))];
          const evs = (await db.collection("events").find({ id: { $in: eventIds } }).toArray()).map(normalizeEventDoc);
          const evMap = new Map(evs.map((e) => [e.id, { title: e.title, starts_at: e.starts_at }]));
          results = results.map((r) => ({ ...r, events: evMap.get(r.event_id) || null }));
        }

        // 2. zone_staff -> event_zones(name, event_id)
        if (collection === "zone_staff" && query?.select?.includes("event_zones(")) {
          const zoneIds = [...new Set(results.map((r) => r.zone_id))];
          const zones = await db.collection("event_zones").find({ id: { $in: zoneIds } }).toArray();
          const zoneMap = new Map(zones.map((z) => [z.id, { name: z.name, event_id: z.event_id }]));
          results = results.map((r) => ({ ...r, event_zones: zoneMap.get(r.zone_id) || null }));
        }

        // 3. support_tickets -> events(title)
        if (collection === "support_tickets" && query?.select?.includes("events(")) {
          const eventIds = [...new Set(results.map((r) => r.event_id).filter(Boolean))];
          const evs = (await db.collection("events").find({ id: { $in: eventIds } }).toArray()).map(normalizeEventDoc);
          const evMap = new Map(evs.map((e) => [e.id, { title: e.title }]));
          results = results.map((r) => ({ ...r, events: evMap.get(r.event_id) || null }));
        }

        // 4. participants -> events(title, venue, starts_at)
        if (collection === "participants" && query?.select?.includes("events(")) {
          const eventIds = [...new Set(results.map((r) => r.event_id))];
          const evs = (await db.collection("events").find({ id: { $in: eventIds } }).toArray()).map(normalizeEventDoc);
          const evMap = new Map(evs.map((e) => [e.id, { title: e.title, venue: e.venue, starts_at: e.starts_at, ends_at: e.ends_at }]));
          results = results.map((r) => ({ ...r, events: evMap.get(r.event_id) || null }));
        }

        if (collection === "events") {
          results = results.map(normalizeEventDoc);
        } else if (collection === "participants") {
          results = results.map(normalizeParticipantDoc);
        }

        if (query?.single || query?.maybeSingle) {
          const item = results[0] || null;
          return res.json({ data: item, error: null });
        }

        return res.json({ data: results, error: null });
      }

      case "insert": {
        const toInsert = Array.isArray(bodyData) ? bodyData : [bodyData];
        let insertedItems: any[] = [];

        for (const item of toInsert) {
          const id = item.id || crypto.randomUUID();
          const now = item.created_at || new Date().toISOString();
          const doc = { ...item, id, created_at: now };

          if (collection === "events") {
            if (doc.is_open === undefined) doc.is_open = true;
            if (doc.checkin_opens_minutes === undefined) doc.checkin_opens_minutes = 30;
            await eventService.validateEvent(doc, false);
          }

          await col.insertOne(doc);
          insertedItems.push(doc);
        }

        if (collection === "events") {
          insertedItems = insertedItems.map(normalizeEventDoc);
        } else if (collection === "participants") {
          insertedItems = insertedItems.map(normalizeParticipantDoc);
        }

        return res.json({ data: Array.isArray(bodyData) ? insertedItems : insertedItems[0], error: null });
      }

      case "update": {
        let filter: any = {};
        if (query?.filters && Array.isArray(query.filters)) {
          for (const f of query.filters) {
            if (f.op === "eq") filter[f.col] = f.val;
            else if (f.op === "in") filter[f.col] = { $in: f.val };
          }
        }

        if (collection === "events") {
          const targetEvent = await col.findOne(filter);
          if (targetEvent) {
            await eventService.validateEvent(bodyData, true, targetEvent.id);
            // Check edit lock
            if (user && !await authService.hasRole(user.id, "admin")) {
              const sensitiveFields = ["title", "description", "rules", "venue", "starts_at", "ends_at", "capacity", "category", "checkin_opens_minutes", "cover_url", "host_photo_url", "host_name"];
              const changedSensitive = sensitiveFields.some((f) => bodyData[f] !== undefined && bodyData[f] !== targetEvent[f]);
              if (changedSensitive) {
                if (!targetEvent.edit_unlocked) {
                  return res.status(400).json({ error: { message: "Editing is locked. Request permission from the admin first." } });
                }
                bodyData.edit_unlocked = false;
                await db.collection("event_edit_requests").updateMany(
                  { event_id: targetEvent.id, status: "approved" },
                  { $set: { status: "used" } }
                );
              }
            }
          }
        }

        await col.updateMany(filter, { $set: bodyData });
        let updated = await col.find(filter).toArray();
        if (collection === "events") {
          updated = updated.map(normalizeEventDoc);
        } else if (collection === "participants") {
          updated = updated.map(normalizeParticipantDoc);
        }
        return res.json({ data: updated, error: null });
      }

      case "delete": {
        let filter: any = {};
        if (query?.filters && Array.isArray(query.filters)) {
          for (const f of query.filters) {
            if (f.op === "eq") filter[f.col] = f.val;
            else if (f.op === "in") filter[f.col] = { $in: f.val };
          }
        }

        await col.deleteMany(filter);
        return res.json({ data: null, error: null });
      }

      case "upsert": {
        const doc = { ...bodyData, id: bodyData.id || crypto.randomUUID() };
        let filter: any = { id: doc.id };
        if (query?.onConflict) {
          const cols = query.onConflict.split(",");
          filter = {};
          for (const c of cols) filter[c.trim()] = doc[c.trim()];
        }
        await col.updateOne(filter, { $set: doc }, { upsert: true });
        return res.json({ data: doc, error: null });
      }

      default:
        return res.status(400).json({ error: { message: `Unknown action: ${action}` } });
    }
  } catch (err: any) {
    return res.status(400).json({ data: null, error: { message: err.message } });
  }
});

// ---------------------------------------------------------------------------
// Online Presence Endpoints
// ---------------------------------------------------------------------------
app.post("/api/presence/heartbeat", (req: Request, res: Response) => {
  const { user_id, name, email } = req.body;
  if (user_id) {
    presenceService.heartbeat({ user_id, name: name || "User", email: email || "" });
  }
  res.json({ ok: true });
});

app.get("/api/presence/online", (_req: Request, res: Response) => {
  res.json({ data: presenceService.getOnlineUsers() });
});
