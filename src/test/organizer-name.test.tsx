import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateEventDialog } from "@/components/CreateEventDialog";

const mocks = vi.hoisted(() => ({ profile: vi.fn(), insert: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: mocks.eq }), insert: mocks.insert }) },
}));
vi.mock("@/components/ImageUpload", () => ({ ImageUpload: () => null }));
vi.mock("@/lib/event-dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/event-dates")>();
  return {
    ...actual,
    takenDatesQuery: () => ({ queryKey: ["taken"], queryFn: async () => [] }),
    findDateClash: () => null,
    findVenueClash: () => null,
    nowLocalInput: () => "2026-01-01T00:00",
  };
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function openForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CreateEventDialog userId="creator-id" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "New event" }));
}

describe("Event creator identity", () => {
  it("fills the creator's profile name and makes it read-only", async () => {
    mocks.eq.mockReturnValue({ maybeSingle: mocks.profile });
    mocks.profile.mockResolvedValue({ data: { full_name: "Signed-in Organizer" }, error: null });
    mocks.insert.mockResolvedValue({ error: null });
    openForm();
    fireEvent.change(screen.getByPlaceholderText("AI & ML Sprint"), { target: { value: "Test event" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const date = document.querySelector('input[type="datetime-local"]');
    if (!date) throw new Error("Missing date field");
    fireEvent.change(date, { target: { value: "2099-01-01T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const name = await screen.findByDisplayValue("Signed-in Organizer");
    expect(name).toHaveAttribute("readonly");
    expect(mocks.eq).toHaveBeenCalledWith("id", "creator-id");
    await waitFor(() => expect(screen.getByRole("button", { name: /Publish event/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Publish event/ }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: "creator-id", host_name: "Signed-in Organizer" })));
  });

  it("blocks creation when the profile has no name", async () => {
    mocks.eq.mockReturnValue({ maybeSingle: mocks.profile });
    mocks.profile.mockResolvedValue({ data: { full_name: null }, error: null });
    openForm();
    fireEvent.change(screen.getByPlaceholderText("AI & ML Sprint"), { target: { value: "Test event" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    const date = document.querySelector('input[type="datetime-local"]');
    if (!date) throw new Error("Missing date field");
    fireEvent.change(date, { target: { value: "2099-01-01T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    await screen.findByText("Add your full name in My profile before creating an event.");
    expect(screen.getByRole("button", { name: /Publish event/ })).toBeDisabled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});