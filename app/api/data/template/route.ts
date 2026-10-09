import { buildWorkbook } from "@/lib/poll-data";

export const runtime = "nodejs";

/** Download an empty workbook template with both sheets and headers. */
export async function GET() {
  const buf = buildWorkbook([], []);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="reachout-poll-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
