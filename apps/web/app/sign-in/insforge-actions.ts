"use server";

import { cookies } from "next/headers";
import { DATA_BACKEND } from "../../lib/backend-flag";
import { makeInsforgeOtpActions } from "../../lib/insforge/otp";

const otpActions = makeInsforgeOtpActions(
  {
    backend: DATA_BACKEND,
    url: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  },
  cookies
);

export async function requestInsforgeOtp(email: unknown) {
  return otpActions.requestCode(email);
}

export async function verifyInsforgeOtp(email: unknown, code: unknown) {
  return otpActions.verifyCode(email, code);
}
