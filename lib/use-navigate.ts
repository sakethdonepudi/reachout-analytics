"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { startRouteTransition, type TransitionMeta } from "@/lib/route-transition";
import { routeLabel } from "@/lib/route-labels";

export const OPENING_EVENT = "reachout:opening";

export type OpeningDetail = { label: string | null; immediate?: boolean };

/** Tell the navigation loader that an in-app move is starting. */
export function announceOpening(label: string | null, immediate = false) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpeningDetail>(OPENING_EVENT, { detail: { label, immediate } }));
}

type PushOptions = { label?: string; cover?: TransitionMeta };

/**
 * Router helpers that keep the single navigation loader in sync with
 * programmatic moves. Map entries can ask for the route-transition cover
 * instead, which doubles as the loader for that route.
 */
export function useNavigate() {
  const router = useRouter();

  const push = useCallback((href: string, options?: PushOptions) => {
    if (options?.cover) {
      startRouteTransition(href, options.cover);
      return;
    }
    announceOpening(options?.label ?? routeLabel(href));
    router.push(href);
  }, [router]);

  const replace = useCallback((href: string, label?: string) => {
    announceOpening(label ?? routeLabel(href));
    router.replace(href);
  }, [router]);

  const prefetch = useCallback((href: string) => {
    router.prefetch(href);
  }, [router]);

  return useMemo(() => ({ push, replace, prefetch }), [push, replace, prefetch]);
}
