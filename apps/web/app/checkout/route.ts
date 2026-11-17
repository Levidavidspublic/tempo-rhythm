import { Checkout } from "@polar-sh/nextjs";
import type { NextRequest } from "next/server";
import { paypalSandboxCheckout } from "@/lib/checkout";

/** Vercel Preview uses the PayPal Sandbox switch. Other environments use the Polar sandbox. */
export function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV === "preview") {
    return paypalSandboxCheckout();
  }

  return Checkout({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    successUrl: process.env.POLAR_SUCCESS_URL,
    server: "sandbox",
    theme: "dark",
  })(request);
}
