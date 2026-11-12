import { cn } from "@/lib/utils";

/** Static content wrapper. The report design uses no entrance animation. */
export default function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return <div className={cn(className)}>{children}</div>;
}
