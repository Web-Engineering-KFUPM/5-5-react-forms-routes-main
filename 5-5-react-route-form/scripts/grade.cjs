#!/usr/bin/env node

/**
 * Lab Autograder — 5-5 React Routes + Forms
 *
 * Grades ONLY based on the TODOs in this lab:
 *  - TODO #1 (App.jsx): React Router (NavLink + Routes + 404)
 *  - TODO #2 (Registration.jsx): Add password + gender, required fields,
 *                               validate email (@ and endsWith .com),
 *                               disable submit until complete,
 *                               alert ONLY on successful submit
 *
 * Marking:
 * - 80 marks for TODOs (lenient, top-level checks only)
 * - 20 marks for submission timing (deadline-based)
 *   - On/before deadline => 20/20
 *   - After deadline     => 10/20
 *
 * Deadline: 2 Mar 2026 20:59 (Asia/Riyadh, UTC+03:00)
 *
 * Repo layout (per your screenshot):
 * - repo root contains .github/workflows/grader.yml
 * - project folder: 5-5-react-route-form/
 * - grader file:   5-5-react-route-form/scripts/grade.cjs
 * - student files: 5-5-react-route-form/src/...
 *
 * Notes:
 * - Ignores JS/JSX comments (so starter TODO comments do NOT count).
 * - Very lenient checks: looks for key constructs, not exact code.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ARTIFACTS_DIR = "artifacts";
const FEEDBACK_DIR = path.join(ARTIFACTS_DIR, "feedback");
fs.mkdirSync(FEEDBACK_DIR, { recursive: true });

/* -----------------------------
   Deadline (Asia/Riyadh)
   2 Mar 2026, 20:59
-------------------------------- */
const DEADLINE_RIYADH_ISO = "2026-03-02T20:59:00+03:00";
const DEADLINE_MS = Date.parse(DEADLINE_RIYADH_ISO);

// Submission marks policy
const SUBMISSION_MAX = 20;
const SUBMISSION_LATE = 10;

/* -----------------------------
   TODO marks (out of 80)
   (easy, top-level distribution)
-------------------------------- */
const tasks = [
  { id: "t1", name: "TODO #1A: Router imports + navbar links (App.jsx)", marks: 20 },
  { id: "t2", name: "TODO #1B: Routes + 404 route (App.jsx)", marks: 20 },
  { id: "t3", name: "TODO #2A: Password + gender fields + errors UI (Registration.jsx)", marks: 20 },
  { id: "t4", name: "TODO #2B: Validation + disable button + success-only alert (Registration.jsx)", marks: 20 },
];

const STEPS_MAX = tasks.reduce((sum, t) => sum + t.marks, 0); // 80
const TOTAL_MAX = STEPS_MAX + SUBMISSION_MAX; // 100

/* -----------------------------
   Helpers
-------------------------------- */
function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function mdEscape(s) {
  return String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function splitMarks(stepMarks, missingCount, totalChecks) {
  if (missingCount <= 0) return stepMarks;
  const perItem = stepMarks / totalChecks;
  const deducted = perItem * missingCount;
  return Math.max(0, round2(stepMarks - deducted));
}

/**
 * Strip JS/JSX comments while trying to preserve strings/templates.
 * Not a full parser, but robust enough for beginner labs and avoids
 * counting commented-out code.
 */
function stripJsComments(code) {
  if (!code) return code;

  let out = "";
  let i = 0;

  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];

    // Handle string/template boundaries (with escapes)
    if (!inDouble && !inTemplate && ch === "'" && !inSingle) {
      inSingle = true;
      out += ch;
      i++;
      continue;
    }
    if (inSingle && ch === "'") {
      let backslashes = 0;
      for (let k = i - 1; k >= 0 && code[k] === "\\"; k--) backslashes++;
      if (backslashes % 2 === 0) inSingle = false;
      out += ch;
      i++;
      continue;
    }

    if (!inSingle && !inTemplate && ch === '"' && !inDouble) {
      inDouble = true;
      out += ch;
      i++;
      continue;
    }
    if (inDouble && ch === '"') {
      let backslashes = 0;
      for (let k = i - 1; k >= 0 && code[k] === "\\"; k--) backslashes++;
      if (backslashes % 2 === 0) inDouble = false;
      out += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && ch === "`" && !inTemplate) {
      inTemplate = true;
      out += ch;
      i++;
      continue;
    }
    if (inTemplate && ch === "`") {
      let backslashes = 0;
      for (let k = i - 1; k >= 0 && code[k] === "\\"; k--) backslashes++;
      if (backslashes % 2 === 0) inTemplate = false;
      out += ch;
      i++;
      continue;
    }

    // If not inside a string/template, strip comments
    if (!inSingle && !inDouble && !inTemplate) {
      // line comment
      if (ch === "/" && next === "/") {
        i += 2;
        while (i < code.length && code[i] !== "\n") i++;
        continue;
      }
      // block comment
      if (ch === "/" && next === "*") {
        i += 2;
        while (i < code.length) {
          if (code[i] === "*" && code[i + 1] === "/") {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out;
}

function existsFile(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function listAllFiles(rootDir) {
  const ignoreDirs = new Set([
    "node_modules",
    ".git",
    ARTIFACTS_DIR,
    "dist",
    "build",
    ".next",
    ".cache",
  ]);

  const stack = [rootDir];
  const out = [];

  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!ignoreDirs.has(e.name)) stack.push(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

/* -----------------------------
   Project root detection (robust)
-------------------------------- */
const REPO_ROOT = process.cwd();

function isViteReactProjectFolder(p) {
  try {
    return (
      fs.existsSync(path.join(p, "package.json")) &&
      fs.existsSync(path.join(p, "src")) &&
      fs.statSync(path.join(p, "src")).isDirectory()
    );
  } catch {
    return false;
  }
}

function pickProjectRoot(cwd) {
  // If action runs inside the project folder already
  if (isViteReactProjectFolder(cwd)) return cwd;

  // Prefer the known lab folder name from this lab
  const preferred = path.join(cwd, "5-5-react-route-form");
  if (isViteReactProjectFolder(preferred)) return preferred;

  // Otherwise pick any subfolder that looks like a Vite React project
  let subs = [];
  try {
    subs = fs
      .readdirSync(cwd, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    subs = [];
  }

  for (const name of subs) {
    const p = path.join(cwd, name);
    if (isViteReactProjectFolder(p)) return p;
  }

  // fallback
  return cwd;
}

const PROJECT_ROOT = pickProjectRoot(REPO_ROOT);

/* -----------------------------
   Find files
-------------------------------- */
function findFileByBasename(names) {
  const preferred = names
    .flatMap((n) => [
      path.join(PROJECT_ROOT, "src", n),
      path.join(PROJECT_ROOT, "src", "pages", n),
    ])
    .filter((p) => existsFile(p));

  if (preferred.length) return preferred[0];

  const all = listAllFiles(PROJECT_ROOT);
  const lowerSet = new Set(names.map((x) => x.toLowerCase()));
  const found = all.find((p) => lowerSet.has(path.basename(p).toLowerCase()));
  return found || null;
}

const appFile = findFileByBasename(["App.jsx", "App.js"]);
const regFile = findFileByBasename(["Registration.jsx", "Registration.js"]);
const homeFile = findFileByBasename(["Home.jsx", "Home.js"]);
const aboutFile = findFileByBasename(["About.jsx", "About.js"]);

/* -----------------------------
   Determine submission time
-------------------------------- */
let lastCommitISO = null;
let lastCommitMS = null;

try {
  lastCommitISO = execSync("git log -1 --format=%cI", { encoding: "utf8" }).trim();
  lastCommitMS = Date.parse(lastCommitISO);
} catch {
  lastCommitISO = new Date().toISOString();
  lastCommitMS = Date.now();
}

/* -----------------------------
   Submission marks
-------------------------------- */
const isLate = Number.isFinite(lastCommitMS) ? lastCommitMS > DEADLINE_MS : true;
const submissionScore = isLate ? SUBMISSION_LATE : SUBMISSION_MAX;

/* -----------------------------
   Load & strip student files
-------------------------------- */
const appRaw = appFile ? safeRead(appFile) : null;
const regRaw = regFile ? safeRead(regFile) : null;

const app = appRaw ? stripJsComments(appRaw) : null;
const reg = regRaw ? stripJsComments(regRaw) : null;

const results = [];

/* -----------------------------
   Result helpers
-------------------------------- */
function addResult(task, required) {
  const missing = required.filter((r) => !r.ok);
  const score = splitMarks(task.marks, missing.length, required.length);

  results.push({
    id: task.id,
    name: task.name,
    max: task.marks,
    score,
    checklist: required.map((r) => `${r.ok ? "✅" : "❌"} ${r.label}`),
    deductions: missing.length ? missing.map((m) => `Missing: ${m.label}`) : [],
  });
}

function failTask(task, reason) {
  results.push({
    id: task.id,
    name: task.name,
    max: task.marks,
    score: 0,
    checklist: [],
    deductions: [reason],
  });
}

function mkHas(code) {
  return (re) => re.test(code);
}
function anyOf(has, res) {
  return res.some((r) => has(r));
}

/* -----------------------------
   Grade TODOs
-------------------------------- */

// TODO #1A — App.jsx: router imports + navbar links
{
  if (!app) {
    failTask(
      tasks[0],
      appFile ? `Could not read App file at: ${appFile}` : "App.jsx not found under src/."
    );
  } else {
    const has = mkHas(app);

    const required = [
      {
        label: 'Imports router primitives (Routes/Route/NavLink) from "react-router-dom"',
        ok: anyOf(has, [
          /from\s*["']react-router-dom["']/i,
        ]) && anyOf(has, [
          /\bRoutes\b/i,
          /\bRoute\b/i,
          /\bNavLink\b/i,
        ]),
      },
      {
        label: "Navbar contains NavLink(s)",
        ok: anyOf(has, [/<\s*NavLink\b/i]),
      },
      {
        label: 'Has a Home link to "/" (preferably with end)',
        ok: anyOf(has, [
          /<\s*NavLink[^>]*\bto\s*=\s*["']\/["']/i,
          /<\s*NavLink[^>]*\bto\s*=\s*\{\s*["']\/["']\s*\}/i,
        ]),
      },
      {
        label: 'Has an About link to "/about"',
        ok: anyOf(has, [
          /<\s*NavLink[^>]*\bto\s*=\s*["']\/about["']/i,
          /<\s*NavLink[^>]*\bto\s*=\s*\{\s*["']\/about["']\s*\}/i,
        ]),
      },
      {
        label: 'Has a Registration link to "/registration"',
        ok: anyOf(has, [
          /<\s*NavLink[^>]*\bto\s*=\s*["']\/registration["']/i,
          /<\s*NavLink[^>]*\bto\s*=\s*\{\s*["']\/registration["']\s*\}/i,
        ]),
      },
    ];

    addResult(tasks[0], required);
  }
}

// TODO #1B — App.jsx: Routes + 404
{
  if (!app) {
    failTask(tasks[1], "App.jsx not found / unreadable.");
  } else {
    const has = mkHas(app);

    const required = [
      {
        label: "Defines <Routes> ... </Routes>",
        ok: anyOf(has, [/<\s*Routes\b/i]) && anyOf(has, [/<\s*\/\s*Routes\s*>/i]),
      },
      {
        label: 'Route for "/" renders <Home />',
        ok: anyOf(has, [
          /<\s*Route[^>]*\bpath\s*=\s*["']\/["'][^>]*\belement\s*=\s*\{\s*<\s*Home\s*\/\s*>\s*\}/i,
          /<\s*Route[^>]*\belement\s*=\s*\{\s*<\s*Home\s*\/\s*>\s*\}[^>]*\bpath\s*=\s*["']\/["']/i,
        ]),
      },
      {
        label: 'Route for "/about" renders <About />',
        ok: anyOf(has, [
          /<\s*Route[^>]*\bpath\s*=\s*["']\/about["'][^>]*\belement\s*=\s*\{\s*<\s*About\s*\/\s*>\s*\}/i,
          /<\s*Route[^>]*\belement\s*=\s*\{\s*<\s*About\s*\/\s*>\s*\}[^>]*\bpath\s*=\s*["']\/about["']/i,
        ]),
      },
      {
        label: 'Route for "/registration" renders <Registration />',
        ok: anyOf(has, [
          /<\s*Route[^>]*\bpath\s*=\s*["']\/registration["'][^>]*\belement\s*=\s*\{\s*<\s*Registration\s*\/\s*>\s*\}/i,
          /<\s*Route[^>]*\belement\s*=\s*\{\s*<\s*Registration\s*\/\s*>\s*\}[^>]*\bpath\s*=\s*["']\/registration["']/i,
        ]),
      },
      {
        label: 'Has a catch-all 404 route (path="*")',
        ok: anyOf(has, [
          /<\s*Route[^>]*\bpath\s*=\s*["']\*["']/i,
          /path\s*=\s*["']\*["']/i,
        ]),
      },
    ];

    addResult(tasks[1], required);
  }
}

// TODO #2A — Registration.jsx: new fields + UI + errors under inputs
{
  if (!reg) {
    failTask(
      tasks[2],
      regFile ? `Could not read Registration file at: ${regFile}` : "Registration.jsx not found under src/pages."
    );
  } else {
    const has = mkHas(reg);

    const required = [
      {
        label: "Has state for password (useState + setPassword)",
        ok: anyOf(has, [/\[\s*password\s*,\s*setPassword\s*\]\s*=\s*useState\s*\(/i]),
      },
      {
        label: "Has state for gender (useState + setGender)",
        ok: anyOf(has, [/\[\s*gender\s*,\s*setGender\s*\]\s*=\s*useState\s*\(/i]),
      },
      {
        label: 'Renders a password input (type="password")',
        ok: anyOf(has, [/<\s*input[^>]*\btype\s*=\s*["']password["']/i]),
      },
      {
        label: "Renders gender radio inputs (type=radio + name=gender)",
        ok: anyOf(has, [
          /type\s*=\s*["']radio["']/i,
        ]) && anyOf(has, [
          /\bname\s*=\s*["']gender["']/i,
        ]),
      },
      {
        label: "Shows error message(s) with <p className=\"error\"> ... </p>",
        ok: anyOf(has, [/className\s*=\s*["']error["']/i]) && anyOf(has, [/\berrors\.\w+/i]),
      },
    ];

    addResult(tasks[2], required);
  }
}

// TODO #2B — Registration.jsx: validation + disable + success-only alert
{
  if (!reg) {
    failTask(tasks[3], "Registration.jsx not found / unreadable.");
  } else {
    const has = mkHas(reg);

    // Very lenient "success-only alert" check:
    // - Must have nextErrors object
    // - Must setErrors(nextErrors)
    // - Must have guard: if (Object.keys(nextErrors).length > 0) return;
    // - Must have alert(...) somewhere after that guard (best-effort via index ordering)
    const idxSetErrors = reg.search(/setErrors\s*\(\s*nextErrors\s*\)/i);
    const idxGuard = reg.search(/Object\.keys\s*\(\s*nextErrors\s*\)\s*\.?\s*length\s*>\s*0\s*\)\s*return/i);
    const idxAlert = reg.search(/\balert\s*\(/i);
    const alertAfterGuard = idxGuard !== -1 && idxAlert !== -1 && idxAlert > idxGuard;

    const required = [
      {
        label: "Builds an errors object (nextErrors) and sets it (setErrors(nextErrors))",
        ok: anyOf(has, [/\bconst\s+nextErrors\s*=\s*\{\s*\}\s*;/i, /\bconst\s+nextErrors\s*=\s*\{\s*\}/i]) &&
            anyOf(has, [/setErrors\s*\(\s*nextErrors\s*\)/i]),
      },
      {
        label: 'Email validation checks "@" and ends with ".com" (top-level)',
        ok: anyOf(has, [/\bemail\s*\.\s*includes\s*\(\s*["']@["']\s*\)/i]) &&
            anyOf(has, [/\bemail\s*\.\s*endsWith\s*\(\s*["']\.com["']\s*\)/i]),
      },
      {
        label: "Validates password required and gender selected (top-level)",
        ok: anyOf(has, [/\bpassword\b/i]) && anyOf(has, [/\bgender\b/i]) &&
            anyOf(has, [/required/i, /is required/i, /Please select/i, /nextErrors\.\w+\s*=/i]),
      },
      {
        label: "Stops submit when errors exist (Object.keys(nextErrors).length > 0 return)",
        ok: anyOf(has, [/Object\.keys\s*\(\s*nextErrors\s*\)\s*\.?\s*length\s*>\s*0/i]) &&
            anyOf(has, [/\)\s*return\s*;?/i]),
      },
      {
        label: "Register button is disabled until fields are filled (disabled={...})",
        ok: anyOf(has, [/button[^>]*\bdisabled\s*=\s*\{/i]),
      },
      {
        label: "Shows alert ONLY on success (best-effort: alert occurs after the error guard)",
        ok: idxAlert !== -1 && idxSetErrors !== -1 && idxGuard !== -1 && alertAfterGuard,
      },
    ];

    addResult(tasks[3], required);
  }
}

/* -----------------------------
   Final scoring
-------------------------------- */
const stepsScore = results.reduce((sum, r) => sum + r.score, 0);
const totalScore = round2(stepsScore + submissionScore);

/* -----------------------------
   Build summary + feedback (same style)
-------------------------------- */
const LAB_NAME = "5-5-react-forms-routes-main";

const submissionLine = `- **Lab:** ${LAB_NAME}
- **Deadline (Riyadh / UTC+03:00):** ${DEADLINE_RIYADH_ISO}
- **Last commit time (from git log):** ${lastCommitISO}
- **Submission marks:** **${submissionScore}/${SUBMISSION_MAX}** ${isLate ? "(Late submission)" : "(On time)"}
`;

let summary = `# ${LAB_NAME} — Autograding Summary

## Submission

${submissionLine}

## Files Checked

- Repo root (cwd): ${REPO_ROOT}
- Detected project root: ${PROJECT_ROOT}
- App: ${appFile ? `✅ ${appFile}` : "❌ App.jsx not found"}
- Registration: ${regFile ? `✅ ${regFile}` : "❌ Registration.jsx not found"}
- Home: ${homeFile ? `✅ ${homeFile}` : "⚠️ Home.jsx not found (not required for grading)"}
- About: ${aboutFile ? `✅ ${aboutFile}` : "⚠️ About.jsx not found (not required for grading)"}

## Marks Breakdown

| Component | Marks |
|---|---:|
`;

for (const r of results) summary += `| ${r.name} | ${r.score}/${r.max} |\n`;
summary += `| Submission (timing) | ${submissionScore}/${SUBMISSION_MAX} |\n`;

summary += `
## Total Marks

**${totalScore} / ${TOTAL_MAX}**

## Detailed Checks (What you did / missed)
`;

for (const r of results) {
  const done = (r.checklist || []).filter((x) => x.startsWith("✅"));
  const missed = (r.checklist || []).filter((x) => x.startsWith("❌"));

  summary += `
<details>
  <summary><strong>${mdEscape(r.name)}</strong> — ${r.score}/${r.max}</summary>

  <br/>

  <strong>✅ Found</strong>
  ${done.length ? "\n" + done.map((x) => `- ${mdEscape(x)}`).join("\n") : "\n- (Nothing detected)"}

  <br/><br/>

  <strong>❌ Missing</strong>
  ${missed.length ? "\n" + missed.map((x) => `- ${mdEscape(x)}`).join("\n") : "\n- (Nothing missing)"}

  <br/><br/>

  <strong>❗ Deductions / Notes</strong>
  ${
    r.deductions && r.deductions.length
      ? "\n" + r.deductions.map((d) => `- ${mdEscape(d)}`).join("\n")
      : "\n- No deductions."
  }

</details>
`;
}

summary += `
> Full feedback is also available in: \`artifacts/feedback/README.md\`
`;

let feedback = `# ${LAB_NAME} — Feedback

## Submission

${submissionLine}

## Files Checked

- Repo root (cwd): ${REPO_ROOT}
- Detected project root: ${PROJECT_ROOT}
- App: ${appFile ? `✅ ${appFile}` : "❌ App.jsx not found"}
- Registration: ${regFile ? `✅ ${regFile}` : "❌ Registration.jsx not found"}
- Home: ${homeFile ? `✅ ${homeFile}` : "⚠️ Home.jsx not found (not required for grading)"}
- About: ${aboutFile ? `✅ ${aboutFile}` : "⚠️ About.jsx not found (not required for grading)"}

---

## TODO-by-TODO Feedback
`;

for (const r of results) {
  feedback += `
### ${r.name} — **${r.score}/${r.max}**

**Checklist**
${r.checklist.length ? r.checklist.map((x) => `- ${x}`).join("\n") : "- (No checks available)"}

**Deductions / Notes**
${r.deductions.length ? r.deductions.map((d) => `- ❗ ${d}`).join("\n") : "- ✅ No deductions. Good job!"}
`;
}

feedback += `
---

## How marks were deducted (rules)

- JS/JSX comments are ignored (so starter TODO comments do NOT count).
- Checks are intentionally light: they look for key constructs and basic structure.
- Code can be in ANY order; repeated code is allowed.
- Common equivalents are accepted, and naming is flexible.
- Missing required items reduce marks proportionally within that TODO.
`;

/* -----------------------------
   Write outputs
-------------------------------- */
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

const csv = `student,score,max_score
all_students,${totalScore},${TOTAL_MAX}
`;

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
fs.writeFileSync(path.join(ARTIFACTS_DIR, "grade.csv"), csv);
fs.writeFileSync(path.join(FEEDBACK_DIR, "README.md"), feedback);

console.log(
  `✔ Lab graded: ${totalScore}/${TOTAL_MAX} (Submission: ${submissionScore}/${SUBMISSION_MAX}, TODOs: ${stepsScore}/${STEPS_MAX}).`
);