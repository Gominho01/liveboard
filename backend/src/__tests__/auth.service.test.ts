import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const { prisma } = await import("../config/prisma.js");
const { loginUser, registerUser } = await import("../services/auth.service.js");
const { AppError } = await import("../utils/app-error.js");

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a new user with a bcrypt-hashed password and returns a token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.user.create).mockImplementation((async ({ data }: any) => ({
      id: "user-1",
      email: data.email,
      name: data.name,
      password: data.password,
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any);

    const result = await registerUser("ada@example.com", "password123", "Ada");

    expect(result.user).toEqual({ id: "user-1", email: "ada@example.com", name: "Ada" });
    expect(typeof result.token).toBe("string");

    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0];
    expect(createCall.data.password).not.toBe("password123");
    expect(await bcrypt.compare("password123", createCall.data.password as string)).toBe(true);
  });

  it("rejects registration when the email is already taken", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as any);

    await expect(registerUser("ada@example.com", "password123", "Ada")).rejects.toBeInstanceOf(AppError);
  });

  it("logs in successfully with correct credentials", async () => {
    const hashed = await bcrypt.hash("password123", 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      password: hashed,
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await loginUser("ada@example.com", "password123");

    expect(result.user).toEqual({ id: "user-1", email: "ada@example.com", name: "Ada" });
  });

  it("rejects login with the wrong password", async () => {
    const hashed = await bcrypt.hash("password123", 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      password: hashed,
      createdAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await expect(loginUser("ada@example.com", "wrong-password")).rejects.toBeInstanceOf(AppError);
  });

  it("rejects login for an unknown email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(loginUser("nobody@example.com", "password123")).rejects.toBeInstanceOf(AppError);
  });
});
