import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import type { RoleEnum } from "../../api/generated/models";
import { useAuthStore } from "../../features/auth/authStore";

export function RequireRole({
  allowed,
  children,
}: PropsWithChildren<{ allowed: RoleEnum[] }>) {
  const role = useAuthStore((state) => state.role);
  return role && allowed.includes(role) ? (
    children
  ) : (
    <Navigate replace to="/" />
  );
}
