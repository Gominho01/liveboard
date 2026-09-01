import { Router } from "express";
import { login, register } from "../controllers/auth.controller.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/auth/register", register);
router.post("/auth/login", login);
