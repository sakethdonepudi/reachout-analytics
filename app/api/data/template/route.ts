import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { buildWorkbook } from "@/lib/poll-data";

export const runtime = "nodejs";

/** Download an empty workbook template. Telangana follows its own contract. */
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("caseStudyId")?.trim() || "poll";
  let buffer: Buffer;
  if (slug === "telangana") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Entry ID", "Entry Date", "AC No", "District", "2023 Vote", "2028 Vote"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  } else {
    buffer = buildWorkbook([], []);
  }
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}-poll-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
