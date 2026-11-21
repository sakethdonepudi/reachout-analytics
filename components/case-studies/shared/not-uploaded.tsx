import Link from "next/link";
import { Upload } from "lucide-react";

export default function NotUploaded({ label, owner = false }: { label: string; owner?: boolean }) {
  return (
    <section className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 py-16 text-center sm:py-24" aria-label={`${label} not uploaded`}>
      <span className="grid size-12 place-items-center rounded-full border border-[#E6E6E6] bg-white text-[#6B6B6B]">
        <Upload className="size-5" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-[22px] font-semibold tracking-[-0.02em] text-[#0B0B0C]">{label} not uploaded yet</h2>
      <p className="mt-2 max-w-[42ch] text-[13px] leading-relaxed text-[#6B6B6B]">
        No dataset has been published for this view. It will appear here once the owner uploads it.
      </p>
      {owner && (
        <Link href="/dashboard#poll-upload" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0B0B0C] px-4 text-[12px] font-semibold text-[#0B0B0C] transition-colors hover:bg-[#0B0B0C] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C] focus-visible:ring-offset-2">
          <Upload className="size-3.5" /> Upload data
        </Link>
      )}
    </section>
  );
}
