import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await getCurrentUser();

  // Rola AGENT nie wchodzi do panelu biura. Blokada stoi TUTAJ, w layoucie
  // serwerowym, a nie w menu ani w middleware: ukrycie linków chowa drogę,
  // ale nie zamyka drzwi, a adres da się wpisać z ręki.
  //
  // Odsyłamy do /moje, które NIGDY nie odsyła z powrotem - konto bez karty
  // agenta dostaje tam komunikat, a nie kolejne przekierowanie. Inaczej
  // powstałaby pętla bez jednego zdania wyjaśnienia.
  if (sessionUser?.role === "AGENT") redirect("/moje");
  const user = sessionUser
    ? { name: sessionUser.name, email: sessionUser.email, image: sessionUser.image }
    : null;

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      {/* min-w-0 NIE jest kosmetyką. SidebarInset jest elementem flex, a taki
          ma domyślnie min-width:auto - czyli nie skurczy się poniżej szerokości
          swojej treści. Szeroka tabela rozpychała więc całą kolumnę z treścią
          ponad szerokość okna: poziomy pasek pojawiał się na CAŁEJ stronie
          (razem z górną belką), a kontener tabeli, który ma własne
          overflow-x:auto, mieścił się w tak rozdmuchanym rodzicu i nigdy nie
          uznawał, że ma co przewijać. Dopiero min-w-0 pozwala kolumnie zmieścić
          się w oknie i przerzuca przewijanie tam, gdzie ma być: do tabeli. */}
      <SidebarInset className="min-w-0">
        {/* Belka zostaje na wierzchu przy przewijaniu — przy tabeli na kilkaset
            wierszy przycisk zwijania menu inaczej ucieka poza ekran. */}
        <header className="szklo-belka sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">
            Panel zarządzania polisami
          </span>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
