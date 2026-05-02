import { describe, it, expect, vi, beforeEach } from "vitest";

// Shared mutable mock state so tests can inspect calls
const runMock = vi.fn();
const prepareMock = vi.fn(() => ({ run: runMock, all: vi.fn(() => []), get: vi.fn(() => null) }));

vi.mock("../config/db.js", () => ({
  getDb: () => ({ prepare: prepareMock }),
}));

// landingPageBuilder and nodemailer are not needed for scheduleFollowUps
vi.mock("../services/landingPageBuilder.js", () => ({
  generateWebsiteHtml: vi.fn(),
  makeSlug: vi.fn(),
  deployToNetlify: vi.fn(),
}));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));
vi.mock("axios", () => ({ default: { post: vi.fn() } }));

describe("scheduleFollowUps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("schedula esattamente 1 follow-up", async () => {
    const { scheduleFollowUps } = await import("../services/followUpEngine.js");
    scheduleFollowUps(42, 3);
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it("MAX_FOLLOW_UPS è 1", async () => {
    const runs = [];
    runMock.mockImplementation((...args) => runs.push(args));
    const { scheduleFollowUps } = await import("../services/followUpEngine.js");
    scheduleFollowUps(1, 1);
    expect(runs).toHaveLength(1);
    // step deve essere 1 (3rd positional arg to run: businessId, userId, step, scheduledAt)
    expect(runs[0][2]).toBe(1);
  });
});
