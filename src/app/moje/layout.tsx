import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";

/**
 * Portal agenta stoi POZA grupą (dashboard) i celowo nie ma jej menu bocznego.
 * Menu prowadzi do szkół, klientów i ustawień całej agencji — pokazywanie go
 * komuś, kto i tak zostanie z każdej z tych stron odesłany, byłoby obiecywaniem
 * dostępu, którego nie ma.
 */
export default function LayoutPortaluAgenta({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background">
      <header className="szklo-belka sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b px-4 md:px-6">
        <span className="text-sm font-medium text-muted-foreground">
          Ochrona z Klasą — panel agenta
        </span>
        <form action={logout}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
            Wyloguj
          </button>
        </form>
      </header>
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
