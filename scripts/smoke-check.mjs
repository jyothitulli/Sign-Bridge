#!/usr/bin/env node
/**
 * Quick sanity checks (no camera). Run: npm run smoke
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0;
let fail = 0;

function check(name, pass) {
  if (pass) {
    console.log(`  OK  ${name}`);
    ok++;
  } else {
    console.log(`  FAIL ${name}`);
    fail++;
  }
}

console.log("SignBridge smoke check\n");

const glossPath = join(root, "public/models/gloss2en/index.json");
if (existsSync(glossPath)) {
  const g = JSON.parse(readFileSync(glossPath, "utf8"));
  check("gloss2en index", g.count > 0 && g.entries?.["YOU HUNGRY"]);
} else {
  check("gloss2en index exists", false);
}

const lstmConfig = join(root, "public/models/lstm/config.json");
const lstmModel = join(root, "public/models/lstm/model.json");
check("lstm config.json", existsSync(lstmConfig));
if (existsSync(lstmModel)) {
  check("trained model.json (TCN/LSTM active)", true);
} else {
  console.log("  INFO  model.json missing — app uses DTW (run npm run train:demo or train:wlasl)");
}

const wlaslJson = join(root, "training/data/WLASL_v0.3.json");
check("WLASL annotations downloaded", existsSync(wlaslJson));

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
