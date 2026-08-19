import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

/**
 * Ekran logowania — jedyne miejsce panelu, które ogląda się przez chwilę,
 * a nie przez cały dzień. Stąd granatowe tło i znak firmowy jak na stronie:
 * pracownik ma od razu wiedzieć, do czego się loguje. Sam formularz zostaje
 * na białej karcie, bo pola tekstowe na ciemnym tle czyta się gorzej.
 */
export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--granat)] p-4">
      {/* Techniczna kratka — ten sam sygnał „produkt, nie broszura" co na stronie. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 75%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo-ozk-white.svg"
            alt="Ochrona z Klasą"
            width={400}
            height={119}
            unoptimized
            priority
            className="h-8 w-auto"
          />
          <p className="text-sm text-white/70">Panel zarządzania polisami</p>
        </div>
        <Card className="shadow-[0_24px_80px_-24px_rgba(0,0,0,0.6)]">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-white/50">
          Dostęp tylko dla pracowników agencji.
        </p>
      </div>
    </div>
  );
}
