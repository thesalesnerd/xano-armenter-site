#!/usr/bin/env node
// Fails unless a migration only adds things: new tables, indexes, policies,
// triggers and functions, plus grants and RLS on the tables it creates.
// No ALTER of existing objects, no DROP, no CREATE OR REPLACE, no DELETE,
// UPDATE, TRUNCATE or INSERT into existing tables.
//
//   node check-additive.mjs <migration.sql> [--live <names.json>]
//
// With --live, <names.json> is a JSON array of names already in the database
// (tables, views and functions of the public schema); any name the migration
// creates must not be among them.
import { readFileSync } from 'node:fs';

const [file, flag, liveFile] = process.argv.slice(2);
const sql = readFileSync(file, 'utf8')
  // Strip comments and function bodies ($$ ... $$), which may contain any words.
  .replace(/--[^\n]*/g, '')
  .replace(/\$\$[\s\S]*?\$\$/g, '$$$$');

const statements = sql.split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const created = new Set();
const problems = [];

for (const s of statements) {
  const low = s.toLowerCase();
  let m;
  if ((m = low.match(/^create (?:unique )?index [a-z0-9_]+ on public\.([a-z0-9_]+)/))) {
    if (!created.has(m[1])) problems.push(`index on a table this migration did not create: ${s}`);
  } else if ((m = low.match(/^create table public\.([a-z0-9_]+)/))) {
    created.add(m[1]);
  } else if ((m = low.match(/^create function public\.([a-z0-9_]+)/))) {
    created.add(m[1]);
  } else if ((m = low.match(/^create trigger [a-z0-9_]+ before|^create trigger [a-z0-9_]+ after/))) {
    const t = low.match(/ on public\.([a-z0-9_]+)/)?.[1];
    if (!created.has(t)) problems.push(`trigger on a table this migration did not create: ${s}`);
  } else if ((m = low.match(/^create policy "[^"]+" on public\.([a-z0-9_]+)/))) {
    if (!created.has(m[1])) problems.push(`policy on a table this migration did not create: ${s}`);
  } else if ((m = low.match(/^alter table public\.([a-z0-9_]+) enable row level security$/))) {
    if (!created.has(m[1])) problems.push(`RLS change on an existing table: ${s}`);
  } else if (/^(grant|revoke) /.test(low)) {
    const names = [...low.matchAll(/public\.([a-z0-9_]+)/g)].map((x) => x[1]);
    for (const n of names) if (!created.has(n)) problems.push(`grant/revoke on an existing object (${n}): ${s}`);
  } else {
    problems.push(`not an additive statement: ${s}`);
  }
}

if (flag === '--live') {
  const live = new Set(JSON.parse(readFileSync(liveFile, 'utf8')));
  for (const n of created) if (live.has(n)) problems.push(`"${n}" already exists in the database`);
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ additive: creates ${[...created].join(', ')}`);
