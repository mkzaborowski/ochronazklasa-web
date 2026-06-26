"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

/** Email + password sign-in (used with useActionState). */
export async function credentialsLogin(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Nieprawidłowy email lub hasło.";
    }
    throw error; // re-throw the redirect (NEXT_REDIRECT) and everything else
  }
}

/** Google Workspace SSO sign-in. */
export async function googleLogin() {
  await signIn("google", { redirectTo: "/" });
}

/** Sign out and return to the login page. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
