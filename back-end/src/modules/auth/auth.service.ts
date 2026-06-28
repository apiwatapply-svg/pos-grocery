import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../../shared/errors/app-error.js";
import type { UserRecord } from "../users/user.repository.js";

export type AuthTokenPayload = {
  sub: string;
  storeId: string;
  username: string;
  role: string;
};

const passwordSaltRounds = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, passwordSaltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireActiveUser(user: Pick<UserRecord, "status">): void {
  if (user.status !== "active") {
    throw new AppError(403, "USER_INACTIVE", "User is inactive.");
  }
}

export function createAuthToken(user: UserRecord, jwtSecret: string): string {
  return jwt.sign(
    {
      storeId: user.storeId,
      username: user.username,
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn: "8h",
      subject: user.id,
    },
  );
}

export function verifyAuthToken(token: string, jwtSecret: string): AuthTokenPayload {
  const payload = jwt.verify(token, jwtSecret);

  if (typeof payload === "string" || !payload.sub) {
    throw new AppError(401, "INVALID_TOKEN", "Invalid authentication token.");
  }

  return {
    sub: payload.sub,
    storeId: String(payload.storeId),
    username: String(payload.username),
    role: String(payload.role),
  };
}

export function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    storeId: user.storeId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
  };
}
