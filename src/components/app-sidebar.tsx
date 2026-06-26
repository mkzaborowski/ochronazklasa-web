"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  FilePlus2,
  Settings,
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
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Ochrona z Klasą</span>
                <span className="truncate text-xs text-muted-foreground">
                  Panel polis
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
