import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";

const SALT_ROUNDS = 10;
const TOKEN_TTL = "7d";

export interface AuthResult {
  token: string;
  user: { id: string; name: string; email: string };
}

function buildAuthResult(user: { id: string; name: string; email: string }): AuthResult {
  const token = jwt.sign({ id: user.id, name: user.name }, env.jwtSecret, {
    expiresIn: TOKEN_TTL,
  });
  return { token, user: { id: user.id, name: user.name, email: user.email } };
}

export async function registerUser(email: string, password: string, name: string): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
  });

  return buildAuthResult(user);
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, "Invalid credentials");
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    throw new AppError(401, "Invalid credentials");
  }

  return buildAuthResult(user);
}
