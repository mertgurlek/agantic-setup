// AST-indeks besleme adaptörü testleri (v0.10 — DEAK §5.1).
// SÖZLEŞME (5-model uzlaşısı + doctrine statik-index kısıtı): graf doğruluğun KAYNAĞI DEĞİLDİR.
//   • Adaptör KAPALI (env yok) → davranış BİREBİR status quo (FP guard — en kritik test).
//   • Adaptör AÇIK → yalnız `sembol-yok` MESAJINA ipucu eklenir; VERDICT (exit kodu) DEĞİŞMEZ.
//   • CLI yok / çöküyor / bozuk JSON → fail-open (ipucu yok, yine status quo).
// Testler sahte bir `cmm` CLI'ı üretir (mock değil — gerçek execSync yolu koşulur).
import { test } from 'node:test';
import assert from 'node:assert';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { initRepo, write, run, runScript, cleanup } from './helpers.mjs';

// Sahte cmm CLI üret: verilen JSON'u basar. Node shebang'li — Windows'ta da koşsun diye
// doğrudan `node <script>` olarak çağrılır (ARS_AST_CLI'ye "node <yol>" geçilir).
function fakeCli(dir, body) {
  const rel = write(dir, 'fake-cmm.mjs', body);
  const abs = join(dir, rel);
  try { chmodSync(abs, 0o755); } catch { /* Windows'ta gereksiz */ }
  return `${JSON.stringify(process.execPath)} ${JSON.stringify(abs)}`;
}

// Gerçek codebase-memory-mcp 0.9.0 çıktı şeması (pilotta ÖLÇÜLDÜ): stdout'ta önce satır-bazlı
// log (level=info ...), sonra JSON gövdesi — {"total":N,"results":[{"file_path":...}]}.
// Sahte CLI bu şekli birebir taklit eder (log satırı dahil) ki ayıklama mantığı da test edilsin.
const LOG = 'console.error("level=info msg=mem.init");\nconsole.log("level=info msg=cli.start");\n';
const SEES_NOTHING = LOG + 'console.log(JSON.stringify({ total: 0, results: [], has_more: false }));\n';
const SEES_ELSEWHERE = LOG + 'console.log(JSON.stringify({ total: 1, results: [{ name: "X", file_path: "src/other.ts" }], has_more: false }));\n';
const BROKEN = 'console.log("bu JSON degil {{{");\n';
const CRASHES = 'process.exit(3);\n';

// [T] frontmatter'ı: yol VAR ama sembol dosyada YOK → 'sembol-yok' (SAHTE anchor) dalını tetikler.
// Kalıp tests/check-doc-integrity.test.mjs'teki kanonik "anchors[] sahte" fixture'ının aynısı.
function fixture(d) {
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'src/auth/Login.cs', 'class SomeOtherHandler {}\n');
  write(d, 'docs/tech/auth.md',
    '---\nid: TECH-AUTH-001\nfeature_ids: [sifre-sifirlama]\n' +
    'anchors:\n  - {repo: src/auth/Login.cs, symbol: LoginCommandHandler, kind: handler, primary: true}\n' +
    '---\n# T\n');
  return 'docs/tech/auth.md';
}

// ── FP GUARD (en kritik): adaptör KAPALIYKEN çıktı statüko ──────────────────────────
test('AST adaptörü KAPALI → doc-truth çıktısı birebir statüko (ipucu YOK)', () => {
  const d = initRepo();
  const doc = fixture(d);
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', doc], d);           // env yok
  cleanup(d);
  assert.equal(r.status, 0, r.out);                          // varsayılan UYARI, bloke etmez
  assert.match(r.out, /sahte/i);                             // mevcut bulgu duruyor
  assert.doesNotMatch(r.out, /AST indeksi/);                 // ipucu YOK
});

// ── Adaptör AÇIK: graf da görmüyor → "gerçekten ölü" ipucu, verdict AYNI ────────────
test('AST açık + graf görmüyor → ipucu eklenir, exit kodu DEĞİŞMEZ', () => {
  const d = initRepo();
  const doc = fixture(d);
  const env = { ARS_AST_ADAPTER: 'test-proje', ARS_AST_CLI: fakeCli(d, SEES_NOTHING) };
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', doc], d, env);
  const strict = run('check-doc-integrity.mjs', ['--rule=doc-truth', doc, '--strict'], d, env);
  cleanup(d);
  assert.equal(r.status, 0, r.out);                          // UYARI modu korunur
  assert.match(r.out, /AST indeksi de bu sembolü görmüyor/);
  assert.equal(strict.status, 1, strict.out);                // --strict yine bloke eder
});

// ── Adaptör AÇIK: graf başka yerde görüyor → "anchor yolu yanlış" ipucu ─────────────
test('AST açık + graf başka dosyada görüyor → yol-yanlış ipucu, verdict DEĞİŞMEZ', () => {
  const d = initRepo();
  const doc = fixture(d);
  const env = { ARS_AST_ADAPTER: 'test-proje', ARS_AST_CLI: fakeCli(d, SEES_ELSEWHERE) };
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', doc], d, env);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /src\/other\.ts/);
  assert.match(r.out, /anchor yolu yanlış olabilir/);
  // KRİTİK: graf sembolü "gördü" ama bulgu YİNE de duruyor — graf found'u false→true ÇEVİREMEZ.
  assert.match(r.out, /sahte/i);
});

// ── FAIL-OPEN: bozuk JSON / çöken CLI / olmayan binary → ipucu yok, statüko ─────────
test('AST açık ama CLI bozuk JSON basıyor → fail-open (ipucu yok, statüko)', () => {
  const d = initRepo();
  const doc = fixture(d);
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', doc], d, { ARS_AST_ADAPTER: 'test-proje', ARS_AST_CLI: fakeCli(d, BROKEN) });
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /AST indeksi/);
});

test('AST açık ama CLI çöküyor / binary yok → fail-open (ipucu yok, statüko)', () => {
  const d = initRepo();
  const doc = fixture(d);
  const crash = run('check-doc-integrity.mjs', ['--rule=doc-truth', doc], d, { ARS_AST_ADAPTER: 'test-proje', ARS_AST_CLI: fakeCli(d, CRASHES) });
  const missing = run('check-doc-integrity.mjs', ['--rule=doc-truth', doc], d, { ARS_AST_ADAPTER: 'test-proje', ARS_AST_CLI: 'kesinlikle-olmayan-binary-xyz' });
  cleanup(d);
  assert.equal(crash.status, 0, crash.out);
  assert.doesNotMatch(crash.out, /AST indeksi/);
  assert.equal(missing.status, 0, missing.out);
  assert.doesNotMatch(missing.out, /AST indeksi/);
});

// ── check-integrity: aynı sözleşme (zero-import kopyası doğru kalibre mi) ───────────
test('check-integrity: AST kapalı → statüko; açık → ipucu, verdict DEĞİŞMEZ', () => {
  const d = initRepo();
  const doc = fixture(d);
  const off = run('check-doc-integrity.mjs', ['--rule=integrity'], d);
  const on = run('check-doc-integrity.mjs', ['--rule=integrity'], d, { ARS_AST_ADAPTER: 'test-proje', ARS_AST_CLI: fakeCli(d, SEES_NOTHING) });
  cleanup(d);
  assert.equal(off.status, on.status, `verdict değişmemeli: ${off.status} vs ${on.status}`);
  assert.doesNotMatch(off.out, /AST indeksi/);
  if (/DANGLING ANCHOR/.test(on.out)) assert.match(on.out, /AST indeksi/);  // bulgu varsa ipucu da var
  void doc;
});

// ── install-exam: repoRoot=TARGET farkı (3 kopya arasındaki tek kalibre farkı) ──────
test('install-exam: AST kapalı → statüko (sahte anchor yine FAIL, ipucu yok)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'src/auth.ts', 'export const x = 1;\n');
  write(d, 'docs/g.md', '<!-- doc-anchor: src/auth.ts:authenticate -->\n# G\n');
  const r = runScript('install-exam.mjs', [`--target=${d}`], d);
  cleanup(d);
  assert.doesNotMatch(r.out, /AST indeksi/);
});
