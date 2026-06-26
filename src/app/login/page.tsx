import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Ochrona z Klasą</h1>
          <p className="text-sm text-muted-foreground">
            Zaloguj się do panelu zarządzania polisami
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Dostęp tylko dla pracowników agencji.
        </p>
      </div>
    </div>
  );
}
