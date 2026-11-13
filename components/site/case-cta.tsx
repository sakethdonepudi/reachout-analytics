"use client";

import { useNavigate } from "@/lib/use-navigate";
import ShimmerButton from "@/components/ui/shimmer-button";

export default function CaseCta() {
  const navigate = useNavigate();
  return (
    <ShimmerButton
      text="Plan your campaign with us"
      duration={1.8}
      onClick={() => navigate.push("/#contact", { label: "Opening Home" })}
      className="border-teal/40 px-7 py-3.5  backdrop-blur-xl"
    />
  );
}
