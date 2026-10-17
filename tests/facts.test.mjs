// scripts/facts.mjs — FACTS katmanının ölçüm koşucusu (v0.26).
// Kapı testleri `tests/check-doc-integrity.test.mjs` içinde (--rule=facts-drift); bu dosya
// ÖLÇÜCÜNÜN kendi sözleşmesini denetler: unknown semantiği · politika/ölçüm ayrımı · cmd dürüstlüğü.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const facts = (args = []) => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync('node', [join(ROOT, 'scripts', 'facts.mjs'), ...args], { cwd: ROOT, encoding: 'utf8', env });
  return { status: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim() };
};

// UNKNOWN ≠ 0 — saha-H vakasının panzehiri: o repoda bir analiz deseni %13 → 0 düştü çünkü
// veri şeması değişti ve sistem bunu SESSİZ SIFIR sandı. Ölçülemeyen fact 0 DÖNMEZ.
test('facts: ölçülemeyen fact unknown döner, ASLA 0 değil', () => {
  const r = facts(['--quick', '--json']);
  assert.equal(r.status, 0, r.out);
  const doc = JSON.parse(r.out);
  const tc = doc.measurements.test_count;
  assert.equal(tc.status, 'unknown', '--quick test koşusunu atlar → unknown olmalı');
  assert.equal(tc.value, undefined, 'unknown fact value TAŞIMAMALI (0 dahil)');
});

test('facts: unknown kaydı bile ölçüm KOMUTUNU taşır (insan elle doğrulayabilsin)', () => {
  const doc = JSON.parse(facts(['--quick', '--json']).out);
  assert.equal(doc.measurements.test_count.cmd, 'node --test tests/*.test.mjs');   // SB-9: kapsam yalnız tests/
});

// HAKEM BULGUSU B-1 (2026-09-06) REGRESYON NÖBETÇİSİ: `cmd` alanı "insan elle koşup
// doğrulayabilsin" diye var. `wc -l` diyorsa değer de `wc -l` semantiğinde olmalı — yoksa
// doğrulama yolu doğruladığı değerle çelişir (bu katmanın savaştığı hatanın kendisi).
test('facts: satır sayıları `wc -l` ile BİREBİR aynı (cmd dürüstlüğü)', () => {
  const doc = JSON.parse(facts(['--quick', '--json']).out);
  for (const [key, dosya] of [['skill_md_lines', 'SKILL.md'], ['claude_md_lines', 'CLAUDE.md']]) {
    const rec = doc.measurements[key];
    if (rec.status !== 'measured') continue;
    const wc = (readFileSync(join(ROOT, dosya), 'utf8').match(/\n/g) || []).length;
    assert.equal(rec.value, wc, `${key}: facts ${rec.value} ≠ wc -l ${wc} — cmd "${rec.cmd}" yalan söylüyor`);
  }
});

// POLİTİKA ≠ ÖLÇÜM — K71'in "nasıl ölür ①" sinyali: politika sabiti ölçüm sanılırsa katman çöker.
test('facts: measurements bölümünde tavan/eşik/bütçe ANAHTARI yok', () => {
  const doc = JSON.parse(facts(['--quick', '--json']).out);
  for (const k of Object.keys(doc.measurements))
    assert.doesNotMatch(k, /_cap$|_tavan$|_limit$|_esik$|_budget$/, `ölçüm bölümüne politika anahtarı sızdı: ${k}`);
});

test('facts: policy bölümü makine tarafından EZİLMEZ (insan yazar)', () => {
  const fp = join(ROOT, 'facts.json');
  const yedek = existsSync(fp) ? readFileSync(fp, 'utf8') : null;
  try {
    const doc = JSON.parse(yedek || '{"measurements":{},"policy":{}}');
    doc.policy = { ...doc.policy, _deney_anahtari: 12345 };
    writeFileSync(fp, JSON.stringify(doc, null, 2) + '\n');
    facts(['--quick']);
    const sonra = JSON.parse(readFileSync(fp, 'utf8'));
    assert.equal(sonra.policy._deney_anahtari, 12345, 'ölçüm koşusu policy bölümünü EZDİ');
  } finally {
    if (yedek !== null) writeFileSync(fp, yedek); else if (existsSync(fp)) unlinkSync(fp);
  }
});

// --check: kayıtlı değer ile güncel ölçüm ayrışırsa exit 1 (mutasyon deneyinin birim hâli).
test('facts --check: kayıtlı değer bozulursa DELTA ile FAIL (exit 1)', () => {
  const fp = join(ROOT, 'facts.json');
  const yedek = existsSync(fp) ? readFileSync(fp, 'utf8') : null;
  if (yedek === null) return;   // facts.json yoksa bu deney anlamsız
  try {
    const doc = JSON.parse(yedek);
    doc.measurements.gate_count = { status: 'measured', value: 99, cmd: 'x', measured_at: '2026-01-01' };
    writeFileSync(fp, JSON.stringify(doc, null, 2) + '\n');
    const r = facts(['--check', '--quick']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /gate_count/);
    assert.match(r.out, /Δ/);
  } finally { writeFileSync(fp, yedek); }
});

test('facts --check: facts.json yokken açık hata verir (sessiz geçmez)', () => {
  const fp = join(ROOT, 'facts.json');
  const tmp = join(ROOT, 'facts.json.testbak');
  if (!existsSync(fp)) return;
  copyFileSync(fp, tmp); unlinkSync(fp);
  try {
    const r = facts(['--check', '--quick']);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /yok/);
  } finally { copyFileSync(tmp, fp); unlinkSync(tmp); }
});
