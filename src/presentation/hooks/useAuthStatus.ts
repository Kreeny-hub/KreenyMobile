import { authClient } from "../../lib/auth-client";

export function useAuthStatus() {
  const session = authClient.useSession();
  const isLoading = session.isPending;
  const isAuthenticated = !!session.data;
  return { isLoading, isAuthenticated, session };
}
