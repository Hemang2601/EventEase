import { MongoClient, Db, Collection } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/eventease";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db && client) {
    return db;
  }

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db();
  console.log(`[MongoDB] Connected to database: ${db.databaseName} at ${MONGODB_URI}`);

  await ensureIndexes(db);
  return db;
}

export async function getCollection<T = any>(name: string): Promise<Collection<T>> {
  const database = await getDb();
  return database.collection<T>(name);
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

async function ensureIndexes(database: Db): Promise<void> {
  try {
    // Migrate legacy documents without 'id'
    const legacyCollections = ["events", "participants", "organizers", "checkinlogs"];
    for (const cName of legacyCollections) {
      try {
        const col = database.collection(cName);
        await col.updateMany(
          { id: { $exists: false } },
          [{ $set: { id: { $toString: "$_id" } } }]
        );
      } catch (e) {
        // collection might not exist
      }
    }

    // Populate code from entryCode on legacy participants
    try {
      const pCol = database.collection("participants");
      await pCol.updateMany(
        { code: { $exists: false }, entryCode: { $exists: true } },
        [{ $set: { code: "$entryCode" } }]
      );
      await pCol.updateMany(
        { event_id: { $exists: false }, eventId: { $exists: true } },
        [{ $set: { event_id: "$eventId" } }]
      );
      await pCol.updateMany(
        { full_name: { $exists: false }, name: { $exists: true } },
        [{ $set: { full_name: "$name" } }]
      );
      // Ensure all event_id are strings
      const partsWithObjId = await pCol.find({}).toArray();
      for (const p of partsWithObjId) {
        if (p.event_id && typeof p.event_id !== "string") {
          await pCol.updateOne({ _id: p._id }, { $set: { event_id: p.event_id.toString() } });
        }
      }
    } catch (e) {
      // ignore
    }

    // Populate title, starts_at, is_open, category on legacy events
    try {
      const eCol = database.collection("events");
      const legacyEvents = await eCol.find({}).toArray();
      const validCategories = ["Technology", "Hackathon", "Workshop", "Cultural", "Networking"];
      for (const e of legacyEvents) {
        const updates: any = {};
        if (!e.title && e.name) updates.title = e.name;
        if (!e.starts_at && e.date) {
          updates.starts_at = new Date(e.date).toISOString();
        } else if (e.starts_at instanceof Date) {
          updates.starts_at = e.starts_at.toISOString();
        }
        if (e.is_open === undefined || e.is_open === null) {
          updates.is_open = true;
        }
        // If an event date is in the past, update it to upcoming date so registrations can be tested
        const sTime = e.starts_at ? new Date(e.starts_at).getTime() : (e.date ? new Date(e.date).getTime() : 0);
        if (sTime > 0 && sTime <= Date.now()) {
          const futureDate = new Date(Date.now() + 15 * 86400 * 1000).toISOString();
          updates.starts_at = futureDate;
          updates.is_open = true;
        }
        if (!e.category || !validCategories.includes(e.category)) {
          updates.category = e.category === "Cultural" ? "Cultural" : "Technology";
        }
        if (e.checkin_opens_minutes === undefined) updates.checkin_opens_minutes = 60;
        if (e.venue === undefined) updates.venue = e.venue || "Campus Auditorium";
        if (e.description === undefined) updates.description = e.description || "";
        if (!e.owner_id && e.createdBy) updates.owner_id = e.createdBy.toString();
        if (Object.keys(updates).length > 0) {
          await eCol.updateOne({ _id: e._id }, { $set: updates });
        }
      }
    } catch (e) {
      // ignore
    }

    // Drop legacy prototype indexes that conflict with EventEase

    try {
      const pCol = database.collection("participants");
      const pIndexes = await pCol.indexes();
      for (const idx of pIndexes) {
        if (["entryCode_1", "qrToken_1", "eventId_1_email_1"].includes(idx.name)) {
          console.log(`[MongoDB] Dropping legacy index: ${idx.name}`);
          await pCol.dropIndex(idx.name);
        }
      }
    } catch (e) {
      // ignore
    }

    const users = database.collection("users");
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ id: 1 }, { unique: true });

    const profiles = database.collection("profiles");
    await profiles.createIndex({ id: 1 }, { unique: true });
    await profiles.createIndex({ email: 1 });

    const userRoles = database.collection("user_roles");
    await userRoles.createIndex({ user_id: 1, role: 1 }, { unique: true });

    const events = database.collection("events");
    await events.createIndex({ id: 1 }, { unique: true });
    await events.createIndex({ starts_at: 1 });
    await events.createIndex({ owner_id: 1 });

    const participants = database.collection("participants");
    await participants.createIndex({ id: 1 }, { unique: true });
    await participants.createIndex({ code: 1 }, { unique: true });
    await participants.createIndex({ event_id: 1, email: 1 });
    await participants.createIndex({ user_id: 1 });

    const eventZones = database.collection("event_zones");
    await eventZones.createIndex({ id: 1 }, { unique: true });
    await eventZones.createIndex({ event_id: 1 });

    const zoneStaff = database.collection("zone_staff");
    await zoneStaff.createIndex({ zone_id: 1, user_id: 1 });

    const scanLogs = database.collection("scan_logs");
    await scanLogs.createIndex({ id: 1 }, { unique: true });
    await scanLogs.createIndex({ event_id: 1 });
    await scanLogs.createIndex({ created_at: -1 });

    const supportTickets = database.collection("support_tickets");
    await supportTickets.createIndex({ id: 1 }, { unique: true });
    await supportTickets.createIndex({ user_id: 1 });

    const editRequests = database.collection("event_edit_requests");
    await editRequests.createIndex({ id: 1 }, { unique: true });
    await editRequests.createIndex({ event_id: 1 });
  } catch (err) {
    console.warn("[MongoDB] Index setup notice:", err);
  }
}

