"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  FilePlus2,
  Settings,
  ShoppingCart,
  ShieldCheck,
  School,
  Database,
  UserCog,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";

type UserInfo = { name?: string | null; email?: string | null; image?: string | null };

const nav = [
  {
    label: "Przegląd",
    items: [{ title: "Pulpit", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Polisy",
    items: [
      { title: "Wystaw polisę (InterRisk)", href: "/schools/new", icon: FilePlus2 },
      { title: "Szkoły / Ubezpieczający", href: "/schools", icon: School },
      { title: "Wszystkie polisy", href: "/policies", icon: FileText },
    ],
  },
  {
    label: "Sprzedaż online",
    items: [{ title: "Polisy indywidualne", href: "/online", icon: ShoppingCart }],
  },
  {
    label: "Dane",
    items: [
      { title: "Baza szkół", href: "/directory", icon: Database },
      { title: "Agenci", href: "/agents", icon: UserCog },
      { title: "Dokumenty (Drive)", href: "/documents", icon: FolderOpen },
    ],
  },
  {
    label: "System",
    items: [{ title: "Ustawienia", href: "/settings", icon: Settings }],
  },
];

export function AppSidebar({ user }: { user: UserInfo | null }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Rozwinięte menu pokazuje znak firmowy ze strony; zwinięte — sam
                symbol. Ściśnięty logotyp w kolumnie szerokiej na ikonę byłby
                nieczytelny, a dwa znaki naraz to jeden za dużo. */}
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:flex hidden">
                <ShieldCheck className="size-4" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 group-data-[collapsible=icon]:hidden">
                {/* self-start: bez tego obrazek rozciąga się na szerokość kolumny
                    (align-items: stretch) i znak ląduje na środku zamiast przy
                    krawędzi, w jednej linii z resztą menu. */}
                <Image
                  src="/logo-ozk-white.svg"
                  alt="Ochrona z Klasą"
                  width={400}
                  height={119}
                  unoptimized
                  priority
                  className="h-5 w-auto self-start"
                />
                <span className="text-[11px] tracking-[0.16em] text-sidebar-foreground/60 uppercase">
                  Panel
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {nav.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.title}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
