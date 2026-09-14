import { describe, expect, it, vi, beforeEach } from "vitest";

// Prisma is fully mocked — never touches the real Supabase database. The
// mocked client below deliberately exposes only campaign.findUnique,
// lead.findFirst/create, and leadStatusHistory.create — no whatsApp* table
// exists in this mock, mirroring the structural guarantee established in
// acquisition-service.test.ts: if this service ever tried to touch a
// WhatsApp table, the call would throw "is not a function".
const {
  campaignFindUnique,
  leadFindFirst,
  leadCreate,
  leadStatusHistoryCreate,
  logActivityMock,
} = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  leadFindFirst: vi.fn(),
  leadCreate: vi.fn(),
  leadStatusHistoryCreate: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    lead: { findFirst: leadFindFirst, create: leadCreate },
    leadStatusHistory: { create: leadStatusHistoryCreate },
  },
}));

vi.mock("@/lib/actor", () => ({
  logActivity: logActivityMock,
}));

import { findOrCreateLead } from "@/server/services/lead-service";
import { CampaignNotFoundError } from "@/server/services/campaign-service";

describe("findOrCreateLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leadCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "lead-1",
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    leadStatusHistoryCreate.mockResolvedValue({ id: "history-1" });
  });

  it("creates a new Lead with initial status 'new' when none exists", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    leadFindFirst.mockResolvedValue(null);

    const lead = await findOrCreateLead({ campaignId: "c1", phone: "+60123456789" });

    expect(leadCreate).toHaveBeenCalledWith({
      data: {
        campaignId: "c1",
        phone: "+60123456789",
        name: null,
        customerInfo: {},
        acquisitionEventId: null,
      },
    });
    expect(lead.status).toBe("new");
  });

  it("creates the initial LeadStatusHistory entry (null -> new, actorType system) for a new Lead", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    leadFindFirst.mockResolvedValue(null);

    const lead = await findOrCreateLead({ campaignId: "c1", phone: "+60123456789" });

    expect(leadStatusHistoryCreate).toHaveBeenCalledWith({
      data: {
        leadId: lead.id,
        fromStatus: null,
        toStatus: "new",
        actorType: "system",
        actorId: null,
      },
    });
  });

  it("reuses the existing Lead for the same campaignId + phone rather than creating a duplicate", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    const existingLead = { id: "lead-existing", campaignId: "c1", phone: "+60123456789", status: "new" };
    leadFindFirst.mockResolvedValue(existingLead);

    const lead = await findOrCreateLead({ campaignId: "c1", phone: "+60123456789" });

    expect(lead).toBe(existingLead);
    expect(leadCreate).not.toHaveBeenCalled();
    expect(leadStatusHistoryCreate).not.toHaveBeenCalled();
  });

  it("creates a separate Lead for the same phone under a different campaign", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c2" });
    leadFindFirst.mockResolvedValue(null);

    await findOrCreateLead({ campaignId: "c2", phone: "+60123456789" });

    expect(leadFindFirst).toHaveBeenCalledWith({
      where: { campaignId: "c2", phone: "+60123456789" },
    });
    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ campaignId: "c2" }) }),
    );
  });

  it("preserves the supplied acquisitionEventId on the created Lead", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    leadFindFirst.mockResolvedValue(null);

    await findOrCreateLead({ campaignId: "c1", phone: "+60123456789", acquisitionEventId: "event-1" });

    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ acquisitionEventId: "event-1" }) }),
    );
  });

  it("preserves supplied customer information exactly, without merging or discarding it", async () => {
    campaignFindUnique.mockResolvedValue({ id: "c1" });
    leadFindFirst.mockResolvedValue(null);

    await findOrCreateLead({
      campaignId: "c1",
      phone: "+60123456789",
      name: "Jane Tan",
      customerInfo: { unit: "12-3", preferredLanguage: "en" },
    });

    expect(leadCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Jane Tan",
          customerInfo: { unit: "12-3", preferredLanguage: "en" },
        }),
      }),
    );
  });

  it("rejects a nonexistent campaignId and creates nothing", async () => {
    campaignFindUnique.mockResolvedValue(null);

    await expect(
      findOrCreateLead({ campaignId: "missing", phone: "+60123456789" }),
    ).rejects.toBeInstanceOf(CampaignNotFoundError);
    expect(leadCreate).not.toHaveBeenCalled();
    expect(leadStatusHistoryCreate).not.toHaveBeenCalled();
  });
});
