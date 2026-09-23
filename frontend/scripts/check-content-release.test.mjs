import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("release languages are not marked approved before human sign-off", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const review = JSON.parse(
    await readFile(join(root, "src/shared/i18n/review-status.json"), "utf8"),
  );

  assert.notEqual(review.as.nativeReview, "approved");
  assert.notEqual(review.bn.clinicalReview, "approved");
  assert.notEqual(review.regionalContent.nativeReview, "approved");
});
