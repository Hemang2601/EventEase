import crypto from "node:crypto";
import { getDb } from "./mongo";

export function hashPassword(password: string): string {
  const salt = "eventease_salt_v1";
  return crypto.pbkdf2Sync(password, salt, 1000, 32, "sha256").toString("hex");
}

export async function seedDatabase(force = false): Promise<void> {
  const db = await getDb();
  const usersCol = db.collection("users");
  const eventsCol = db.collection("events");

  const usersCount = await usersCol.countDocuments();
  const eventsCount = await eventsCol.countDocuments();

  if (!force && usersCount > 0 && eventsCount > 0) {
    console.log("[Seed] Database already contains data. Checking key admin accounts...");
    await ensureCoreAccounts(db);
    return;
  }

  console.log("[Seed] Populating MongoDB with initial EventEase data...");

  const defaultPasswordHash = hashPassword("EventEase@123");

  // Core Demo Users
  const seedUsers = [
    {
      id: "70051d5f-70db-479c-8d6a-88440829fe6a",
      email: "admin@gmail.com",
      password_hash: defaultPasswordHash,
      full_name: "EventEase Admin",
      created_at: new Date("2026-10-08T04:02:45.574Z").toISOString(),
      roles: ["admin", "organizer", "student"],
    },
    {
      id: "50a6d3df-a26b-469b-81d6-60891548a13e",
      email: "organizer@gmail.com",
      password_hash: defaultPasswordHash,
      full_name: "Yuvraj Gosai (Organizer)",
      created_at: new Date("2026-10-08T05:00:19.615Z").toISOString(),
      roles: ["organizer", "student"],
    },
    {
      id: "33320d30-af66-4fdd-a08f-6523fd03e0a3",
      email: "student@gmail.com",
      password_hash: defaultPasswordHash,
      full_name: "Student Demo",
      created_at: new Date("2026-10-08T05:00:18.702Z").toISOString(),
      roles: ["student"],
    },
    {
      id: "3d00ec25-a791-427c-a1db-0f710904fa15",
      email: "meera@gmail.com",
      password_hash: defaultPasswordHash,
      full_name: "Meera Shah",
      created_at: new Date("2026-10-08T05:11:43.600Z").toISOString(),
      roles: ["organizer", "student"],
    },
    {
      id: "cfa510ce-4688-4d8c-ae5f-7b95ad02c3a5",
      email: "demo@gmail.com",
      password_hash: defaultPasswordHash,
      full_name: "Demo Account",
      created_at: new Date("2026-10-08T11:08:16.378Z").toISOString(),
      roles: ["student"],
    },
  ];

  for (const u of seedUsers) {
    await usersCol.updateOne(
      { email: u.email.toLowerCase() },
      {
        $set: {
          id: u.id,
          email: u.email.toLowerCase(),
          password_hash: u.password_hash,
          full_name: u.full_name,
          created_at: u.created_at,
        },
      },
      { upsert: true }
    );

    await db.collection("profiles").updateOne(
      { id: u.id },
      {
        $set: {
          id: u.id,
          email: u.email.toLowerCase(),
          full_name: u.full_name,
          wants_organizer: false,
          created_at: u.created_at,
        },
      },
      { upsert: true }
    );

    for (const role of u.roles) {
      await db.collection("user_roles").updateOne(
        { user_id: u.id, role },
        {
          $set: {
            id: crypto.randomUUID(),
            user_id: u.id,
            role,
            created_at: u.created_at,
          },
        },
        { upsert: true }
      );
    }
  }

  // Events from demo-data.sql
  const seedEvents = [
    {
      id: "dd411667-b555-44f4-b61b-fff7d999d659",
      owner_id: "70051d5f-70db-479c-8d6a-88440829fe6a",
      title: "Code Carnival Hackathon",
      description: "24-hour coding hackathon with prizes worth 1 lakh.",
      venue: "Computer Lab Block C",
      starts_at: "2026-10-13T04:15:00.000Z",
      capacity: 100,
      category: "Technology",
      is_open: true,
      checkin_opens_minutes: 30,
      cover_url: null,
      host_photo_url: null,
      host_name: "CSI Student Chapter",
      edit_unlocked: false,
      created_at: "2026-10-08T04:15:31.187Z",
    },
    {
      id: "90c8e98d-5f8d-400b-83b2-7b4da2e7d155",
      owner_id: "70051d5f-70db-479c-8d6a-88440829fe6a",
      title: "Tech Fest 2026",
      description: "Annual technology festival with project exhibitions, robotics and AI demos.",
      venue: "Main Auditorium, Atmiya University",
      starts_at: "2026-10-18T04:15:31.187Z",
      capacity: 200,
      category: "Technology",
      is_open: true,
      checkin_opens_minutes: 30,
      cover_url: null,
      host_photo_url: null,
      host_name: "Prof. Yuvraj Gosai",
      edit_unlocked: false,
      created_at: "2026-10-08T04:15:31.187Z",
    },
    {
      id: "f2fb1850-867b-46ee-ac63-4c21ec17eed2",
      owner_id: "70051d5f-70db-479c-8d6a-88440829fe6a",
      title: "Cultural Night",
      description: "Music, dance and drama performances by student clubs.",
      venue: "Open Air Theatre",
      starts_at: "2026-10-23T04:15:31.187Z",
      capacity: 500,
      category: "Cultural",
      is_open: true,
      checkin_opens_minutes: 30,
      cover_url: null,
      host_photo_url: null,
      host_name: "Cultural Committee",
      edit_unlocked: false,
      created_at: "2026-10-08T04:15:31.187Z",
    },
    {
      id: "6fda74f5-8039-4f87-b514-f08f0dae7d38",
      owner_id: "70051d5f-70db-479c-8d6a-88440829fe6a",
      title: "Inter-College Sports Meet",
      description: "Cricket, football, athletics and indoor games across colleges.",
      venue: "University Sports Ground",
      starts_at: "2026-10-28T04:15:31.187Z",
      capacity: 300,
      category: "Sports",
      is_open: true,
      checkin_opens_minutes: 30,
      cover_url: null,
      host_photo_url: null,
      host_name: "Sports Department",
      edit_unlocked: false,
      created_at: "2026-10-08T04:15:31.187Z",
    },
    {
      id: "12aae9a1-46f0-42f1-b5d0-304b2aec460c",
      owner_id: "70051d5f-70db-479c-8d6a-88440829fe6a",
      title: "Atmiya Avsar",
      description: "Annual university youth carnival with competitions and exhibitions.",
      venue: "Campus Ground",
      starts_at: "2026-10-10T02:30:00.000Z",
      capacity: 100,
      category: "Technology",
      is_open: true,
      checkin_opens_minutes: 30,
      cover_url: null,
      host_photo_url: null,
      host_name: "Student Council",
      edit_unlocked: false,
      created_at: "2026-10-08T03:45:12.664Z",
    },
    {
      id: "9511ca8d-cb73-4cd3-af91-606a6aad496d",
      owner_id: "70051d5f-70db-479c-8d6a-88440829fe6a",
      title: "Culture Branding",
      description: "Creative design and branding showcase.",
      venue: "Design Hall",
      starts_at: "2026-10-17T03:53:00.000Z",
      capacity: 100,
      category: "Technology",
      is_open: true,
      checkin_opens_minutes: 30,
      cover_url: null,
      host_photo_url: null,
      host_name: null,
      edit_unlocked: false,
      created_at: "2026-10-08T03:53:55.343Z",
    },
  ];

  for (const ev of seedEvents) {
    await eventsCol.updateOne(
      { id: ev.id },
      { $set: ev },
      { upsert: true }
    );
  }

  // Event Zones (Halls)
  const seedZones = [
    { id: "39943f68-8de9-44dd-85be-cda07217863c", event_id: "dd411667-b555-44f4-b61b-fff7d999d659", name: "Auditorium 1", capacity: 50, created_at: "2026-10-08T04:24:43.716Z" },
    { id: "873c3291-d29e-444c-9e36-d9798894fbe7", event_id: "dd411667-b555-44f4-b61b-fff7d999d659", name: "Auditorium 2", capacity: 30, created_at: "2026-10-08T04:24:43.716Z" },
    { id: "17de190b-3ea2-471c-8f1c-448bed3c052d", event_id: "dd411667-b555-44f4-b61b-fff7d999d659", name: "Auditorium 3", capacity: 20, created_at: "2026-10-08T04:24:43.716Z" },
    { id: "c100f5bb-7ea2-4445-aed0-9f027e4f9524", event_id: "90c8e98d-5f8d-400b-83b2-7b4da2e7d155", name: "Main Hall", capacity: 100, created_at: "2026-10-08T05:10:29.925Z" },
    { id: "867a7caf-ff5c-41d6-a01e-1528de9b4479", event_id: "90c8e98d-5f8d-400b-83b2-7b4da2e7d155", name: "Lab Block", capacity: 50, created_at: "2026-10-08T05:10:29.925Z" },
    { id: "f079dec3-4bed-4df3-83d3-fd936512bb1a", event_id: "12aae9a1-46f0-42f1-b5d0-304b2aec460c", name: "Auditorium 4", capacity: 250, created_at: "2026-10-08T07:41:19.692Z" },
  ];

  for (const z of seedZones) {
    await db.collection("event_zones").updateOne(
      { id: z.id },
      { $set: z },
      { upsert: true }
    );
  }

  // Zone Staff
  const seedStaff = [
    { id: crypto.randomUUID(), zone_id: "39943f68-8de9-44dd-85be-cda07217863c", user_id: "70051d5f-70db-479c-8d6a-88440829fe6a", created_at: "2026-10-08T05:10:29.925Z" },
    { id: crypto.randomUUID(), zone_id: "867a7caf-ff5c-41d6-a01e-1528de9b4479", user_id: "50a6d3df-a26b-469b-81d6-60891548a13e", created_at: "2026-10-08T05:10:29.925Z" },
    { id: crypto.randomUUID(), zone_id: "c100f5bb-7ea2-4445-aed0-9f027e4f9524", user_id: "50a6d3df-a26b-469b-81d6-60891548a13e", created_at: "2026-10-08T05:10:29.925Z" },
    { id: crypto.randomUUID(), zone_id: "39943f68-8de9-44dd-85be-cda07217863c", user_id: "50a6d3df-a26b-469b-81d6-60891548a13e", created_at: "2026-10-08T05:10:29.925Z" },
    { id: crypto.randomUUID(), zone_id: "873c3291-d29e-444c-9e36-d9798894fbe7", user_id: "50a6d3df-a26b-469b-81d6-60891548a13e", created_at: "2026-10-08T05:10:29.925Z" },
  ];

  for (const s of seedStaff) {
    await db.collection("zone_staff").updateOne(
      { zone_id: s.zone_id, user_id: s.user_id },
      { $set: s },
      { upsert: true }
    );
  }

  // Participants
  const seedParticipants = [
    { id: "325e3a40-9141-44a8-827c-ff2de6a74a88", event_id: "12aae9a1-46f0-42f1-b5d0-304b2aec460c", full_name: "Yuvraj Gosai", email: "yuvrajgosai29@gmail.com", phone: "08511015826", department: "MCA", code: "A142D6FE", checked_in_at: "2026-10-08T03:52:45.473Z", created_at: "2026-10-08T03:52:01.001Z", checked_in_gate: "Gate 01", user_id: "70051d5f-70db-479c-8d6a-88440829fe6a", zone_id: null },
    { id: "6dc83ed0-7f33-4dde-b02d-79360793b9c9", event_id: "f2fb1850-867b-46ee-ac63-4c21ec17eed2", full_name: "Kavya Desai", email: "kavya.desai@student.atmiya.edu", phone: "9876543214", department: "BBA", code: "EE-C7EF51", checked_in_at: "2026-10-08T01:15:31.187Z", created_at: "2026-10-08T04:15:31.187Z", checked_in_gate: "Main Gate", user_id: null, zone_id: null },
    { id: "8797017f-08e2-4cab-8d23-5cc9d79b7214", event_id: "f2fb1850-867b-46ee-ac63-4c21ec17eed2", full_name: "Arjun Trivedi", email: "arjun.trivedi@student.atmiya.edu", phone: "9876543215", department: "BCA", code: "EE-60F652", checked_in_at: null, created_at: "2026-10-08T04:15:31.187Z", checked_in_gate: null, user_id: null, zone_id: null },
    { id: "56fa1363-a5d5-446e-9d62-478429263cd1", event_id: "f2fb1850-867b-46ee-ac63-4c21ec17eed2", full_name: "Ishita Raval", email: "ishita.raval@student.atmiya.edu", phone: "9876543216", department: "B.Com", code: "EE-6E37CE", checked_in_at: null, created_at: "2026-10-08T04:15:31.187Z", checked_in_gate: null, user_id: null, zone_id: null },
    { id: "7531e4e8-c73a-4a2f-91a9-36030f52a157", event_id: "6fda74f5-8039-4f87-b514-f08f0dae7d38", full_name: "Vivek Chavda", email: "vivek.chavda@student.atmiya.edu", phone: "9876543217", department: "Mechanical Engineering", code: "EE-809AFA", checked_in_at: "2026-10-08T03:45:31.187Z", created_at: "2026-10-08T04:15:31.187Z", checked_in_gate: "Gate B", user_id: null, zone_id: null },
    { id: "a4b0350f-2763-4a3a-9520-beaaa07dd68d", event_id: "6fda74f5-8039-4f87-b514-f08f0dae7d38", full_name: "Nisha Parmar", email: "nisha.parmar@student.atmiya.edu", phone: "9876543218", department: "Civil Engineering", code: "EE-8955E8", checked_in_at: null, created_at: "2026-10-08T04:15:31.187Z", checked_in_gate: null, user_id: null, zone_id: null },
    { id: "032a9395-a939-4878-9916-78e27c6d90fb", event_id: "dd411667-b555-44f4-b61b-fff7d999d659", full_name: "Manav Kothari", email: "manav.kothari@student.atmiya.edu", phone: "9876543220", department: "Computer Engineering", code: "EE-DC9272", checked_in_at: "2026-10-08T03:30:31.187Z", created_at: "2026-10-08T04:15:31.187Z", checked_in_gate: "Auditorium 1", user_id: null, zone_id: "39943f68-8de9-44dd-85be-cda07217863c" },
    { id: "4230f9d1-f802-4641-b3d4-41b0f00ce5ad", event_id: "dd411667-b555-44f4-b61b-fff7d999d659", full_name: "Riya Solanki", email: "riya.solanki@student.atmiya.edu", phone: "9876543221", department: "Information Technology", code: "EE-D1A3D4", checked_in_at: "2026-10-08T03:55:31.187Z", created_at: "2026-10-08T04:15:31.187Z", checked_in_gate: "Auditorium 2", user_id: null, zone_id: "873c3291-d29e-444c-9e36-d9798894fbe7" },
    { id: "b94d3674-57d2-4bd0-8f66-fb5d5da704de", event_id: "90c8e98d-5f8d-400b-83b2-7b4da2e7d155", full_name: "Aarav Shah", email: "aarav.shah@student.atmiya.edu", phone: "9876543210", department: "Computer Engineering", code: "EE-87D155", checked_in_at: "2026-10-08T02:15:31.187Z", created_at: "2026-10-08T04:15:31.187Z", checked_in_gate: "Gate A", user_id: null, zone_id: "867a7caf-ff5c-41d6-a01e-1528de9b4479" },
    { id: "f9cad541-8bde-4425-8224-6dbf35a269b4", event_id: "90c8e98d-5f8d-400b-83b2-7b4da2e7d155", full_name: "Rohan Mehta", email: "rohan.mehta@student.atmiya.edu", phone: "9876543212", department: "Computer Engineering", code: "EE-6B2618", checked_in_at: "2026-10-08T03:15:31.187Z", created_at: "2026-10-08T04:15:31.187Z", checked_in_gate: "Gate A", user_id: null, zone_id: "867a7caf-ff5c-41d6-a01e-1528de9b4479" },
  ];

  for (const p of seedParticipants) {
    await db.collection("participants").updateOne(
      { id: p.id },
      { $set: p },
      { upsert: true }
    );
  }

  // Scan Logs
  const seedScanLogs = [
    { id: "fc1262ec-9d22-4cb1-a57c-b39d46d870a5", event_id: "12aae9a1-46f0-42f1-b5d0-304b2aec460c", participant_id: "325e3a40-9141-44a8-827c-ff2de6a74a88", code: "A142D6FE", result: "success", gate: "Gate 01", participant_name: "yuvraj gosai", scanned_by: "70051d5f-70db-479c-8d6a-88440829fe6a", created_at: "2026-10-08T03:52:45.473Z" },
    { id: "81eeb5c2-f598-4083-bfa3-0c5c78a56285", event_id: "12aae9a1-46f0-42f1-b5d0-304b2aec460c", participant_id: "325e3a40-9141-44a8-827c-ff2de6a74a88", code: "A142D6FE", result: "duplicate", gate: "Gate 01", participant_name: "yuvraj gosai", scanned_by: "70051d5f-70db-479c-8d6a-88440829fe6a", created_at: "2026-10-08T03:52:50.820Z" },
    { id: "100bd994-0bf7-4261-8f05-7979e393a988", event_id: "f2fb1850-867b-46ee-ac63-4c21ec17eed2", participant_id: "6dc83ed0-7f33-4dde-b02d-79360793b9c9", code: "EE-C7EF51", result: "success", gate: "Main Gate", participant_name: "Kavya Desai", scanned_by: null, created_at: "2026-10-08T04:15:31.187Z" },
  ];

  for (const l of seedScanLogs) {
    await db.collection("scan_logs").updateOne(
      { id: l.id },
      { $set: l },
      { upsert: true }
    );
  }

  // Support Tickets
  await db.collection("support_tickets").updateOne(
    { id: "9179830d-d14e-4949-8d3c-9b05cd854425" },
    {
      $set: {
        id: "9179830d-d14e-4949-8d3c-9b05cd854425",
        user_id: "70051d5f-70db-479c-8d6a-88440829fe6a",
        email: "aarav.shah@student.atmiya.edu",
        full_name: "Aarav Shah",
        event_id: null,
        subject: "QR code not loading",
        message: "My pass QR code is not showing on my phone. Please help before the event day.",
        status: "open",
        reply: null,
        replied_by: null,
        replied_at: null,
        created_at: "2026-10-08T04:15:31.187Z",
      },
    },
    { upsert: true }
  );

  console.log("[Seed] MongoDB database seeding completed successfully!");
}

async function ensureCoreAccounts(db: any): Promise<void> {
  const defaultPasswordHash = hashPassword("EventEase@123");
  const accounts = [
    { email: "admin@gmail.com", role: "admin", name: "Admin" },
    { email: "organizer@gmail.com", role: "organizer", name: "Organizer" },
    { email: "student@gmail.com", role: "student", name: "Student" },
  ];

  for (const acc of accounts) {
    let u = await db.collection("users").findOne({ email: acc.email.toLowerCase() });
    if (!u) {
      const id = crypto.randomUUID();
      await db.collection("users").insertOne({
        id,
        email: acc.email.toLowerCase(),
        password_hash: defaultPasswordHash,
        full_name: acc.name,
        created_at: new Date().toISOString(),
      });
      await db.collection("profiles").insertOne({
        id,
        email: acc.email.toLowerCase(),
        full_name: acc.name,
        wants_organizer: false,
        created_at: new Date().toISOString(),
      });
      await db.collection("user_roles").insertOne({
        id: crypto.randomUUID(),
        user_id: id,
        role: acc.role,
        created_at: new Date().toISOString(),
      });
      if (acc.role === "admin") {
        await db.collection("user_roles").insertOne({
          id: crypto.randomUUID(),
          user_id: id,
          role: "organizer",
          created_at: new Date().toISOString(),
        });
        await db.collection("user_roles").insertOne({
          id: crypto.randomUUID(),
          user_id: id,
          role: "student",
          created_at: new Date().toISOString(),
        });
      } else if (acc.role === "organizer") {
        await db.collection("user_roles").insertOne({
          id: crypto.randomUUID(),
          user_id: id,
          role: "student",
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith("seed.ts") ||
  process.argv[1].endsWith("seed.js")
);

if (isDirectRun) {
  seedDatabase(true).then(() => {
    console.log("Seed script finished successfully.");
    process.exit(0);
  }).catch((err) => {
    console.error("Seed script error:", err);
    process.exit(1);
  });
}

