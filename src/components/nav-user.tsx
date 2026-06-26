"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";

type UserInfo = { name?: string | null; email?: string | null; image?: string | null };

function initials(user: UserInfo): string {
  const base = user.name ?? user.email ?? "?";
  return base
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function NavUser({ user }: { user: UserInfo | null }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-2 rounded-md p-1">
          <Avatar className="size-8 rounded-md">
            {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="rounded-md text-xs">
              {user ? initials(user) : "—"}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium">
              {user?.name ?? user?.email ?? "Tryb podglądu"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user?.email ?? "brak zalogowanego użytkownika"}
            </span>
          </div>
          {user ? (
            <form action={logout} className="group-data-[collapsible=icon]:hidden">
              <button
                type="submit"
                title="Wyloguj"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          ) : null}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
