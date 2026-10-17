// health-check.mjs testleri (v0.11) — "kapıların testi olur" disiplini scripts/'e de uygulanır.
// health-check kendi ROOT'unu kendi dosya konumundan türetir (dirname(import.meta.url) + '..'),
// git ls-files'a göre DEĞİL — bu yüzden install-exam.test.mjs deseninin aksine `runScript` (paketin
// KENDİ scripts/ dizinini koşan) burada işe yaramaz: gerçek script'i geçici fixture reposuna karşı
// koşarsak ROOT hep GERÇEK paket köküne çözülür. Çözüm: health-check.mjs KAYNAĞINI her testte
// geçici reponun `scripts/health-check.mjs`'ine KOPYALA, öyle koştur — ROOT o zaman fixture'a çözülür.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initRepo, write, git, cleanup } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HEALTH_SRC = readFileSync(join(HERE, '..', 'scripts', 'health-check.mjs'), 'utf8');
// Kurulu-skill kontrolü (v0.30.1) gerçek ~/.claude/skills'e bakmasın: fixture'lar makinedeki
// kurulumdan bağımsız olmalı. Var olmayan dizin = kontrol sessiz.
process.env.AGENTIC_SKILL_DIR = join(HERE, '__kurulu-skill-yok__');

// Geçici git reposuna health-check.mjs'i kopyala + minimal "temiz" iskeleti (gates/templates/tests/
// README/SKILL/package.json/karar-defteri) yaz. Her alan bağımsız override edilebilir — tek bir
// alanı bozup diğerlerini temiz bırakmak, test edilen uyarı kodunu İZOLE eder.
function setupRepo(d, {
  pkgVersion = '1.2.3',
  skillVersion = '1.2.3',
  kapiClaim = 2,
  testClaim = 2,
  sablonClaim = 2,
  karar = true,
  extraDirs = [],
  bundleVersion = null,
} = {}) {
  write(d, 'scripts/health-check.mjs', HEALTH_SRC);
  write(d, 'package.json', JSON.stringify({ version: pkgVersion, scripts: {} }));
  write(d, 'SKILL.md', `# Fixture Skill (v${skillVersion})\n\nİçerik.\n`);
  write(d, 'gates/check-a.mjs', '// gate a\n');
  write(d, 'gates/check-b.mjs', '// gate b\n');
  write(d, 'templates/a.template.md', '# şablon a\n');
  write(d, 'templates/b.template.yaml', 'key: val\n');
  write(d, 'tests/sample.test.mjs',
    "import { test } from 'node:test';\ntest('a', () => {});\ntest('b', () => {});\n");
  write(d, 'README.md',
    `# Fixture Paketi\n\n> **Güncel envanter (v1.2):** ${kapiClaim} kapı (\`gates/\`) · ` +
    `${testClaim} birim testi (\`node --test\`) · ${sablonClaim} şablon (\`templates/\`).\n`);
  if (karar) write(d, 'v1.2-KARAR-DEFTERI.md', '# Karar Defteri\n\nKarar var.\n');
  if (bundleVersion) write(d, `public/agentic-repo-setup-v${bundleVersion}.skill`, 'sahte-bundle\n');
  for (const dir of extraDirs) mkdirSync(join(d, dir), { recursive: true });
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
}

function runHealthCheck(d, args = []) {
  const r = spawnSync(process.execPath, [join(d, 'scripts', 'health-check.mjs'), ...args],
    { cwd: d, encoding: 'utf8' });
  return { status: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}

test('health-check: temiz kurgu (sayılar+sürümler tutarlı, karar defteri var) → 0 uyarı, exit 0', () => {
  const d = initRepo();
  setupRepo(d);
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  const json = JSON.parse(r.out);
  assert.equal(json.ok, true, r.out);
  assert.equal(json.findings.filter(f => f.level === 'UYARI').length, 0, r.out);
});

test('health-check: README kapı sayısı gerçek gates/ ile uyuşmazsa → kapı-drifti uyarısı (bloke etmez)', () => {
  const d = initRepo();
  setupRepo(d, { kapiClaim: 9 });
  const r = runHealthCheck(d);
  cleanup(d);
  assert.equal(r.status, 0, r.out); // varsayılan: bahçıvan uyarısı, bloke etmez
  assert.match(r.out, /UYARI/);
  assert.match(r.out, /kapı-drifti/);
});

test('health-check: package.json sürümü ≠ SKILL.md başlığı → surum-uyumsuz uyarısı', () => {
  const d = initRepo();
  setupRepo(d, { skillVersion: '9.9.9' });
  const r = runHealthCheck(d);
  cleanup(d);
  assert.match(r.out, /surum-uyumsuz/);
});

test('health-check: public/ bundle sürümü kaynaktan farklıysa → bundle-bayat uyarısı', () => {
  const d = initRepo();
  setupRepo(d, { bundleVersion: '0.1.0' }); // pkgVersion varsayılan 1.2.3 ile çakışmıyor
  const r = runHealthCheck(d);
  cleanup(d);
  assert.match(r.out, /bundle-bayat/);
});

test('health-check: boş dizin (fs\'te var, git izlemez) → bos-dizin uyarısı', () => {
  const d = initRepo();
  setupRepo(d, { extraDirs: ['bos-klasor'] });
  const r = runHealthCheck(d);
  cleanup(d);
  assert.match(r.out, /bos-dizin/);
  assert.match(r.out, /bos-klasor/);
});

test('health-check: aktif sürüm için kökte v<major>.<minor>-KARAR-DEFTERI.md yoksa → karar-defteri-yok uyarısı (D-B)', () => {
  const d = initRepo();
  setupRepo(d, { karar: false });
  const r = runHealthCheck(d);
  cleanup(d);
  assert.match(r.out, /karar-defteri-yok/);
});

test('health-check: --strict, UYARI varken exit 1 (release kapısı)', () => {
  const d = initRepo();
  setupRepo(d, { kapiClaim: 9 });
  const r = runHealthCheck(d, ['--strict']);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('health-check: --strict, uyarı YOKKEN exit 0 (temiz repo strict modunu da geçer)', () => {
  const d = initRepo();
  setupRepo(d);
  const r = runHealthCheck(d, ['--strict']);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('health-check: --strict, YALNIZCA hijyen uyarısı (boş dizin) varsa exit 0 — release\'i bloke ETMEZ', () => {
  const d = initRepo();
  setupRepo(d);                                  // temiz kurgu (release-kritik bulgu yok)
  mkdirSync(join(d, 'bos-klasor'), { recursive: true });   // yalnız hijyen: boş dizin
  const r = runHealthCheck(d, ['--strict']);
  cleanup(d);
  assert.match(r.out, /bos-dizin/, r.out);        // uyarı GÖRÜNÜR
  assert.equal(r.status, 0, r.out);               // ama release'i BLOKE ETMEZ (yerel kalıntı)
});

// ── SB-15 düzeltmesi: test sayımı artık test-count-baseline.json'dan (kesin), grep'ten (tahmini) DEĞİL ──
// Kök neden: parametrize (tablo) test — `for (...) { test(...) }` — bir literal `test(` çağrısıyla
// N test üretir; grep bunu yapısal olarak göremez (JS parse etmeden döngü-genişlemesi bilinemez).
// Çözüm: health:fix'in ZATEN koştuğu gerçek `node --test` sonucunu diske yaz, check GREP yerine
// onu oku — fix ile check aynı kaynağa bağlandı (asıl kusur farklı kaynaklardan okumalarıydı).
test('health-check: test-count-baseline.json VARSA ve README ile eşleşiyorsa → test-drifti YOK (tam eşleşme, grep\'e bakılmaz)', () => {
  const d = initRepo();
  // grep gerçek sayımı 2 verir (sample.test.mjs: 2 test), ama baseline 7 diyor VE README 7 diyor.
  // Grep hâlâ eski davranışıyla çalışsaydı (±2 tolerans, gerçek=2) bu ikisi zaten örtüşürdü —
  // o yüzden ayırt edici deney BİR SONRAKİ test: baseline README'den ayrışınca TAM eşleşme ister.
  setupRepo(d, { testClaim: 7 });
  write(d, 'scripts/test-count-baseline.json', JSON.stringify({ pass: 7 }));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'baseline ekle');
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  const json = JSON.parse(r.out);
  assert.ok(!json.findings.some(f => f.kod === 'test-drifti'), r.out);
});

test('health-check: test-count-baseline.json VARSA ve README ile 1 bile FARKLIYSA → test-drifti (TAM eşleşme, tolerans YOK)', () => {
  const d = initRepo();
  // grep'in eski ±2 toleransı bu farkı (1) YUTARDI — baseline kesin kaynak olduğu için artık yutmaz.
  setupRepo(d, { testClaim: 8 });
  write(d, 'scripts/test-count-baseline.json', JSON.stringify({ pass: 7 }));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'baseline ekle');
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  const json = JSON.parse(r.out);
  assert.ok(json.findings.some(f => f.kod === 'test-drifti'), r.out);
  assert.equal(json.ok, false, r.out);
});

test('health-check: test-count-baseline.json YOKSA grep tahminine ±2 tolere ile düşer (eski davranış, geriye-uyumlu)', () => {
  const d = initRepo();
  // baseline yok → grep sayımı (2, sample.test.mjs) kullanılır; README de 2 diyor → uyarı yok.
  setupRepo(d, { testClaim: 2 });
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  const json = JSON.parse(r.out);
  assert.ok(!json.findings.some(f => f.kod === 'test-drifti'), r.out);
});

test('health-check: --fix parametrize test içeren repoda GERÇEK koşu sonucunu baseline dosyasına yazar (grep\'i değil)', () => {
  const d = initRepo();
  setupRepo(d, { testClaim: 2 });
  // grep sayımı: sample.test.mjs zaten 2 `test(` çağrısı taşıyor (a, b). Parametrize bir dosya ekle:
  // TEK `test(` çağrısı ama döngü 3 eleman → gerçek koşu 3 test üretir. grep bunu 1 sayar.
  write(d, 'tests/tablo.test.mjs',
    "import { test } from 'node:test';\n" +
    "for (const x of [1, 2, 3]) { test('tablo-' + x, () => {}); }\n");
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'tablo testi ekle');
  const fixOut = spawnSync(process.execPath, [join(d, 'scripts', 'health-check.mjs'), '--fix'],
    { cwd: d, encoding: 'utf8' });
  assert.equal(fixOut.status, 0, fixOut.stdout + fixOut.stderr);
  const baseline = JSON.parse(readFileSync(join(d, 'scripts', 'test-count-baseline.json'), 'utf8'));
  // gerçek koşu: sample.test.mjs (2) + tablo.test.mjs (3, döngü genişlemesi) = 5. grep bulurdu: 2+1=3.
  assert.equal(baseline.pass, 5, JSON.stringify(baseline));
});

// ── SB-19: baseline SNAPSHOT bayatlığı — tests/ değiştikten SONRA --fix koşulmazsa health
// kendi yazdığı eski kopyayla kendini onaylıyordu ("kör onay"). Çözüm: --fix tests/ içeriğinin
// sha1 özetini de baseline'a yazar; check bu özeti GÜNCEL özetle karşılaştırır — uyuşmazsa
// baseline-bayat uyarısı verir (sayı doğru bile olsa "artık ölçülmemiş" bilgisini taşır).
test('health-check: baseline testsHash mevcut tests/ içeriğiyle eşleşmiyorsa → baseline-bayat uyarısı', () => {
  const d = initRepo();
  setupRepo(d, { testClaim: 2 });
  // baseline'ı UYUMLU pass sayısıyla ama YANLIŞ (bayat) testsHash ile yaz — tests/ değişmiş gibi simüle et.
  write(d, 'scripts/test-count-baseline.json', JSON.stringify({ pass: 2, testsHash: 'stale-hash-deadbeef' }));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'bayat baseline');
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  const json = JSON.parse(r.out);
  assert.ok(json.findings.some(f => f.kod === 'baseline-bayat'), r.out);
  assert.equal(json.ok, false, r.out);
});

test('health-check: --fix sonrası testsHash GÜNCEL tests/ içeriğiyle eşleşir → baseline-bayat uyarısı YOK', () => {
  const d = initRepo();
  setupRepo(d, { testClaim: 2 });
  const fixOut = spawnSync(process.execPath, [join(d, 'scripts', 'health-check.mjs'), '--fix'],
    { cwd: d, encoding: 'utf8' });
  assert.equal(fixOut.status, 0, fixOut.stdout + fixOut.stderr);
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  const json = JSON.parse(r.out);
  assert.ok(!json.findings.some(f => f.kod === 'baseline-bayat'), r.out);
});

test('health-check: --fix SONRASI tests/ içeriği değişir (yeni test dosyası) ama --fix TEKRAR koşulmazsa → baseline-bayat uyarısı çıkar (SB-19 kör-onay deneyi)', () => {
  const d = initRepo();
  setupRepo(d, { testClaim: 2 });
  const fix1 = spawnSync(process.execPath, [join(d, 'scripts', 'health-check.mjs'), '--fix'],
    { cwd: d, encoding: 'utf8' });
  assert.equal(fix1.status, 0, fix1.stdout + fix1.stderr);
  // baseline artık taze (pass=2, hash=mevcut tests/). Şimdi tests/ dizinine YENİ bir test dosyası
  // ekle ama --fix'i TEKRAR koşma — tam SB-19'un ölçtüğü senaryo (409→415 iken üç dosya donmuştu).
  write(d, 'tests/yeni.test.mjs',
    "import { test } from 'node:test';\ntest('yeni-1', () => {});\n");
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'yeni test eklendi, fix koşulmadı');
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  const json = JSON.parse(r.out);
  assert.ok(json.findings.some(f => f.kod === 'baseline-bayat'), r.out);
  assert.equal(json.ok, false, r.out);
});

test('health-check: --json geçerli JSON üretir (ok + findings[] şeması)', () => {
  const d = initRepo();
  setupRepo(d, { kapiClaim: 9 });
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  let json;
  assert.doesNotThrow(() => { json = JSON.parse(r.out); }, r.out);
  assert.equal(json.ok, false, r.out);
  assert.ok(Array.isArray(json.findings), r.out);
  assert.ok(json.findings.some(f => f.kod === 'kapı-drifti'), r.out);
});

test('health-check: kurulu skill kaynaktan eski → kurulu-skill-bayat (release-kritik); aynı sürüm → uyarı yok', () => {
  const d = initRepo();
  const skillDir = initRepo();   // yalnız geçici dizin olarak kullanılır
  try {
    setupRepo(d);
    git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'iskelet');
    const kos = (args) => spawnSync(process.execPath, [join(d, 'scripts', 'health-check.mjs'), ...args],
      { cwd: d, encoding: 'utf8', env: { ...process.env, AGENTIC_SKILL_DIR: skillDir } });
    write(skillDir, 'SKILL.md', '# Fixture Skill (v1.0.0)\n');
    const eski = kos(['--strict']);
    assert.match(eski.stdout, /kurulu-skill-bayat/, eski.stdout);
    assert.notEqual(eski.status, 0, 'release-kritik: --strict bloke etmeli\n' + eski.stdout);
    write(skillDir, 'SKILL.md', '# Fixture Skill (v1.2.3)\n');
    const guncel = kos([]);
    assert.doesNotMatch(guncel.stdout, /kurulu-skill-bayat/, guncel.stdout);
  } finally { cleanup(d); cleanup(skillDir); }
});

// SB-27: tests/ özeti EOL-duyarlıydı → checkout/merge sonrası CRLF smudge sahte baseline-bayat üretiyordu.
test('health-check: SB-27 — tests/ içeriği LF vs CRLF aynıysa baseline-bayat YOK (EOL-normalize)', () => {
  const d = initRepo();
  setupRepo(d, { testClaim: 2 });
  const fixOut = spawnSync(process.execPath, [join(d, 'scripts', 'health-check.mjs'), '--fix'],
    { cwd: d, encoding: 'utf8' });
  assert.equal(fixOut.status, 0, fixOut.stdout + fixOut.stderr);
  // Aynı içerik, yalnız EOL farklı (autocrlf smudge benzetimi):
  write(d, 'tests/sample.test.mjs',
    "import { test } from 'node:test';\r\ntest('a', () => {});\r\ntest('b', () => {});\r\n");
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  const json = JSON.parse(r.out);
  assert.ok(!json.findings.some(f => f.kod === 'baseline-bayat'), r.out);
});

test('health-check: SB-27 negatif kontrol — gerçek içerik değişimi (EOL değil) hâlâ baseline-bayat verir', () => {
  const d = initRepo();
  setupRepo(d, { testClaim: 2 });
  spawnSync(process.execPath, [join(d, 'scripts', 'health-check.mjs'), '--fix'], { cwd: d, encoding: 'utf8' });
  write(d, 'tests/sample.test.mjs',
    "import { test } from 'node:test';\ntest('a', () => {});\ntest('c', () => {});\n");
  const r = runHealthCheck(d, ['--json']);
  cleanup(d);
  assert.ok(JSON.parse(r.out).findings.some(f => f.kod === 'baseline-bayat'), r.out);
});
