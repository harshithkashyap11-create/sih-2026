import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const review = JSON.parse(
  await readFile(join(root, "src/shared/i18n/review-status.json"), "utf8"),
);
const languages = (process.env.RELEASE_LANGUAGES ?? "")
  .split(",")
  .map((language) => language.trim())
  .filter(Boolean);
const problems = [];

if (!languages.length) {
  problems.push(
    "Set RELEASE_LANGUAGES to the language codes approved for release.",
  );
}
for (const language of languages) {
  const status = review[language];
  if (!status) {
    problems.push(`${language}: missing review-status entry`);
    continue;
  }
  if (status.nativeReview !== "approved") {
    problems.push(`${language}: native-speaker review is not approved`);
  }
  if (status.clinicalReview !== "approved") {
    problems.push(`${language}: clinical review is not approved`);
  }
}

if (process.env.RELEASE_REGIONAL_CONTENT === "1") {
  const regional = review.regionalContent ?? {};
  if (regional.nativeReview !== "approved") {
    problems.push("regionalContent: native-speaker review is not approved");
  }
  if (regional.clinicalReview !== "approved") {
    problems.push("regionalContent: clinical review is not approved");
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Release content review passed for: ${languages.join(", ")}`);
}
