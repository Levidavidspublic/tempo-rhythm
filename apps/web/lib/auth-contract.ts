declare const verifiedFirebaseIdentity: unique symbol;

/**
 * Identity returned only after server-side Firebase ID-token verification.
 * This is not an approval, administrator role, entitlement, or session cookie.
 * Timestamp values are Unix seconds, matching the signed Firebase claims.
 */
export type VerifiedFirebaseIdentity = Readonly<{
  uid: string;
  projectId: string;
  email: string | null;
  emailVerified: boolean;
  issuedAt: number;
  expiresAt: number;
  authTime: number;
  [verifiedFirebaseIdentity]: true;
}>;
