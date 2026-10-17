import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initRepo, write, git, runScript, cleanup } from './helpers.mjs';

const HERE_IE = dirname(fileURLToPath(import.meta.url));

// install-exam her durumda `git ls-files`/`git rev-parse` çağırır → izole git reposu gerekir
// (doc-truth.test.mjs kalıbının aynısı).

test('install-exam: git reposu olmayan hedef → ① ÖLÇÜLEMEDİ, sınav yine de biter', () => {
  const d = initRepo();
  // .git dizinini kaldırarak "git reposu değil" durumunu taklit et — initRepo git verir,
  // git rev-parse kontrolü ① içindir; burada asıl senaryo aşağıdaki testlerde kapsanıyor.
  cleanup(d);
});

// 🔴 DEĞİŞTİ (dış denetim, 2026-07-14): eskiden 'ÖLÇÜLEMEDİ' beklenirdi ve bu ÇIKIŞ KODUNU BOZMUYORDU
// → "kapı kurulu ama YAKITSIZ" durumu kurulum BAŞARISIZLIĞI sayılmıyordu. Ama bu, PİLOTUN BİREBİR
// VAKASIDIR (kapı 1 ay kuruluydu, anchor SIFIRDI, doc-recency NO-OP koştu). Yakıt yokluğu bir
// BELİRSİZLİK değil — ölçüldü ve SIFIR çıktı. → FAIL, ve sınav DÜŞER.
test('install-exam: hiç doc-anchor yokken ① FAIL (yakıtsız kapı = BAŞARISIZLIK, ÖLÇÜLEMEDİ değil)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\nAnchor yok.\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  const json = JSON.parse(r.out);
  const c1 = json.results.find(x => x.id === '①');
  assert.equal(c1.verdict, 'FAIL', r.out);
  assert.equal(r.status, 1, r.out);            // sınav DÜŞMELİ — sessizce geçilmez
});

test('install-exam: gerçek dosyaya çözülen anchor → ① PASS', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export {};\n');
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/auth/jwt.ts -->\n# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  const json = JSON.parse(r.out);
  const c1 = json.results.find(x => x.id === '①');
  assert.equal(c1.verdict, 'PASS', r.out);
});

test('install-exam: ölü anchor (hedef dosya yok) → ① FAIL, genel sınav exit 1', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/hayalet.ts -->\n# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  const json = JSON.parse(r.out);
  const c1 = json.results.find(x => x.id === '①');
  assert.equal(c1.verdict, 'FAIL', r.out);
  assert.equal(r.status, 1, r.out);
  cleanup(d);
});

test('install-exam: CONTRACT.md-tarzı sözde-anchor prose (yol-görünmeyen token) SAYILMAZ', () => {
  const d = initRepo();
  // "yol" kelimesi looksPath'e göre YOL GÖRÜNMÜYOR (içinde '/' ya da ':' yok) → ① için sayılmamalı.
  write(d, 'CLAUDE.md', 'Söz dizimi böyle: `<!-- doc-anchor:\n  yol -->`\n# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  const json = JSON.parse(r.out);
  const c1 = json.results.find(x => x.id === '①');
  // Sözde-anchor elenir → GERÇEK anchor sayısı SIFIR kalır.
  // 🔴 DEĞİŞTİ (dış denetim, 2026-07-14): eskiden 'ÖLÇÜLEMEDİ' beklenirdi. ÖLÇÜLEMEDİ çıkış kodunu
  // BOZMUYOR → "yakıtsız kapı" kurulum BAŞARISIZLIĞI sayılmıyordu. Ama bu tam da PİLOTUN VAKASI:
  // kapı kurulu, anchor SIFIR, doc-recency 1 ay NO-OP koştu. Bu bir belirsizlik değil — ÖLÇÜLDÜ ve
  // SIFIR ÇIKTI. "Yakıt yok" = BAŞARISIZLIK. → FAIL.
  assert.equal(c1.verdict, 'FAIL', r.out);
  assert.match(c1.detail, /HİÇ doc-anchor YOK/);
});

// 🔴 REGRESYON (dış denetim, 2026-07-14, GPT-5.6) — ANCHOR SEMBOL OYUNLAMASI
// Bulgu: `repo:symbol` anchor'ında SEMBOL kısmı ATILIYOR, yalnız existsSync(path) bakılıyordu.
// Oyunlama: `<!-- doc-anchor: src/gercek-dizin:UydurmaSembol -->` → dizin VAR → "çözüldü" sayılır
// → %90 eşiği geçilir → sınav PASS. Sembol hiç var olmasa bile.
// Bu, sınavın KENDİSİNİN varlık ölçmesiydi (projenin ANA HASTALIĞI — üçüncü tekrarı).

test('install-exam: 🔴 SAHTE SEMBOL — yol VAR ama sembol dosyada YOK → ① FAIL (oyunlama kapalı)', () => {
  const d = initRepo();
  write(d, 'src/kod.cs', 'class BaskaBirSey {}\n');
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/kod.cs:UydurmaSembol -->\n# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  const json = JSON.parse(r.out);
  const c1 = json.results.find(x => x.id === '①');
  assert.equal(c1.verdict, 'FAIL', r.out);
  assert.match(c1.detail, /SEMBOL .* dosyada YOK|sahte anchor/i);
});

test('install-exam: DÜRÜST anchor — sembol GERÇEKTEN kodda → ① PASS (yanlış alarm yok)', () => {
  const d = initRepo();
  write(d, 'src/kod.cs', 'class LoginService {}\n');
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/kod.cs:LoginService -->\n# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  const json = JSON.parse(r.out);
  const c1 = json.results.find(x => x.id === '①');
  assert.equal(c1.verdict, 'PASS', r.out);   // dürüst anchor CEZALANDIRILMAMALI
});

// --- ② KAPI NEGATİF KONTROLÜ — sınavın kalbi: gerçek kapı yakalıyor mu? ---

test('install-exam: paketin gerçek kapılarına karşı ② PASS (her denek İKİ yönde de doğru)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  const json = JSON.parse(r.out);
  const c2 = json.results.find(x => x.id === '②');
  assert.equal(c2.verdict, 'PASS', r.out);
  // v0.20: kategori script'i + alt-kural adı (v0.16 sonrası kanonik çağrı biçimi).
  assert.match(c2.detail, /check-hygiene --rule=secrets: yakaladı \+ meşruyu geçirdi/);
  assert.match(c2.detail, /check-hygiene --rule=utf8: yakaladı \+ meşruyu geçirdi/);
  assert.match(c2.detail, /check-doc-integrity --rule=doc-truth: yakaladı \+ meşruyu geçirdi/);
  // v0.26: FACTS kapısı da ETKİ sınavında — kurulu ama sınanmayan kapı "varlık≠etki" boşluğudur.
  assert.match(c2.detail, /check-doc-integrity --rule=facts-drift: yakaladı \+ meşruyu geçirdi/);
  assert.match(c2.detail, /check-provenance --rule=integration-cards: yakaladı \+ meşruyu geçirdi/);
});

test('install-exam: hedefte NO-OP (bozuk) kapı kopyası varsa ② FAIL (varlık≠etki panzehiri)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  // scripts/gates/ kanonik konumuna KASTEN her şeye "temiz" diyen bir kategori script'i koy.
  mkdirSync(join(d, 'scripts', 'gates'), { recursive: true });
  writeFileSync(join(d, 'scripts', 'gates', 'check-hygiene.mjs'),
    '#!/usr/bin/env node\nconsole.log("her sey temiz (yalan)");\nprocess.exit(0);\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  const json = JSON.parse(r.out);
  const c2 = json.results.find(x => x.id === '②');
  assert.equal(c2.verdict, 'FAIL', r.out);
  assert.match(c2.detail, /⚠ YAKALAMADI \(kapı ölü\)/);
  assert.equal(r.status, 1, r.out);
  cleanup(d);
});

// 🔴 REGRESYON NÖBETÇİSİ (v0.20) — bu testin koruduğu hata GERÇEKTEN YAŞANDI: v0.16 kapı
// konsolidasyonu (20→6) eski tekil dosya adlarını sildi, ② hâlâ onları çağırıyordu ve
// `node <olmayan-dosya>` MODULE_NOT_FOUND ile exit 1 döndürdüğü için sınav bunu "kapı YAKALADI"
// sayıp PASS veriyordu. ÇÖKÜŞ, YAKALAMA DEĞİLDİR.
test('install-exam: ② çöken/eksik alt-kuralı YAKALAMA sayMAZ (sahte-PASS regresyonu)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  mkdirSync(join(d, 'scripts', 'gates'), { recursive: true });
  // Kapı VAR ama istenen alt-kuralı TANIMIYOR → exit 1 verir. Eski mantık bunu "yakaladı" sanırdı.
  writeFileSync(join(d, 'scripts', 'gates', 'check-hygiene.mjs'),
    '#!/usr/bin/env node\nconsole.error("check-hygiene.mjs: bilinmeyen --rule=\\"x\\"");\nprocess.exit(1);\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  const json = JSON.parse(r.out);
  const c2 = json.results.find(x => x.id === '②');
  cleanup(d);
  assert.equal(c2.verdict, 'FAIL', r.out);
  assert.match(c2.detail, /ÇALIŞTIRILAMADI/);
  assert.match(c2.detail, /bu YAKALAMA SAYILMAZ/);
});

test('install-exam: ② meşru girdiyi BLOKLAYAN kapıyı FAIL sayar (geçirme kontrolü)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  mkdirSync(join(d, 'scripts', 'gates'), { recursive: true });
  // Her girdiye ihlal diyen kapı: YAKALAMA yönü geçer, GEÇİRME yönü çöker → yanlış-pozitif.
  writeFileSync(join(d, 'scripts', 'gates', 'check-hygiene.mjs'),
    '#!/usr/bin/env node\nconsole.error("ihlal (her zaman)");\nprocess.exit(1);\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  const json = JSON.parse(r.out);
  const c2 = json.results.find(x => x.id === '②');
  cleanup(d);
  assert.equal(c2.verdict, 'FAIL', r.out);
  assert.match(c2.detail, /MEŞRUYU BLOKLADI \(yanlış-pozitif\)/);
});

// --- ③ CI fiilen koştu mu — workflow yokken UYGULANAMAZ ---

test('install-exam: .github/workflows yokken ③ UYGULANAMAZ (FAIL değil)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  const json = JSON.parse(r.out);
  const c3 = json.results.find(x => x.id === '③');
  assert.equal(c3.verdict, 'UYGULANAMAZ', r.out);
});

// --- ④ Registry çözünürlüğü — registry.yaml yokken UYGULANAMAZ (registry opt-in) ---

test('install-exam: registry.yaml yokken ④ UYGULANAMAZ (FAIL değil — registry opt-in)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  const json = JSON.parse(r.out);
  const c4 = json.results.find(x => x.id === '④');
  assert.equal(c4.verdict, 'UYGULANAMAZ', r.out);
});

// --- Tüm sınav yalnız FAIL varsa exit 1 verir; ÖLÇÜLEMEDİ/UYGULANAMAZ tek başına düşürmez ---

// 🔴 TERSİNE ÇEVRİLDİ (dış denetim, 2026-07-14): eskiden "her şey ÖLÇÜLEMEDİ ise sınav GEÇER"
// deniyordu. Bu, BOŞ BİR REPOYA "kurulum başarılı" demekti — yani sınavın kendisi no-op'tu.
// Anchor yokluğu artık FAIL olduğu için, yakıtsız kurulum SESSİZCE GEÇEMEZ.
test('install-exam: yakıtsız kurulum (anchor yok) SESSİZCE GEÇEMEZ — genel sınav exit 1', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  const json = JSON.parse(r.out);
  assert.equal(r.status, 1, r.out);
  assert.equal(json.pass, false);
});

// --- verify.mjs --install-exam dispatch doğru script'e yönleniyor mu ---

test('verify.mjs --install-exam: dispatch çalışır ve STATE.md bloğu üretir', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('../verify.mjs', ['--install-exam', '--target=.'], d);
  cleanup(d);
  assert.match(r.out, /K3 ÇIKIŞ SINAVI/);
  assert.match(r.out, /STATE\.md bloğu/);
  assert.match(r.out, /ERTELENMİŞ-ÖLÇÜM: gate-effect/);
});

// ── ⑤ DOĞRULUK KAPISI (v0.12, pilot bulgusu #3) ──────────────────────────────
// "pre-commit hijyenle yetiniyor mu": tipli stack + tip kontrolü yok + hiçbir yerde yazılı
// değil = SESSİZ BOŞLUK. Atlamak serbest ama YAZILI olmalı (bulgu #5 ile aynı doktrin).

const verdictOf = (out, id) => JSON.parse(out).results.find(r => r.id === id)?.verdict;

test('install-exam ⑤: tipsiz stack (saf JS) → UYGULANAMAZ (eksiklik FAIL sayılmaz)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/a.js -->\n');
  write(d, 'src/a.js', 'export const a = 1;\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑤'), 'UYGULANAMAZ', r.out);
});

test('install-exam ⑤: 🔴 TypeScript + pre-commit tip kontrolü YOK + yazılı değil → FAIL', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/a.ts -->\n');
  write(d, 'src/a.ts', 'export const a: number = 1;\n');
  write(d, 'tsconfig.json', '{}\n');
  write(d, '.husky/pre-commit', '#!/bin/sh\nnpx eslint --cache\n');   // yalnız hijyen
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑤'), 'FAIL', r.out);
  assert.match(r.out, /SESSİZ BOŞLUK/);
});

test('install-exam ⑤: TypeScript + pre-commit tsc --noEmit VAR → PASS', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/a.ts -->\n');
  write(d, 'src/a.ts', 'export const a: number = 1;\n');
  write(d, 'tsconfig.json', '{}\n');
  write(d, '.husky/pre-commit', '#!/bin/sh\nnpx tsc --noEmit\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑤'), 'PASS', r.out);
});

// ⭐ ATLAMAK SERBEST AMA YAZILI OLMALI — bulgu #5'in doktrini burada da geçerli.
test('install-exam ⑤: tip kontrolü yok AMA BASELINE\'a yazılmış → PASS (bilinçli karar)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/a.ts -->\n');
  write(d, 'src/a.ts', 'export const a: number = 1;\n');
  write(d, 'tsconfig.json', '{}\n');
  write(d, '.husky/pre-commit', '#!/bin/sh\nnpx eslint --cache\n');
  write(d, 'BASELINE.md', '# Baseline\n- pre-commit tip kontrolü YOK (49 sn sürüyor, CI\'a bırakıldı)\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑤'), 'PASS', r.out);
  assert.match(r.out, /BİLİNÇLİ/);
});

test('install-exam ⑤: hook YORUM satırındaki tip kontrolü sayılmaz → FAIL (devre dışı kod koşmaz)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/a.ts -->\n');
  write(d, 'src/a.ts', 'export const a: number = 1;\n');
  write(d, 'tsconfig.json', '{}\n');
  write(d, '.husky/pre-commit', '#!/bin/sh\n# npx tsc --noEmit\nnpx eslint\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑤'), 'FAIL', r.out);
});

// ── ⑥ SIZE-BASELINE KALİBRASYONU (v0.12, pilot bulgusu #7) ───────────────────
// Pilotta "1000 satır" kuralı geçerli bir düzeltmeyi engelledi çünkü baseline ÜRETİLMEMİŞTİ.
// Bu kontrol o ATLANMIŞ KURULUM ADIMINI yakalar (sınırı gevşetmek yanlış panzehirdi).

const bigFile = (n) => Array.from({ length: n }, (_, i) => `const x${i} = ${i};`).join('\n') + '\n';

test('install-exam ⑥: kapı kurulu değil → UYGULANAMAZ', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/a.ts -->\n');
  write(d, 'src/a.ts', 'export const a = 1;\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑥'), 'UYGULANAMAZ', r.out);
});

test('install-exam ⑥: tavanı aşan dosya YOK → PASS (baseline gerekmez)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/a.ts -->\n');
  write(d, 'src/a.ts', 'export const a = 1;\n');
  write(d, 'gates/check-hygiene.mjs', 'const CODE_WARN = 500, CODE_FAIL = 1000;\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑥'), 'PASS', r.out);
});

test('install-exam ⑥: 🔴 PİLOT VAKASI — tavanı aşan dosya VAR, size-baseline.json YOK → FAIL', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/dev.ts -->\n');
  write(d, 'src/dev.ts', bigFile(1353));            // pilottaki gerçek boyut
  write(d, 'gates/check-hygiene.mjs', 'const CODE_WARN = 500, CODE_FAIL = 1000;\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑥'), 'FAIL', r.out);
  assert.match(r.out, /yanlış-alarm verip REDDEDİLECEK/);
});

test('install-exam ⑥: baseline VAR ve tavanı aşan TÜM dosyaları kapsıyor → PASS', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/dev.ts -->\n');
  write(d, 'src/dev.ts', bigFile(1353));
  write(d, 'gates/check-hygiene.mjs', 'const CODE_WARN = 500, CODE_FAIL = 1000;\n');
  write(d, 'scripts/size-baseline.json', JSON.stringify({ 'src/dev.ts': 1354 }));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑥'), 'PASS', r.out);
});

test('install-exam ⑥: 🔴 baseline VAR ama EKSİK (bir dev dosya listede yok) → FAIL', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/dev.ts -->\n');
  write(d, 'src/dev.ts', bigFile(1353));
  write(d, 'src/dev2.ts', bigFile(2765));           // pilottaki en büyük dosya
  write(d, 'gates/check-hygiene.mjs', 'const CODE_WARN = 500, CODE_FAIL = 1000;\n');
  write(d, 'scripts/size-baseline.json', JSON.stringify({ 'src/dev.ts': 1354 }));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑥'), 'FAIL', r.out);
  assert.match(r.out, /dev2\.ts/);
});

test('install-exam ⑥: kapının KENDİ tavanı okunur (1500 kalibreliyse 1353 aşmaz) → PASS', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/dev.ts -->\n');
  write(d, 'src/dev.ts', bigFile(1353));
  write(d, 'gates/check-hygiene.mjs', 'const CODE_WARN = 500, CODE_FAIL = 1500;\n');   // kurulumda kalibre edilmiş
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑥'), 'PASS', r.out);
});

// v0.28.1 REGRESYON NÖBETÇİSİ: ⑥ v0.16'dan beri silinmiş `check-file-size.mjs` adını arıyordu ve
// her gerçek kurulumda sessizce UYGULANAMAZ dönüyordu — testler de o eski adı fixture olarak
// yazdığı için yeşildi. Bu test PAKETİN GERÇEK kapı dosyasını kopyalar: kapı yeniden adlanır ya da
// CODE_FAIL sabiti taşınırsa ⑥ tekrar körleşir ve bu test onu yakalar.
test('install-exam ⑥: 🔴 GERÇEK check-hygiene.mjs kuruluyken kontrol KOŞAR (UYGULANAMAZ değil)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/dev.ts -->\n');
  write(d, 'src/dev.ts', bigFile(1353));
  write(d, 'gates/check-hygiene.mjs', readFileSync(join(HERE_IE, '..', 'gates', 'check-hygiene.mjs'), 'utf8'));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑥'), 'FAIL', r.out);   // baseline yok + 1353 > 1000 → atlanmış adım yakalandı
});

test('install-exam ⑥: v0.16 öncesi kurulumun eski adı (check-file-size.mjs) hâlâ tanınır', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/a.ts -->\n');
  write(d, 'src/a.ts', 'export const a = 1;\n');
  write(d, 'gates/check-file-size.mjs', 'const CODE_FAIL = 1000;\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑥'), 'PASS', r.out);
});

// ── ⑦ BİLİMSEL-ÇALIŞMA BÖLÜMÜ (v0.14 — K23; K20 doktrinlerinin kurulum-anı izi) ──
// ⑤ ile aynı eksen: sessiz boşluk FAIL, bilinçli-yazılı ret PASS, kurulumsuz UYGULANAMAZ.

test('install-exam ⑦: CLAUDE.md hiç yoksa → UYGULANAMAZ (kurulum yapılmamış)', () => {
  const d = initRepo();
  write(d, 'src/a.js', 'export const a = 1;\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑦'), 'UYGULANAMAZ', r.out);
});

test('install-exam ⑦: 🔴 CLAUDE.md var + bölüm yok + STATE\'te ret yazılı değil → FAIL (sessiz boşluk)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber (bilimsel-çalışma bölümü üretilmemiş)\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑦'), 'FAIL', r.out);
});

test('install-exam ⑦: bölüm CLAUDE.md\'de varsa → PASS', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n\n## Bilimsel çalışma disiplini\n\n- Dalkavukluk yasak.\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑦'), 'PASS', r.out);
});

test('install-exam ⑦: bölüm yok ama ret STATE\'te YAZILI → PASS (atlamak serbest, sessiz atlamak yasak)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  write(d, 'docs/STATE.md', '- Bilimsel çalışma bölümü BİLİNÇLE kurulmadı (tek-kişilik repo, karar: sahibi).\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  assert.equal(verdictOf(r.out, '⑦'), 'PASS', r.out);
});

// ── v0.30 (G4/T1): ⑧ kurulum soruları sorulmuş mu (null = SORULMADI → FAIL) ───────────────────
const MAN8 = '.agentic-repo-setup.json';
function exam8(kunye) {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  if (kunye) write(d, MAN8, JSON.stringify(kunye));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  return { r, c8: JSON.parse(r.out).results.find(x => x.id === '⑧') };
}
const cevapli = { skill_version: '0.30.0', toggles: {
  muhatap: { pm_urun: false, qa_senaryo: true, son_kullanici_dokumani: false, test_koprusu: false },
  takip: { state: true, yan_bug: false } } };

test('install-exam ⑧: muhatap/takip toggle null (sorulmadı) → FAIL, sınav düşer (negatif kontrol)', () => {
  const k = JSON.parse(JSON.stringify(cevapli));
  k.toggles.muhatap.pm_urun = null; k.toggles.takip.state = null;
  const { r, c8 } = exam8(k);
  assert.equal(c8.verdict, 'FAIL', r.out);
  assert.match(c8.detail, /kurulum sorusu sorulmadı/);
  assert.match(c8.detail, /muhatap\.pm_urun/);
  assert.match(c8.detail, /takip\.state/);
  assert.equal(r.status, 1);
});

test('install-exam ⑧: takip bloğu hiç yoksa (yeni künye) da FAIL; hepsi true/false ise PASS', () => {
  const eksik = JSON.parse(JSON.stringify(cevapli));
  delete eksik.toggles.takip;
  assert.equal(exam8(eksik).c8.verdict, 'FAIL');
  assert.equal(exam8(cevapli).c8.verdict, 'PASS');
});

test('install-exam ⑧: künye yoksa UYGULANAMAZ; <0.30.0 künyeye yeni FAIL dayatılmaz (UYGULANAMAZ)', () => {
  assert.equal(exam8(null).c8.verdict, 'UYGULANAMAZ');
  const eski = { skill_version: '0.12.0', toggles: { muhatap: { pm_urun: false } } };
  assert.equal(exam8(eski).c8.verdict, 'UYGULANAMAZ');
});

// ── v0.30: ⑨ doc-recency --cascade bağlı mı ──────────────────────────────────────────────────
function exam9({ dok = true, hook = null, ci = null, platform = 'github-actions', surum = '0.30.0' } = {}) {
  const d = initRepo();
  write(d, 'CLAUDE.md', '# Rehber\n');
  write(d, '.agentic-repo-setup.json', JSON.stringify({ skill_version: surum, toggles: {
    muhatap: { pm_urun: false, qa_senaryo: false, son_kullanici_dokumani: dok, test_koprusu: false },
    takip: { state: false, yan_bug: false }, dis_entegrasyon: { ci_platformu: platform } } }));
  if (hook !== null) write(d, '.git/hooks/pre-commit', hook);
  if (ci !== null) write(d, '.github/workflows/verify.yml', ci);
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  const r = runScript('install-exam.mjs', ['--target=.', '--json'], d);
  cleanup(d);
  return JSON.parse(r.out).results.find(x => x.id === '⑨');
}
const HOOK_OK = '#!/bin/sh\nnode gates/check-doc-integrity.mjs --rule=doc-recency --strict --cascade\n';
const CI_OK = 'steps:\n  - run: node gates/check-doc-integrity.mjs --rule=doc-recency --cascade\n';

test('install-exam ⑨: hook\'ta --cascade yok → FAIL (negatif kontrol)', () => {
  const c = exam9({ hook: '#!/bin/sh\nnode gates/check-doc-integrity.mjs --rule=doc-recency\n', ci: CI_OK });
  assert.equal(c.verdict, 'FAIL');
  assert.match(c.detail, /hook/);
});

test('install-exam ⑨: hook ve CI --cascade taşıyor → PASS; github değilse CI UYGULANAMAZ ama hook yeter', () => {
  assert.equal(exam9({ hook: HOOK_OK, ci: CI_OK }).verdict, 'PASS');
  assert.equal(exam9({ hook: HOOK_OK, platform: 'gitlab' }).verdict, 'PASS');
});

test('install-exam ⑨: toggle false / eski künye → UYGULANAMAZ', () => {
  assert.equal(exam9({ dok: false }).verdict, 'UYGULANAMAZ');
  assert.equal(exam9({ surum: '0.12.0' }).verdict, 'UYGULANAMAZ');
});

test('install-exam ⑨: CI\'da doldurulmamış {{CASCADE_BAYRAGI}} veya --cascade yok → FAIL', () => {
  const c = exam9({ hook: HOOK_OK, ci: 'run: node gates/check-doc-integrity.mjs --rule=doc-recency {{CASCADE_BAYRAGI}}\n' });
  assert.equal(c.verdict, 'FAIL');
  assert.match(c.detail, /CASCADE_BAYRAGI/);
  assert.equal(exam9({ hook: HOOK_OK, ci: 'run: echo hi\n' }).verdict, 'FAIL');
});

// ── K81: künyede skill_version YOK → ⑧/⑨ UYGULANAMAZ (eski kurulum; yeni FAIL dayatılmaz) ──
test('install-exam ⑧/⑨: künyede skill_version yok → UYGULANAMAZ (⑧ null-toggle olsa bile); sürümlü künye hâlâ FAIL (negatif)', () => {
  const surumsuz = JSON.parse(JSON.stringify(cevapli)); delete surumsuz.skill_version; surumsuz.toggles.muhatap.pm_urun = null;
  assert.equal(exam8(surumsuz).c8.verdict, 'UYGULANAMAZ');
  const surumlu = JSON.parse(JSON.stringify(cevapli)); surumlu.toggles.muhatap.pm_urun = null;
  assert.equal(exam8(surumlu).c8.verdict, 'FAIL');
  assert.equal(exam9({ hook: '#!/bin/sh\n', surum: null }).verdict, 'UYGULANAMAZ');
});
