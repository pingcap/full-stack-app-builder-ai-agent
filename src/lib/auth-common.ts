import type { InferUser } from "better-auth";
import type { auth } from "@/lib/auth";
import { formatRole, parseRole, type Role } from "@/lib/role";

export interface SessionUser
  extends Omit<InferUser<typeof auth>, "id" | "role"> {
  id: number;
  role: Role;
}

export function toSessionUser(user: InferUser<typeof auth>): SessionUser {
  return {
    ...user,
    id: parseInt(user.id, 10),
    role: parseRole(user.role),
  };
}

export function fromSessionUser(user: SessionUser): InferUser<typeof auth> {
  return {
    ...user,
    id: user.id.toString(10),
    role: formatRole(user.role),
  };
}
