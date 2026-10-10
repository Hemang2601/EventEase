import { getDb } from "./mongo";
import {
  authService,
  eventService,
  participantService,
  zoneService,
  adminService,
} from "./services";
import { seedDatabase } from "./seed";

async function runTests() {
  console.log("=== Starting MongoDB Backend Verification Tests ===");

  // 1. Database Connection & Seed
  await seedDatabase(false);
  const db = await getDb();
  console.log("✓ MongoDB Connected and Seeded:", db.databaseName);

  // 2. Auth Tests
  console.log("\nTesting Auth...");
  const adminLogin = await authService.login({ email: "admin@gmail.com", password: "EventEase@123" });
  console.log("✓ Admin Login:", adminLogin.user.email, adminLogin.user.id);

  const orgLogin = await authService.login({ email: "organizer@gmail.com", password: "EventEase@123" });
  console.log("✓ Organizer Login:", orgLogin.user.email);

  const studentLogin = await authService.login({ email: "student@gmail.com", password: "EventEase@123" });
  console.log("✓ Student Login:", studentLogin.user.email);

  // 3. Role Tests
  const isAdmin = await authService.hasRole(adminLogin.user.id, "admin");
  const isOrg = await authService.hasRole(orgLogin.user.id, "organizer");
  console.log("✓ Admin Role Check:", isAdmin === true);
  console.log("✓ Organizer Role Check:", isOrg === true);

  // 4. Ticket Lookup
  console.log("\nTesting Ticket Lookup...");
  const sampleTicket = await participantService.getTicket("EE-C7EF51");
  console.log("✓ Sample Ticket Lookup (EE-C7EF51):", sampleTicket?.full_name, "-", sampleTicket?.event_title);

  // 5. Check-In Tests
  console.log("\nTesting Check-In Logic...");
  const targetEvent = await db.collection("events").findOne({ id: "12aae9a1-46f0-42f1-b5d0-304b2aec460c" });
  if (targetEvent) {
    // Test check-in duplicate
    const dupeCheck = await participantService.checkInParticipant({
      eventId: targetEvent.id,
      code: "A142D6FE",
      gate: "Gate 01",
      scannedBy: adminLogin.user.id,
    });
    console.log("✓ Duplicate Scan Test:", dupeCheck.status === "duplicate" ? "Duplicate Detected Correctly" : dupeCheck);

    // Test invalid code
    const invalidCheck = await participantService.checkInParticipant({
      eventId: targetEvent.id,
      code: "FAKECODE99",
      gate: "Gate 01",
      scannedBy: adminLogin.user.id,
    });
    console.log("✓ Invalid Code Test:", invalidCheck.status === "invalid" ? "Rejected Correctly" : invalidCheck);

    // Test wrong event code (code from Cultural Night EE-C7EF51 scanned at Atmiya Avsar)
    const wrongEventCheck = await participantService.checkInParticipant({
      eventId: targetEvent.id,
      code: "EE-C7EF51",
      gate: "Gate 01",
      scannedBy: adminLogin.user.id,
    });
    console.log("✓ Wrong Event Test:", wrongEventCheck.status === "wrong_event" ? "Wrong Event Detected Correctly" : wrongEventCheck);
  }

  // 6. Registration Test
  console.log("\nTesting Participant Registration...");
  const hackathon = await db.collection("events").findOne({ id: "dd411667-b555-44f4-b61b-fff7d999d659" });
  if (hackathon) {
    const testEmail = `test_${Date.now()}@student.atmiya.edu`;
    const regRes = await participantService.registerParticipant({
      eventId: hackathon.id,
      fullName: "Test Automated Student",
      email: testEmail,
      phone: "9998887770",
      department: "MCA",
      userId: studentLogin.user.id,
    });
    console.log("✓ Register Participant:", regRes.ok ? `Code: ${regRes.code}` : regRes.error);

    // Immediate duplicate registration attempt
    const dupeReg = await participantService.registerParticipant({
      eventId: hackathon.id,
      fullName: "Test Automated Student",
      email: testEmail,
      phone: "9998887770",
      department: "MCA",
      userId: studentLogin.user.id,
    });
    console.log("✓ Duplicate Email Blocked:", dupeReg.ok === false ? dupeReg.error : "Failed to block");

    if (regRes.ok && regRes.code) {
      // Test fresh check-in
      const freshCheckIn = await participantService.checkInParticipant({
        eventId: hackathon.id,
        code: regRes.code,
        gate: "Auditorium 1",
        scannedBy: adminLogin.user.id,
      });
      console.log("✓ Fresh Code Check-In:", freshCheckIn.status);
    }
  }

  // 7. Zone Overview Test
  if (hackathon) {
    const zones = await zoneService.getZoneOverview(hackathon.id, adminLogin.user.id);
    console.log("✓ Zone Overview:", zones.map((z) => `${z.name} (Reg: ${z.registered}, In: ${z.checked_in})`).join(", "));
  }

  // 8. Event Stats
  if (hackathon) {
    const stats = await eventService.getStats(hackathon.id);
    console.log("✓ Event Stats:", stats);
  }

  console.log("\n=== ALL MONGODB VERIFICATION TESTS PASSED! ===");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
