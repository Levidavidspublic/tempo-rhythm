// Gallery stand-in for "@convex-dev/auth/react".
export const useAuthActions = () => ({ signIn: async () => ({}), signOut: async () => {} });
export const useAuthToken = () => null;
export function ConvexAuthProvider({ children }: { children: unknown }) {
  return children;
}
