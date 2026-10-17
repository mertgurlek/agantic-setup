import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basename, join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { initRepo, write, run, git, cleanup, tmp } from './helpers.mjs';

// v0.30 hakem düzeltmeleri (K81) — künye-sürümüne bağlı sıkılık + argüman sağlığı + git-dizini damgası.
// İLKE: eski künyeye (skill_version < 0.30.0) --strict'te bile sessiz yeni FAIL dayatılmaz (UYARI + not);
// v0.30+ künye ya da künyesiz repo (paketin kendisi) → FAIL.
const KUNYE = (v) => JSON.stringify(v === null ? { name: 'x' } : { skill_version: v });
const NOT = /v0\.30\+ künyede FAIL olur — yükseltince göreceksin/;

// ── provenance coverage-gate ────────────────────────────────────────────────
const T_UNVER = `---
id: TECH-AUTH-001
feature_ids: [sifre-sifirlama]
verification:
  status: dogrulanmadi
  mock_guarded_count: 0
---
# T
`;
const T_OK = T_UNVER.replace('dogrulanmadi', 'dogrulandi');
const l0 = (tech, status, missing = '[]') => `---
id: TR-AUTH-001
feature_id: sifre-sifirlama
anchors:
  tech_docs: ${tech}
coverage:
  status: ${status}
  missing: ${missing}
---
# L0
`;
function cgRepo(kunye, tDoc, l0Text) {
  const d = initRepo();
  if (tDoc) write(d, 'docs/tech/auth.md', tDoc);
  write(d, 'docs/user/s.md', l0Text);
  if (kunye !== undefined) write(d, '.agentic-repo-setup.json', KUNYE(kunye));
  return d;
}
const cg = (d) => run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/s.md', '--strict'], d);

test('K81 coverage-gate: eksik + boş missing[] — eski künye → UYARI exit 0; v0.30 künye + künyesiz → exit 1', () => {
  for (const [kunye, kod] of [['0.29.0', 0], ['0.30.0', 1], [undefined, 1]]) {
    const d = cgRepo(kunye, T_UNVER, l0('[../tech/auth.md]', 'eksik'));
    const r = cg(d); cleanup(d);
    assert.equal(r.status, kod, `${kunye}: ${r.out}`);
    if (kod === 0) { assert.match(r.out, /UYARI/); assert.match(r.out, NOT); }
  }
});

test('K81 coverage-gate: tech_docs [] + eksik (yapısal) — eski künye exit 0 + not; v0.30 exit 1', () => {
  const eski = cgRepo('0.28.0', null, l0('[]', 'eksik', '["x"]'));
  const yeni = cgRepo('0.30.1', null, l0('[]', 'eksik', '["x"]'));
  const a = cg(eski), b = cg(yeni); cleanup(eski); cleanup(yeni);
  assert.equal(a.status, 0, a.out); assert.match(a.out, NOT);
  assert.equal(b.status, 1, b.out);
});

test('K81 coverage-gate: eski künyede ESKİDEN de yakalanan bulgu (eksik OLMAYAN + [T] yok) hâlâ FAIL', () => {
  const d = cgRepo('0.28.0', null, l0('[../tech/olmayan.md]', 'tam'));
  const r = cg(d); cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('K81 coverage-gate: eski künye + eksik + missing DOLU + doğrulanmamış [T] → temiz geçer (pozitif)', () => {
  const d = cgRepo('0.28.0', T_UNVER, l0('[../tech/auth.md]', 'eksik', '["x"]'));
  const r = cg(d); cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, NOT);
});

test('K81 coverage-gate: künyede skill_version YOK (bozuk künye) → eski sayılır, exit 0', () => {
  const d = cgRepo(null, T_OK, l0('[../tech/auth.md]', 'eksik'));
  const r = cg(d); cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ── doc-recency T3 / T4 ─────────────────────────────────────────────────────
function t3Repo(kunye) {
  const d = initRepo();
  write(d, 'src/a.ts', 'export class A {}\n');
  write(d, 'docs/knowledge/tech/a.md', '---\nid: K-A\nanchors:\n  - {repo: src/a.ts, symbol: A}\n---\n# A\n\nGövde.\n');
  if (kunye !== undefined) write(d, '.agentic-repo-setup.json', KUNYE(kunye));
  git(d, 'add', '-A');
  return d;
}
test('K81 doc-recency T3: eski künye + --strict → UYARI + not, exit 0; v0.30 künye + künyesiz → exit 1', () => {
  for (const [kunye, kod] of [['0.29.0', 0], ['0.30.0', 1], [undefined, 1]]) {
    const d = t3Repo(kunye);
    const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d); cleanup(d);
    assert.equal(r.status, kod, `${kunye}: ${r.out}`);
    if (kod === 0) { assert.match(r.out, /UYARI: 1 doküman/); assert.match(r.out, NOT); }
  }
});
function t4Repo(kunye) {
  const d = initRepo();
  write(d, 'README.md', '# x\n');
  write(d, 'docs/registry.yaml', 'features:\n');
  if (kunye !== undefined) write(d, '.agentic-repo-setup.json', KUNYE(kunye));
  git(d, 'add', '-A');
  return d;
}
test('K81 doc-recency + integrity T4 (registry var, doküman yok): eski künye exit 0 + not; v0.30 + künyesiz exit 1', () => {
  for (const rule of ['doc-recency', 'integrity']) {
    for (const [kunye, kod] of [['0.29.0', 0], ['0.30.0', 1], [undefined, 1]]) {
      const d = t4Repo(kunye);
      const r = run('check-doc-integrity.mjs', [`--rule=${rule}`, '--strict'], d); cleanup(d);
      assert.equal(r.status, kod, `${rule} ${kunye}: ${r.out}`);
      if (kod === 0) assert.match(r.out, NOT);
    }
  }
});

// ── integrity B7 ────────────────────────────────────────────────────────────
function b7Repo(kunye) {
  const d = initRepo();
  write(d, 'src/Add.cs', 'namespace X;\npublic class AddHandler\n{\n    public int Ping(int a)\n    {\n        return a;\n    }\n}\n');
  write(d, 'docs/tech/x.md', `---\nid: TECH-X-001\nfeature_ids: [x]\nanchors:\n  - {repo: ${basename(d)}, symbol: OlmayanSinif, kind: service, primary: true}\n---\n# TECH-X-001\n\n## Ne yapar\n\nGövde.\n`);
  if (kunye !== undefined) write(d, '.agentic-repo-setup.json', KUNYE(kunye));
  git(d, 'add', '-A');
  return d;
}
test('K81 integrity B7: "sembol bu repoda tanımlı değil" — eski künye UYARI exit 0 + not; v0.30 + künyesiz exit 1', () => {
  for (const [kunye, kod] of [['0.29.0', 0], ['0.30.0', 1], [undefined, 1]]) {
    const d = b7Repo(kunye);
    const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d); cleanup(d);
    assert.equal(r.status, kod, `${kunye}: ${r.out}`);
    assert.match(r.out, /tanımlı değil/);
    if (kod === 0) { assert.match(r.out, NOT); assert.match(r.out, /UYARI/); }
  }
});

// ── Madde 4: argüman sağlığı ────────────────────────────────────────────────
test('K81 doc-recency: doldurulmamış {{...}} argüman → FAIL; integrity de', () => {
  const d = initRepo();
  write(d, 'README.md', '# x\n'); git(d, 'add', '-A');
  const a = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '{{CASCADE_BAYRAGI}}'], d);
  const b = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--cascade}}'], d);
  const c = run('check-doc-integrity.mjs', ['--rule=integrity', '{{X}}'], d);
  cleanup(d);
  for (const r of [a, b, c]) { assert.equal(r.status, 1, r.out); assert.match(r.out, /doldurulmamış şablon alanı argüman olarak geldi/); }
  assert.match(a.out, /CASCADE_BAYRAGI/);
});

test('K81 doc-recency: diskte olmayan dosya argümanı → FAIL; var olan dosya argümanı → exit 0 (pozitif)', () => {
  const d = initRepo();
  write(d, 'README.md', '# x\n'); git(d, 'add', '-A');
  const yok = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', 'docs/olmayan.md'], d);
  const var_ = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', 'README.md'], d);
  const bayrakli = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '--cascade'], d);
  cleanup(d);
  assert.equal(yok.status, 1, yok.out); assert.match(yok.out, /diskte YOK: docs\/olmayan\.md/);
  assert.equal(var_.status, 0, var_.out);
  assert.equal(bayrakli.status, 0, bayrakli.out);
});

// ── Madde 6: install-version damgası — .git DOSYA (worktree/submodule) ──────────────────
function ivRepo(gitdirIcerik) {
  const d = tmp();
  const skill = tmp();
  write(d, '.agentic-repo-setup.json', JSON.stringify({ skill_version: '0.28.0' }));
  write(skill, 'package.json', JSON.stringify({ version: '0.30.0' }));
  const real = join(d, 'gercek-git');
  mkdirSync(real, { recursive: true });
  write(d, '.git', gitdirIcerik);        // .git bir DOSYA
  return { d, skill, real };
}
test('K81 install-version: .git DOSYA + gitdir → damga gerçek git dizinine yazılır; ikinci koşu sessiz; exit hep 0', () => {
  const { d, skill, real } = ivRepo('gitdir: gercek-git\n');
  const env = { AGENTIC_SKILL_DIR: skill };
  const r1 = run('check-self-registry.mjs', ['--rule=install-version'], d, env);
  const r2 = run('check-self-registry.mjs', ['--rule=install-version'], d, env);
  const damgaVar = existsSync(join(real, 'agentic-surum-uyari'));
  cleanup(d); cleanup(skill);
  assert.equal(r1.status, 0, r1.out); assert.match(r1.out, /v0\.28\.0 ile kurulmuş/);
  assert.equal(r2.status, 0, r2.out); assert.equal(r2.out, '');
  assert.equal(damgaVar, true);
});
test('K81 install-version: .git DOSYA ama gitdir çözülemez → damgasız (her koşuda uyarı), exit 0', () => {
  const { d, skill } = ivRepo('gitdir: yok-boyle-dizin\n');
  const env = { AGENTIC_SKILL_DIR: skill };
  const r1 = run('check-self-registry.mjs', ['--rule=install-version'], d, env);
  const r2 = run('check-self-registry.mjs', ['--rule=install-version'], d, env);
  cleanup(d); cleanup(skill);
  assert.equal(r1.status, 0, r1.out); assert.match(r1.out, /ile kurulmuş/);
  assert.equal(r2.status, 0, r2.out); assert.match(r2.out, /ile kurulmuş/);
});

// ── hakem 2. tur: integrity — diskte olmayan dosya argümanı (doc-recency ile aynı sınıf) ──
test('K81 integrity: diskte olmayan dosya argümanı → FAIL; var olan dosya argümanı → exit 0 (pozitif)', () => {
  const d = initRepo();
  write(d, 'README.md', '# x\n');
  const yok = run('check-doc-integrity.mjs', ['--rule=integrity', 'docs/olmayan.md'], d);
  const var_ = run('check-doc-integrity.mjs', ['--rule=integrity', 'README.md'], d);
  cleanup(d);
  assert.equal(yok.status, 1, yok.out); assert.match(yok.out, /diskte YOK: docs\/olmayan\.md/);
  assert.equal(var_.status, 0, var_.out);
});
