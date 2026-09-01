import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { authenticate } from "../middlewares/auth.js";

function mockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("authenticate middleware", () => {
  it("rejects requests without an authorization header", () => {
    const req = { headers: {} } as Request;
    const res = mockResponse();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects invalid/expired tokens", () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } } as Request;
    const res = mockResponse();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches { id, name } to req.user and calls next for a valid token", () => {
    const token = jwt.sign({ id: "user-1", name: "Ada" }, env.jwtSecret);
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockResponse();
    const next = vi.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: "user-1", name: "Ada" });
  });
});
