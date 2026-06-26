"use client";

import { useActionState } from "react";
import { credentialsLogin, googleLogin } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(credentialsLogin, undefined);

  return (
    <div className="grid gap-4">
      <form action={googleLogin}>
        <Button type="submit" variant="outline" className="w-full">
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M12 11v2.8h3.9c-.2 1-1.5 3-3.9 3-2.4 0-4.3-2-4.3-4.4S9.6 8 12 8c1.3 0 2.2.6 2.7 1l1.9-1.8C15.5 6.1 13.9 5.4 12 5.4 8.3 5.4 5.3 8.4 5.3 12s3 6.6 6.7 6.6c3.9 0 6.4-2.7 6.4-6.5 0-.4 0-.8-.1-1.1H12Z"
            />
          </svg>
          Zaloguj przez Google
        </Button>
      </form>

      <div className="relative text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-card px-2">lub</span>
        <span className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
      </div>

      <form action={formAction} className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Hasło</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Logowanie…" : "Zaloguj się"}
        </Button>
      </form>
    </div>
  );
}
