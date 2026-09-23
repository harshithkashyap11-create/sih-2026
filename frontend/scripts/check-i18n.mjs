import { readFile, readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const root = fileURLToPath(new URL("../", import.meta.url));
export function flatten(value, prefix = "") {
  return Object.fromEntries(Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return nested && typeof nested === "object" ? Object.entries(flatten(nested, path)) : [[path, nested]];
  }));
}
export function catalogErrors(catalog, english, language, fallbacks = []) {
  const problems = [];
  const intentional = new Set(["app.title", "patient.title", "sos.label"]);
  const vars = (v) => typeof v === "string" ? [...v.matchAll(/{{\s*([^}]+)\s*}}/g)].map((x) => x[1].trim()).sort().join(",") : "";
  for (const key of new Set([...Object.keys(english), ...Object.keys(catalog)])) {
    if (!(key in catalog) && fallbacks.includes(key) && key in english) continue;
    const value = catalog[key];
    if (!(key in english) || !(key in catalog)) problems.push(`${language}: mismatched key ${key}`);
    if (typeof value !== "string" || !value.trim() || /TODO|FIXME|TBD|placeholder/i.test(value)) problems.push(`${language}: unfinished ${key}`);
    if (language !== "en" && value === english[key] && !intentional.has(key)) problems.push(`${language}: untranslated ${key}`);
    if (vars(value) !== vars(english[key])) problems.push(`${language}: interpolation mismatch ${key}`);
  }
  return problems;
}
async function files(dir) { return (await Promise.all((await readdir(dir, { withFileTypes: true })).map((e) => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))).flat(); }
const english = flatten(JSON.parse(await readFile(join(root, "src/shared/i18n/en.json"), "utf8")));
const problems = [];
const registry = await readFile(join(root, "src/games/registry.ts"), "utf8");
const descriptionKeys = [...registry.matchAll(/descriptionKey: "([^"]+)"/g)].map((match) => match[1]);
const legacy = registry.match(/const legacyModules = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
for (const name of legacy.match(/\b\w+\b/g) ?? []) {
  const match = registry.match(new RegExp(`import \\{ ${name} \\} from "\\./modules/([^"]+)"`));
  if (match && !["sequence_recall", "memory_match", "object_sorting"].includes(match[1])) descriptionKeys.push(`gameCatalog.${match[1]}.description`);
}
for (const key of descriptionKeys) if (!(key in english)) problems.push(`Catalogue: missing description ${key}`);
const gameFallbacks = JSON.parse(await readFile(join(root, "src/shared/i18n/game-english-fallbacks.json"), "utf8"));
for (const lang of ["en", "as", "bn", "hi"]) problems.push(...catalogErrors(flatten(JSON.parse(await readFile(join(root, `src/shared/i18n/${lang}.json`), "utf8"))), english, lang, gameFallbacks[lang] ?? []));
const telugu = flatten(JSON.parse(await readFile(join(root, "src/shared/i18n/te.json"), "utf8")));
for (const [key, value] of Object.entries(telugu)) {
  if (!value.trim()) problems.push(`te: empty ${key}`);
  const vars = (text) => [...text.matchAll(/{{\s*([^}]+)\s*}}/g)].map((match) => match[1].trim()).sort().join(",");
  if (english[key] && vars(value) !== vars(english[key])) problems.push(`te: interpolation mismatch ${key}`);
}
for (const file of await files(join(root, "src"))) {
  if (!/\.tsx?$/.test(file) || file.includes(".test.")) continue;
  const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node) {
    if (ts.isCallExpression(node) && /^(t|i18n\.t)$/.test(node.expression.getText(source)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const key = node.arguments[0].text;
      if (!(key in english) && !Object.keys(english).some((k) => k.startsWith(`${key}.`))) problems.push(`${file}: unknown translation ${key}`);
    }
    if (/\/features\/(patient|auth)\/|\/shared\/ui\/|\/games\//.test(file) && ts.isJsxText(node) && /[A-Za-z]{2}/.test(node.text.trim()) && !["English", "SMĀRANA", "Smārana", "PIN"].includes(node.text.trim())) problems.push(`${file}: hardcoded patient text ${node.text.trim()}`);
    ts.forEachChild(node, visit);
  }
  visit(source);
}
async function references(value, region) {
  if (typeof value === "string" && value.startsWith("/content/")) {
    const path = resolve(root, "public", `.${value}`);
    if (!path.startsWith(resolve(root, "public") + "/")) problems.push(`${region}: invalid asset path`);
    else try { await access(path); } catch { problems.push(`${region}: missing asset ${value}`); }
  } else if (value && typeof value === "object") await Promise.all(Object.values(value).map((v) => references(v, region)));
}
const packs = JSON.parse(await readFile(join(root, "src/content/demo-packs.json"), "utf8"));
for (const [region, pack] of Object.entries(packs)) { if (pack.region !== region) problems.push(`Invalid region reference ${region}`); await references(pack.items, region); }
const review = JSON.parse(await readFile(join(root, "src/shared/i18n/review-status.json"), "utf8"));
const configuration = await readFile(join(root, "src/shared/i18n/index.ts"), "utf8");
const supported = configuration.match(/supportedLanguages = \[([^\]]+)\]/)?.[1].match(/"([^"]+)"/g)?.map((language) => JSON.parse(language)) ?? [];
for (const lang of supported) if (!review[lang]?.origin || !review[lang]?.nativeReview || !review[lang]?.clinicalReview) problems.push(`${lang}: missing review provenance`);
if (!configuration.includes('fallbackLng: "en"')) problems.push("Catalogue checks require an explicit en default locale.");
if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
else console.log(`Locale catalogs, patient copy, interpolation, review provenance and content references pass (${Object.keys(english).length} keys).`);
