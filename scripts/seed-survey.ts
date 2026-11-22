import { readFileSync } from "node:fs";
import { parseSurveyHtml } from "../lib/survey/parse";
import { publishSurvey } from "../lib/survey/store";
import { SURVEY_STATES } from "../lib/survey/types";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

(async () => {
  const state = arg("state");
  const file = arg("file");
  if (!state || !file) throw new Error("Usage: npm run seed:survey -- --state tamil-nadu --file <path>");
  const meta = SURVEY_STATES[state];
  if (!meta) throw new Error(`Unknown survey state: ${state}`);
  const source = readFileSync(file, "utf8");
  const data = parseSurveyHtml(source, state);
  const version = await publishSurvey(state, file.split("/").pop() ?? file, data);
  console.log(`Seeded ${meta.name} survey dashboard version ${version} (${data.periods ? Object.keys(data.periods).join(", ") : "no periods"})`);
  process.exit(0);
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
