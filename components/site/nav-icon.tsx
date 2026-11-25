"use client";

import {
  BriefcaseBusiness,
  Database,
  FileSearch,
  FolderOpen,
  House,
  Info,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Megaphone,
  MonitorSmartphone,
  Shield,
  Users,
} from "lucide-react";
import { PARTIES, type PartyId } from "@/lib/parties";
import { cn } from "@/lib/utils";
import type { NavIconName } from "@/lib/nav";

const ICONS = {
  home: House,
  services: BriefcaseBusiness,
  research: FileSearch,
  casesLocked: Lock,
  casesOpen: FolderOpen,
  about: Info,
  contact: Mail,
  login: LogIn,
  dashboard: LayoutDashboard,
  users: Users,
  sessions: MonitorSmartphone,
  security: Shield,
  password: KeyRound,
  logout: LogOut,
  database: Database,
  ads: Megaphone,
} satisfies Record<NavIconName, typeof House>;

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={cn("size-4 shrink-0", className)} strokeWidth={1.75} aria-hidden />;
}

/** Small monochrome party symbol used inside case menus. */
export function NavPartyMark({ party }: { party: PartyId }) {
  const info = PARTIES[party];
  return (
    <span data-party-mark="true" className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--party-badge-surface)] ring-1 ring-black/10" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={info.logo}
        alt=""
        width={info.width}
        height={info.height}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-[18px] w-[18px] object-contain"
      />
    </span>
  );
}
