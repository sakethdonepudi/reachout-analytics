"use client";

import { useRouter } from "next/navigation";
import ShimmerButton from "@/components/ui/shimmer-button";

export default function CaseCta() {
  const router = useRouter();
  return (
    <ShimmerButton
      text="Plan your campaign with us"
      duration={1.8}
      onClick={() => router.push("/#contact")}
      className="border-teal/40 px-7 py-3.5  backdrop-blur-xl"
    />
  );
}
