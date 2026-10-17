import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initRepo, write, run, git, cleanup } from './helpers.mjs';

// check-doc-integrity.mjs = check-doc-truth + check-doc-recency + check-integrity birleşimi
// (v0.16 konsolidasyonu). Test-case sayısı BİREBİR korunur — çağrı şekli değişir:
// run('check-doc-integrity.mjs', ['--rule=<ad>', ...eskiArgv]).

// ============================================================================
// --rule=doc-truth (eski tests/check-doc-truth.test.mjs, BİREBİR taşındı)
// ============================================================================
test('doc-truth: var olan yol ve script geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: { build: 'tsc' } }));
  write(d, 'src/app.ts', 'export {};\n');
  write(d, 'CLAUDE.md', 'Kod girişi: `src/app.ts`\nDerleme: `npm run build`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: ölü yol referansı fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'CLAUDE.md', 'Şuna bak: `src/olmayan-dosya.ts`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /yol yok/);
});

test('doc-truth: olmayan npm script fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: { build: 'tsc' } }));
  write(d, 'CLAUDE.md', 'Çalıştır: `npm run yokscript`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /script yok/);
});

test('doc-truth: olmayan make target fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'Makefile', 'build:\n\ttsc\n');
  write(d, 'CLAUDE.md', 'Dağıt: `make deploy`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /make target yok/);
});

// ── `node <yol>` denetimi (v0.18.4) — RUN/MAKE/DOTNET gibi bilinen komut aileleri tanınıyordu
// ama en sık yazılan `node gates/check-x.mjs` biçimi arada kalıp sessizce geçiyordu (dogfood
// bulgusu: .claude/agents/uygulayici.md ÜÇ AY var-olmayan komut yazdı, hiçbir kapı yakalamadı).
test('doc-truth: node ile var olan çok-segment yol geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'gates/check-x.mjs', 'export const x = 1;\n');
  write(d, 'CLAUDE.md', 'Çalıştır: `node gates/check-x.mjs`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: node ile OLMAYAN yol fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', 'Çalıştır: `node gates/check-yok.mjs`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /yol yok \(node\)/);
});

test('doc-truth: node ile tek-segment OLMAYAN script fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', 'Çalıştır: `node yok-boyle.mjs`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /yol yok \(node\)/);
});

test('doc-truth: node ile tek-segment VAR OLAN script geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'verify.mjs', 'export const x = 1;\n');
  write(d, 'CLAUDE.md', 'Çalıştır: `node verify.mjs`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// FP nöbetçisi: şablonlardaki placeholder argüman (`<dosyalar>`, `<yol>`) YAKALANMAMALI.
test('doc-truth: node ile PLACEHOLDER argüman (<yol>) FP üretmez (exit 0)', () => {
  const d = initRepo();
  write(d, 'gates/check-x.mjs', 'export const x = 1;\n');
  write(d, 'CLAUDE.md', 'Örnek: `node <yol>` ya da `node gates/check-x.mjs <dosyalar>`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// IGNORE önek filtresi node denetimine de uygulanmalı (hedef-repo yolları yanlış-FAIL üretmesin).
test('doc-truth: node ile hedef-repo yolu --ignore= altında FP üretmez (exit 0)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', 'Kurulumda oluşacak: `node scripts/gates/check-x.mjs`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md', '--ignore=scripts/'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: dotnet gerçek alt-komut geçer (.csproj varken, exit 0)', () => {
  const d = initRepo();
  write(d, 'src/Api.csproj', '<Project Sdk="Microsoft.NET.Sdk"></Project>\n');
  write(d, 'CLAUDE.md', 'Çalıştır: `dotnet run`. Test: `dotnet test`.\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: dotnet ölü alt-komut fail (.csproj varken, exit 1)', () => {
  const d = initRepo();
  write(d, 'src/Api.csproj', '<Project Sdk="Microsoft.NET.Sdk"></Project>\n');
  write(d, 'CLAUDE.md', 'Çalıştır: `dotnet bilmemne`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /dotnet alt-komutu yok/);
});

test('doc-truth: dotnet komutu .csproj YOKKEN denetlenmez (exit 0)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'CLAUDE.md', 'Eski not: `dotnet bilmemne`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: terraform ölü alt-komut fail (*.tf varken, exit 1)', () => {
  const d = initRepo();
  write(d, 'main.tf', 'resource "null_resource" "x" {}\n');
  write(d, 'CLAUDE.md', 'Altyapı: `terraform aplay`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /terraform alt-komutu yok/);
});

test('doc-truth: flutter gerçek alt-komut geçer (pubspec varken, exit 0)', () => {
  const d = initRepo();
  write(d, 'pubspec.yaml', 'name: app\n');
  write(d, 'CLAUDE.md', 'Çalıştır: `flutter run`. Test: `flutter test`.\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: ölü anchor yolu fail (anchor var, hedef yok, exit 1)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/yok.ts -->\n# Bölüm\nMetin.\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ölü anchor yolu/);
});

test('doc-truth: canlı anchor yolu geçer (anchor var, hedef var, exit 0)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'src/var.ts', 'export {};\n');
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/var.ts -->\n# Bölüm\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: placeholder anchor FP vermez ({{...}} elenir, exit 0)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'TEMPLATE.md', '<!-- doc-anchor: {{MODUL_KOD_DIZINI}} -->\n# Şablon\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'TEMPLATE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

function tFrontmatter(extra) {
  return `---\nid: TECH-AUTH-001\nfeature_ids: [sifre-sifirlama]\n${extra}\n---\n# T\n`;
}

test('doc-truth: constant ANCHOR\'SIZ → --strict FAIL, varsayılan UYARI', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'constants:\n  - {name: deneme_limiti, value: "5 deneme"}\n'
  ));
  const warn = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md'], d);
  assert.equal(warn.status, 0, warn.out);
  assert.match(warn.out, /UYARI/);
  assert.match(warn.out, /ANCHOR'SIZ/);
  const strictR = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(strictR.status, 1, strictR.out);
});

test('doc-truth: constant anchor'+"'"+'ı ÖLÜ yol (--strict FAIL)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'constants:\n  - {name: deneme_limiti, value: "5", anchor: "src/olmayan.ts#Foo"}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ÖLÜ/);
});

test('doc-truth: constant anchor\'ı yol var ama SEMBOL yok → SAHTE (--strict FAIL)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'src/AuthOptions.cs', 'class AuthOptions { int OtherThing; }\n');
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'constants:\n  - {name: sifirlama_suresi, value: "24 saat", anchor: "src/AuthOptions.cs:AuthOptions#ResetTokenExpiryHours"}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /SAHTE/);
});

test('doc-truth: constant anchor'+"'"+'ı yol VE sembol GERÇEK → geçer (exit 0, --strict dahil)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'src/AuthOptions.cs', 'class AuthOptions { int ResetTokenExpiryHours = 24; }\n');
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'constants:\n  - {name: sifirlama_suresi, value: "24 saat", anchor: "src/AuthOptions.cs:ResetTokenExpiryHours"}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: 🔴 verified_absence KANITSIZ (evidence/anchor yok) → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'verified_absences:\n  - {claim: "toplu-silme API\'si YOK"}\n'
  ));
  const warn = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md'], d);
  assert.equal(warn.status, 0, warn.out);
  assert.match(warn.out, /KANITSIZ/);
  const strictR = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(strictR.status, 1, strictR.out);
});

test('doc-truth: verified_absence sade-string madde (kanıt taşıyamaz) → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'verified_absences:\n  - "toplu-silme API\'si YOK"\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /KANITSIZ/);
});

test('doc-truth: verified_absence evidence İLE doldurulmuş → geçer (exit 0, --strict dahil)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'verified_absences:\n  - {claim: "Google hesabına parola eklenemez", evidence: "SetPassword endpoint yok", checked_at: 2026-07-13}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth SINIR: evidence alanı doluysa (içeriği YANLIŞ da olsa) kapı geçer — doğruluk denetlemez', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'verified_absences:\n  - {claim: "X yapılamaz", evidence: "uydurma-ama-dolu-alan"}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: anchors[] yol yok → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'anchors:\n  - {repo: src/olmayan-dizin, symbol: LoginCommandHandler, kind: handler, primary: true}\n'
  ));
  const warn = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md'], d);
  assert.equal(warn.status, 0, warn.out);
  assert.match(warn.out, /anchors\[\] ölü/);
  const strictR = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(strictR.status, 1, strictR.out);
});

test('doc-truth: anchors[] yol var ama sembol dosyada YOK → SAHTE (--strict FAIL)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'src/auth/Login.cs', 'class SomeOtherHandler {}\n');
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'anchors:\n  - {repo: src/auth/Login.cs, symbol: LoginCommandHandler, kind: handler, primary: true}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /sahte/);
});

test('doc-truth: anchors[] yol VE sembol GERÇEK → geçer (exit 0, --strict dahil)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'src/auth/Login.cs', 'class LoginCommandHandler {}\n');
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'anchors:\n  - {repo: src/auth/Login.cs, symbol: LoginCommandHandler, kind: handler, primary: true}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: anchors[] çapraz-repo (sol taraf bu repoda yok) → DOĞRULANAMADI notuyla ölü sayılır', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'anchors:\n  - {repo: pilot-backend, symbol: LoginCommandHandler, kind: handler, primary: true}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /DOĞRULANAMADI/);
});

test('doc-truth: verified_absences bloğu bir YORUM satırıyla BÖLÜNMÜŞ — yorumdan SONRAKİ kanıtsız madde de yakalanır (--strict FAIL)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'verified_absences:\n  - {claim: "A yok", evidence: "kanit-var"}\n  # ara not\n  - {claim: "B yok"}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /KANITSIZ.*B yok|B yok.*KANITSIZ/);
});

test('doc-truth: anchors[] bloğu bir YORUM satırıyla BÖLÜNMÜŞ — yorumdan SONRAKİ ölü anchor da yakalanır (--strict FAIL)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'anchors:\n  - {repo: package.json, symbol: scripts, kind: x, primary: true}\n  # ara not\n  - {repo: src/olmayan-dizin, symbol: X, kind: handler, primary: true}\n'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /anchors\[\] ölü/);
});

test('doc-truth: anchors[] frontmatter\'ın SON alanıyken (sondaki satır sonu yok) ölü anchor yine yakalanır (--strict FAIL)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'anchors:\n  - {repo: src/olmayan-dizin, symbol: X, kind: handler, primary: true}'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /anchors\[\] ölü/);
});

test('doc-truth: constants[] frontmatter\'ın SON alanıyken (bir önceki alan verified_absences) ikisi de doğru sınırlanır (--strict FAIL, tek bulgu)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'docs/tech/auth.md', tFrontmatter(
    'verified_absences:\n  - {claim: "A yok", evidence: "kanit-var"}\nconstants:\n  - {name: b, value: "2"}'
  ));
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/tech/auth.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ANCHOR'SIZ/);
  assert.doesNotMatch(r.out, /A yok/);
});

test('doc-truth: frontmatter\'sız düz-nesir doc [T] dallarından ETKİLENMEZ (exit 0)', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'CLAUDE.md', '# Proje notları\nconstants diye bir kelime geçebilir ama frontmatter yok.\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: INLINE kanıtsız verified_absences → --strict FAIL (blok kadar sıkı)', () => {
  const d = initRepo();
  write(d, 'docs/T.md', '---\nverified_absences: [{claim: "toplu silme yok"}]\n---\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/T.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('doc-truth: INLINE kanıtlı verified_absences → geçer (yanlış alarm yok)', () => {
  const d = initRepo();
  write(d, 'docs/T.md', '---\nverified_absences: [{claim: "yok", evidence: "grep sonucu boş"}]\n---\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/T.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-truth: INLINE sade-string absence (kanıt taşıyamaz) → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/T.md', '---\nverified_absences: ["toplu silme yok"]\n---\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'docs/T.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

// ── boş-küme körlüğü + ikinci-katman körlük (v0.18.2, pilot bulgusu A; ana ajan 2026-08-06'da
// ikinci katmanı ölçtü: docs.length NİYET EDİLENİ sayardı, scanned GERÇEKTEN okunanı sayar) ──
test('doc-truth: argümansız + tracked dogfood dosyası yok → taranan=0 FAIL (exit 1)', () => {
  const d = initRepo();
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /taranan/i);
});

test('doc-truth: --allow-empty ile taranan=0 geçer (exit 0)', () => {
  const d = initRepo();
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', '--allow-empty'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /allow-empty/);
});

test('doc-truth: var olmayan dosya argümanla verilince FAIL (exit 1) — sessizce yutulmaz', () => {
  const d = initRepo();
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'YOK-BOYLE-DOSYA.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /diskte YOK/);
});

// ============================================================================
// --rule=doc-recency (eski tests/check-doc-recency.test.mjs, BİREBİR taşındı)
// ============================================================================
test('doc-recency: anchor\'lı kod değişti, doküman dokunulmadı → strict fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\nJWT...\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/auth/jwt.ts', 'export const v = 2;\n');
  git(d, 'add', 'src/auth/jwt.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TRIPWIRE|recency/i);
});

test('doc-recency: varsayılan mod tripwire\'da UYARI verir (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/auth/jwt.ts', 'export const v = 2;\n');
  git(d, 'add', 'src/auth/jwt.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /TRIPWIRE/i);
});

test('doc-recency: kod + doküman birlikte dokunuldu → susar (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/auth/jwt.ts', 'export const v = 2;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\nOAuth\'a geçildi\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-recency: anchor\'lı yol değişmedi → susar (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'src/other.ts', 'export const x = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/other.ts', 'export const x = 2;\n');
  git(d, 'add', 'src/other.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-recency: anchor\'sız repo → opt-in, etki yok (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/a.ts', 'export const x = 1;\n');
  write(d, 'README.md', '# doküman (anchor yok)\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/a.ts', 'export const x = 2;\n');
  git(d, 'add', 'src/a.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /opt-in|anchor tanımlı doküman yok/i);
});

test('doc-recency: dosya-bazlı anchor (dizin değil) birebir eşleşir → fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'src/config.ts', 'export const c = 1;\n');
  write(d, 'CLAUDE.md', '<!-- doc-anchor: src/config.ts -->\n# Config\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/config.ts', 'export const c = 2;\n');
  git(d, 'add', 'src/config.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('doc-recency: anchor\'lı dosya silinirse → tripwire YOK (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/jwt.ts -->\n# Auth\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  git(d, 'rm', '-q', 'src/auth/jwt.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, 'silme tripwire ATEŞLEMEMELİ: ' + r.out);
});

test('doc-recency: anchor\'lı dosya yeniden adlandırılırsa → tripwire YOK (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/jwt.ts -->\n# Auth\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  git(d, 'mv', 'src/auth/jwt.ts', 'src/auth/token.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-recency: determinizm — aynı diff iki koşumda aynı sonuç', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/auth/jwt.ts', 'export const v = 2;\n');
  git(d, 'add', 'src/auth/jwt.ts');
  const r1 = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  const r2 = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r1.status, r2.status, 'aynı diff → aynı exit kodu (deterministik)');
  assert.equal(r1.out, r2.out, 'aynı diff → aynı çıktı (deterministik)');
});

// ============================================================================
// doc-recency KADEMELİ TAZELİK ZİNCİRİ (v0.18.3) — kod→[T] (kademe 1), [T]→[L0] (kademe 2).
// KULLANICI KARARI 2026-08-06: "teknik döküman koda çapalı olsun, son kullanıcı dökümanı da
// teknik dökümana çapalı olsun, birbirlerini tetiklesinler." Üç kaynak (HTML anchor + kademe 1/2)
// birleşir, biri diğerini EZMEZ — HTML anchor testleri yukarıda BİREBİR yeşil kalmalı (regresyon).
// `--cascade` OPT-IN (v0.18.3 hakem turu B1 düzeltmesi): kademe 1/2 YALNIZ bu bayrakla çalışır —
// bayraksız çağrı v0.18.2 ile BİREBİR (ölçülen regresyon: [T]'li ama HTML-anchor'sız bir hedef
// repo bayraksız kademe 1/2 ile v0.18.2'de exit 0 iken exit 1'e düşüyordu). Aşağıdaki tüm
// kademe 1/2 testleri bu yüzden `--cascade` taşır.
// ============================================================================
function tDoc({ id = 'TECH-PAY-001', featureIds = '[odeme]', repo = 'backend/pay.ts', symbol = 'PayService' } = {}) {
  return `---
id: ${id}
feature_ids: ${featureIds}
anchors:
  - {repo: ${repo}, symbol: ${symbol}, kind: service, primary: true}
---
# ${id}

## Ne yapar

Ödeme akışını anlatır. Doldurulmuş gerçek içerik, on satırdan uzun gövde burada.

## Akış

1. Kullanıcı ödeme başlatır.
2. Sistem işler.
3. Sonuç döner.
`;
}

function l0Doc({ featureId = 'odeme', techDocs = ['docs/tech/pay.md'] } = {}) {
  const yaml = techDocs.map(p => `    - ${p}`).join('\n');
  return `---
id: TR-PAY-001
feature_id: ${featureId}
anchors:
  code: []
  tech_docs:
${yaml}
coverage:
  status: tam
  missing: []
---
# L0 — ödeme

Son kullanıcı anlatımı, gövde on satırdan uzun burada devam eder ve eder.
`;
}

test('doc-recency KADEME 1: anchor sembolünün çözüldüğü KOD dosyası değişti, [T] dokunulmadı → strict fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'backend/pay.ts', 'export class PayService {}\n');
  write(d, 'docs/tech/pay.md', tDoc());
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'backend/pay.ts', 'export class PayService { v2() {} }\n');
  git(d, 'add', 'backend/pay.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '--cascade'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TRIPWIRE/i);
  assert.match(r.out, /KADEME 1/);
});

test('doc-recency KADEME 1: --cascade YOKSA [T] frontmatter\'ı tek başına ateşlemez (v0.18.2 ile BİREBİR, exit 0) — B1 regresyon nöbetçisi', () => {
  const d = initRepo();
  write(d, 'backend/pay.ts', 'export class PayService {}\n');
  write(d, 'docs/tech/pay.md', tDoc());
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'backend/pay.ts', 'export class PayService { v2() {} }\n');
  git(d, 'add', 'backend/pay.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /TRIPWIRE/i);
});

test('doc-recency KADEME 1: [T] de birlikte dokunulduysa ateşlemez (exit 0)', () => {
  const d = initRepo();
  write(d, 'backend/pay.ts', 'export class PayService {}\n');
  write(d, 'docs/tech/pay.md', tDoc());
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'backend/pay.ts', 'export class PayService { v2() {} }\n');
  write(d, 'docs/tech/pay.md', tDoc() + '\nGüncellendi.\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '--cascade'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-recency KADEME 2: [T] dosyası değişti, onu listeleyen [L0] dokunulmadı → strict fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'backend/pay.ts', 'export class PayService {}\n');
  write(d, 'docs/tech/pay.md', tDoc());
  write(d, 'docs/user/pay.md', l0Doc());
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'docs/tech/pay.md', tDoc() + '\nGüncellendi.\n');
  git(d, 'add', 'docs/tech/pay.md');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '--cascade'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TRIPWIRE/i);
  assert.match(r.out, /KADEME 2/);
});

test('doc-recency KADEME 2: [L0] de birlikte dokunulduysa ateşlemez (exit 0)', () => {
  const d = initRepo();
  write(d, 'backend/pay.ts', 'export class PayService {}\n');
  write(d, 'docs/tech/pay.md', tDoc());
  write(d, 'docs/user/pay.md', l0Doc());
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'docs/tech/pay.md', tDoc() + '\nGüncellendi.\n');
  write(d, 'docs/user/pay.md', l0Doc() + '\nGüncellendi.\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '--cascade'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-recency: hiç [T]/[L0]/HTML-anchor yoksa no-op (exit 0, mevcut opt-in mesajı)', () => {
  const d = initRepo();
  write(d, 'src/a.ts', 'export const x = 1;\n');
  write(d, 'README.md', '# doküman (anchor yok)\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/a.ts', 'export const x = 2;\n');
  git(d, 'add', 'src/a.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /opt-in|anchor tanımlı doküman yok/i);
});

test('doc-recency REGRESYON NÖBETÇİSİ: HTML doc-anchor hâlâ çalışıyor ([T]/[L0] YOKKEN de, exit 1)', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\nJWT...\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/auth/jwt.ts', 'export const v = 2;\n');
  git(d, 'add', 'src/auth/jwt.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TRIPWIRE/i);
});

test('doc-recency: HTML-anchor + [T]/[L0] AYNI ANDA kurulu, üçü de dokunulmuş → susar (exit 0, çapraz-kaynak FP yok)', () => {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\n');
  write(d, 'backend/pay.ts', 'export class PayService {}\n');
  write(d, 'docs/tech/pay.md', tDoc());
  write(d, 'docs/user/pay.md', l0Doc());
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/auth/jwt.ts', 'export const v = 2;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\nGüncellendi\n');
  write(d, 'backend/pay.ts', 'export class PayService { v2() {} }\n');
  write(d, 'docs/tech/pay.md', tDoc() + '\nGüncellendi.\n');
  write(d, 'docs/user/pay.md', l0Doc() + '\nGüncellendi.\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '--cascade'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-recency KADEME 1: anchor YOLU çözülemiyorsa (repo alanı dosya-sistemde yok) "çözülemedi" olarak RAPORLANIR, sessizce atlanmaz', () => {
  const d = initRepo();
  write(d, 'backend/pay.ts', 'export class PayService {}\n');
  write(d, 'docs/tech/pay.md', tDoc({ repo: 'backend/olmayan.ts', symbol: 'YokSembol' }));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'README.md', '# değişmeyen bir dosya daha\n');
  git(d, 'add', 'README.md');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '--cascade'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /çözülemedi/i);
});

// v0.18.3 hakem turu B4 düzeltmesi: yukarıdaki test adı ÖNCEDEN "sembol dosyada bulunamıyorsa
// çözülemedi raporlanır" diyordu ama fixture'ı `repo: 'backend/olmayan.ts'` — bu YOL YOK vakasıdır,
// "sembol yok" vakası DEĞİL. Gerçek "yol VAR ama sembol dosyada YOK" vakasında davranış KADEME 1'in
// YOL-TABANLI doğası gereği farklıdır: sembol hiç doğrulanmaz (bkz. CONTRACT.md MADDE 17/B3), yol
// değiştiği için TRIPWIRE basılır — "çözülemedi" DEĞİL. Bu test o gerçek davranışı sabitler.
test('doc-recency KADEME 1: anchor YOLU var ama sembol o dosyada YOK olsa da — sembol burada doğrulanmaz, yol değişince yine TRIPWIRE', () => {
  const d = initRepo();
  write(d, 'backend/pay.ts', 'export class PayService {}\n');
  write(d, 'docs/tech/pay.md', tDoc({ symbol: 'BuSembolDosyadaYok' }));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'backend/pay.ts', 'export class PayService { v2() {} }\n');
  git(d, 'add', 'backend/pay.ts');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict', '--cascade'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TRIPWIRE/i);
  assert.doesNotMatch(r.out, /çözülemedi/i);
});

// v0.18.3 hakem turu B2 düzeltmesi: `feature_ids:` yerine tekil `feature_id:` yazılmış (typo) bir
// [T] adayı hiçbir yerde raporlanmıyordu — ne tripwire ne "çözülemedi" NOT'u, tetikleme HİÇ
// kurulmuyordu ve kimse fark etmiyordu. `findUnclassifiedAnchorDocs` artık bunu "sınıflanamadı"
// NOT bloğunda raporlar; bu istisnai olarak `--cascade` BAĞIMSIZ her zaman çalışır (typo tespiti
// kullanıcının cascade açıp açmamasına bağlı olmamalı — kullanıcı henüz cascade'i keşfetmemiş
// olabilir, tam da o an typo'yu görmesi gerekir).
test('doc-recency B2: feature_id/feature_ids typo\'su [T]\'yi sınıflandırılamaz bırakırsa "sınıflanamadı" NOT bloğunda görünür (cascade olmadan da)', () => {
  const d = initRepo();
  write(d, 'backend/pay.ts', 'export class PayService {}\n');
  // KASITLI TYPO: feature_ids: yerine tekil feature_id: — [T] sınıfına düşmez (classifyDoc
  // dört-alan şartı: [T]=feature_ids+anchors, [L0]=feature_id+coverage; bu doküman İKİSİNE de
  // tam uymuyor).
  write(d, 'docs/tech/pay.md', `---
id: TECH-PAY-001
feature_id: odeme
anchors:
  - {repo: backend/pay.ts, symbol: PayService, kind: service, primary: true}
---
# TECH-PAY-001

## Ne yapar

Ödeme akışını anlatır. Doldurulmuş gerçek içerik, on satırdan uzun gövde burada.
`);
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'README.md', '# değişmeyen bir dosya daha\n');
  git(d, 'add', 'README.md');
  // v0.30 T3: sınıflanamayan anchor'lı doküman artık UYARI (--strict'te FAIL — bkz. check-doc-integrity-v030.test.mjs);
  // bu test bayraksız davranışı (exit 0 + görünür satır) kilitler.
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /sınıflanamadı/i);
  assert.match(r.out, /docs\/tech\/pay\.md/);
});

// FP negatif deneyi: rastgele frontmatter'lı generic bir .md (blog/jekyll tarzı, hiçbir
// anchors:/tech_docs:/feature_id-ailesi alanı YOK) "sınıflanamadı" NOT'una DÜŞMEMELİ — DAR sinyal
// ölçümü budur (B2 uyarısındaki FP riski).
test('doc-recency B2 FP-negatif: anchors/tech_docs/feature_id alanı OLMAYAN generic frontmatter\'lı .md "sınıflanamadı" NOT\'una düşmez', () => {
  const d = initRepo();
  write(d, 'docs/blog/post.md', `---
title: Bir blog yazısı
date: 2026-01-01
tags: [a, b]
---
# Bir blog yazısı

Bu bir Jekyll tarzı blog gönderisi, [T]/[L0] ile hiçbir ilgisi yok.
`);
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'README.md', '# değişmeyen bir dosya daha\n');
  git(d, 'add', 'README.md');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-recency', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /sınıflanamadı/i);
});

// ============================================================================
// --rule=integrity (eski tests/check-integrity.test.mjs, BİREBİR taşındı)
// ============================================================================
function tFull({ id = 'TECH-AUTH-001', featureIds = '[sifre-sifirlama]', repo = 'backend', symbol = 'AuthService', primary = 'true' } = {}) {
  return `---
id: ${id}
feature_ids: ${featureIds}
anchors:
  - {repo: ${repo}, symbol: ${symbol}, kind: service, primary: ${primary}}
---
# ${id}

## Ne yapar — iş-dili özeti

Bu, kullanıcının şifresini sıfırlamasını sağlar. Doldurulmuş, gerçek içerik.

## Akış

1. Kullanıcı e-posta girer.
2. Sistem sıfırlama linki gönderir.
3. Kullanıcı yeni şifre belirler.

## Public yüzey

| Yüzey | Anchor | Not |
|---|---|---|
| reset | \`backend:AuthService\` | sıfırlama akışı |
`;
}

const T_STUB = `---
id: TECH-AUTH-002
feature_ids: [sifre-sifirlama]
anchors: []
---
# stub
`;

function l0Full({ featureId = 'sifre-sifirlama', techDocs = ['docs/tech/auth.md'] } = {}) {
  const techDocsYaml = techDocs.map(d => `    - ${d}`).join('\n');
  return `---
id: TR-AUTH-001
feature_id: ${featureId}
anchors:
  code: []
  tech_docs:
${techDocsYaml}
coverage:
  status: tam
  missing: []
---
# L0
`;
}

test('integrity: hiçbir [T]/[L0]/registry yok → sessizce geçer (exit 0, no-op)', () => {
  const d = initRepo();
  write(d, 'README.md', '# Proje\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no-op/);
});

test('integrity: dürüst tam [T] + var olan anchor → geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', tFull());
  write(d, 'backend', 'class AuthService {}\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('integrity: DANGLING ANCHOR — anchor yolu VAR ama sembol dosyada YOK → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', tFull({ repo: 'backend', symbol: 'AslindaYokSembol' }));
  write(d, 'backend', 'class AuthService {}\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /DANGLING ANCHOR/);
  assert.match(r.out, /sembol dosyada YOK/);
});

test('integrity: DANGLING ANCHOR — registry.tech_docs var olmayan [T] dosyasına işaret ediyor → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/olmayan.md\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /DANGLING ANCHOR/);
  assert.match(r.out, /docs\/tech\/olmayan\.md/);
});

test('integrity: DANGLING ANCHOR — [L0].anchors.tech_docs var olmayan [T] dosyasına işaret ediyor → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/user/sifre-sifirlama.md', l0Full({ techDocs: ['docs/tech/olmayan.md'] }));
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /DANGLING ANCHOR/);
  assert.match(r.out, /anchors\.tech_docs/);
});

test('integrity: DANGLING ANCHOR — çapraz-repo anchor (yol bu repoda yok) sert FAIL SAYILMAZ, yalnız NOT olarak raporlanır', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', tFull({ repo: 'baska-repo-adi', symbol: 'UzakSembol' }));
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /NOT/);
});

test('integrity: STUB\'A GERİ DÖNMÜŞ [T] — geçmişte dolu, şimdi stub → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', tFull());
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'dolu T eklendi');
  write(d, 'docs/tech/auth.md', T_STUB);
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'yanlislikla stuba dondu');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /STUB'A GERİ DÖNMÜŞ \[T\]/);
});

test("integrity: STUB'A GERİ DÖNMÜŞ [T] — dosya İKİ KEZ git mv ile taşınmış, SONRA stub'a dönmüş → --strict FAIL (rename geçmişi ① sınıfını KÖRLEŞTİRMEZ)", () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', tFull());
  write(d, 'backend', 'class AuthService {}\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'dolu T v1 (auth.md)');
  git(d, 'mv', 'docs/tech/auth.md', 'docs/tech/auth-mid.md');
  git(d, 'commit', '-q', '-m', 'rename 1');
  git(d, 'mv', 'docs/tech/auth-mid.md', 'docs/tech/auth-final.md');
  git(d, 'commit', '-q', '-m', 'rename 2');
  write(d, 'docs/tech/auth-final.md', T_STUB);
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'yanlislikla stuba dondu (rename sonrasi)');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /STUB'A GERİ DÖNMÜŞ \[T\]/);
});

test('integrity: dürüst yeni stub [T] (geçmişte hiç dolu olmamış) → YANLIŞ ALARM VERMEZ (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_STUB);
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'yeni T iskeleti');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('integrity: dolu [T] dolu kalmaya devam ediyor → YANLIŞ ALARM VERMEZ (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', tFull());
  write(d, 'backend', 'class AuthService {}\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'dolu T');
  write(d, 'docs/tech/auth.md', tFull({ id: 'TECH-AUTH-001' }) + '\n<!-- küçük ek -->\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'kucuk guncelleme, hala dolu');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('integrity: ÇAKIŞMA — aynı id: iki [T] dosyasında → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/tech/a.md', tFull({ id: 'TECH-AUTH-001', repo: 'backend', symbol: 'ServisA' }));
  write(d, 'docs/tech/b.md', tFull({ id: 'TECH-AUTH-001', repo: 'backend', symbol: 'ServisB' }));
  write(d, 'backend', 'class ServisA {}\nclass ServisB {}\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ÇAKIŞMA/);
  assert.match(r.out, /id: TECH-AUTH-001/);
});

test('integrity: ÇAKIŞMA — aynı primary anchor iki [T]\'de KESİŞMEYEN feature_ids ile → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/tech/a.md', tFull({ id: 'TECH-AUTH-001', featureIds: '[sifre-sifirlama]', repo: 'backend', symbol: 'AuthService' }));
  write(d, 'docs/tech/b.md', tFull({ id: 'TECH-AUTH-002', featureIds: '[siparis-limiti]', repo: 'backend', symbol: 'AuthService' }));
  write(d, 'backend', 'class AuthService {}\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ÇAKIŞMA/);
  assert.match(r.out, /KESİŞMİYOR/);
});

test('integrity: aynı primary anchor iki [T]\'de AMA feature_ids KESİŞİYOR (çoklu-üyelik meşru) → geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/a.md', tFull({ id: 'TECH-AUTH-001', featureIds: '[sifre-sifirlama, giris-yapma]', repo: 'backend', symbol: 'AuthService' }));
  write(d, 'docs/tech/b.md', tFull({ id: 'TECH-AUTH-002', featureIds: '[giris-yapma]', repo: 'backend', symbol: 'AuthService' }));
  write(d, 'backend', 'class AuthService {}\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('integrity: YETİM STUB — registry stub bir [T]\'yi besleyici sayıyor → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_STUB);
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/auth.md\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /YETİM STUB/);
});

test('integrity: registry dolu [T]\'yi besleyici sayıyor → geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', tFull());
  write(d, 'backend', 'class AuthService {}\n');
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/auth.md\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('integrity: --strict verilmezse bulgular UYARI verir, engellemez (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_STUB);
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/auth.md\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
});

// ============================================================================
// --rule=facts-drift (v0.26) — iddia↔ölçüm DELTA'sı
// Gerekçe: 7 repoluk saha denetiminde "1240 test" iddiası 11 dosyaya yayılmış, gerçek 1488.
// Bu alt-kural işaretli hücreyi facts.json ölçümüyle karşılaştırır.
// ============================================================================
const FACTS = (measurements) => JSON.stringify({ generated_by: 'test', measurements }, null, 2);

test('facts-drift: facts.json yoksa no-op (opt-in, exit 0)', () => {
  const d = initRepo();
  write(d, 'CLAUDE.md', 'Test: <!--fact:test_count-->550<!--/fact--> yeşil\n');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no-op|yok/);
});

test('facts-drift: iddia = ölçüm ise geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'facts.json', FACTS({ test_count: { status: 'measured', value: 550 } }));
  write(d, 'CLAUDE.md', 'Test: <!--fact:test_count-->550<!--/fact--> yeşil\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// NEGATİF DENEY (MADDE 15) — kapı gerçekten ateşliyor mu?
test('facts-drift: iddia ≠ ölçüm --strict ile FAIL (exit 1) + DELTA gösterir', () => {
  const d = initRepo();
  write(d, 'facts.json', FACTS({ test_count: { status: 'measured', value: 550 } }));
  write(d, 'CLAUDE.md', 'Test: <!--fact:test_count-->547<!--/fact--> yeşil\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /iddia 547/);
  assert.match(r.out, /ölçüm 550/);
  assert.match(r.out, /Δ\+3/);   // yaş DEĞİL delta — 5 modelin ortak reddi
});

test('facts-drift: bayraksız sapma UYARI verir ama bloke ETMEZ (exit 0)', () => {
  const d = initRepo();
  write(d, 'facts.json', FACTS({ test_count: { status: 'measured', value: 550 } }));
  write(d, 'CLAUDE.md', 'Test: <!--fact:test_count-->547<!--/fact--> yeşil\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /FACTS-DRIFT/);
});

// UNKNOWN ≠ SAPMA — saha-H vakası (şema değişti, sistem sessiz 0 okudu)
test('facts-drift: unknown fact sapma SAYILMAZ ama GÖRÜNÜR kalır (exit 0)', () => {
  const d = initRepo();
  write(d, 'facts.json', FACTS({ test_count: { status: 'unknown', cmd: 'node --test' } }));
  write(d, 'CLAUDE.md', 'Test: <!--fact:test_count-->547<!--/fact--> yeşil\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /ÖLÇÜLEMEDİ/);
});

test('facts-drift: mükerrer iddia TEK ölçümden çoklu dosyada yakalanır', () => {
  const d = initRepo();
  write(d, 'facts.json', FACTS({ gate_count: { status: 'measured', value: 6 } }));
  write(d, 'CLAUDE.md', 'Kapı: <!--fact:gate_count-->9<!--/fact-->\n');
  write(d, 'README.md', 'Envanter: <!--fact:gate_count-->16<!--/fact--> kapı\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /CLAUDE\.md/);
  assert.match(r.out, /README\.md/);
});

test('facts-drift: işaretsiz doküman taranmaz (no-op, exit 0)', () => {
  const d = initRepo();
  write(d, 'facts.json', FACTS({ test_count: { status: 'measured', value: 550 } }));
  write(d, 'CLAUDE.md', 'Burada 547 test var ama İŞARET yok — kapının görüş alanı dışında.\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /0 işaretli doküman/);
});

test('facts-drift: facts.json da KAYITSIZ işaret raporlanır (exit 0, sapma değil)', () => {
  const d = initRepo();
  write(d, 'facts.json', FACTS({ test_count: { status: 'measured', value: 550 } }));
  write(d, 'CLAUDE.md', 'Şablon: <!--fact:template_count-->27<!--/fact-->\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /KAYITSIZ/);
});

// REGRESYON NÖBETÇİSİ (v0.26, kurulduğu gün ölçüldü): kapı KENDİ CONTRACT satırındaki
// dokümantasyon örneğini "kayıtsız iddia" sanıp yanlış-alarm verdi. Satır-içi kod (`...`)
// içindeki işaret ÖRNEKTİR, iddia değildir.
test('facts-drift: satır-içi kod içindeki işaret ÖRNEKTİR, iddia sayılmaz', () => {
  const d = initRepo();
  write(d, 'facts.json', FACTS({ test_count: { status: 'measured', value: 550 } }));
  write(d, 'CONTRACT.md', 'Sözdizimi: `<!--fact:KEY-->DEĞER<!--/fact-->` — bu bir ÖRNEKTİR.\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /KAYITSIZ/);
  assert.match(r.out, /0 işaretli doküman/);
});

test('facts-drift: aynı dosyada örnek VE gerçek iddia bir arada — yalnız gerçek denetlenir', () => {
  const d = initRepo();
  write(d, 'facts.json', FACTS({ test_count: { status: 'measured', value: 550 } }));
  write(d, 'DOC.md', 'Örnek: `<!--fact:KEY-->N<!--/fact-->`\nGerçek: <!--fact:test_count-->547<!--/fact-->\n');
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=facts-drift', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Δ\+3/);
  assert.doesNotMatch(r.out, /KAYITSIZ/);
});

// ORTAM-BAĞIMLI SAHTE-YEŞİL REGRESYON NÖBETÇİSİ (v0.26.3, ÖLÇÜLDÜ 2026-09-06):
// doc-truth `existsSync` ile "dosya sisteminde var mı" soruyordu. Geliştiricinin makinesinde
// `.git/hooks/pre-commit` (hook:install koşmuş) ve `bench/runs/` (gitignore'lu koşu çıktısı)
// VARDI → yerel YEŞİL; CI'ın temiz checkout'unda YOKTU → CI KIRMIZI. Aynı commit, iki verdict.
// Bu, "install-exam ③ CI fiilen koştu mu → FAIL" bulgusunun KÖK NEDENİYDİ (v0.24'ten beri).
test('doc-truth: üretilen/izlenmeyen yol (.git/, bench/runs) ölü referans SAYILMAZ', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  // Bu iki yol fixture'da FİZİKSEL OLARAK YOK — tam da CI'ın gördüğü durum.
  write(d, 'CLAUDE.md',
    'Hook: `.git/hooks/pre-commit` shim\'i çağırır.\n' +
    'Koşular: `bench/runs/` → gitignore.\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /yol yok/);
});

test('doc-truth: muafiyet DAR — bench/ altındaki İZLENEN dosya hâlâ denetlenir', () => {
  const d = initRepo();
  write(d, 'package.json', JSON.stringify({ scripts: {} }));
  write(d, 'CLAUDE.md', 'Vakalar: `bench/olmayan-vaka.json`\n');
  const r = run('check-doc-integrity.mjs', ['--rule=doc-truth', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /bench\/olmayan-vaka\.json/);
});

// ============================================================================
// v0.30.4 — doc-recency argüman ayrıştırma + --base <ref>; integrity blok-taşması + çakışma anahtarı
// ============================================================================
function recencyRepo() {
  const d = initRepo();
  write(d, 'src/auth/jwt.ts', 'export const v = 1;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  git(d, 'branch', '-M', 'main');
  return d;
}
const rc = (d, ...a) => run('check-doc-integrity.mjs', ['--rule=doc-recency', ...a], d);

test('doc-recency --base: değer-alan bayrağın değeri dosya argümanı SANILMAZ; PR aralığında kod değişti, doküman değişmedi → FAIL (exit 1, tripwire)', () => {
  const d = recencyRepo();
  git(d, 'checkout', '-q', '-b', 'pr');
  write(d, 'src/auth/jwt.ts', 'export const v = 2;\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'kod');
  const r = rc(d, '--base', 'main', '--strict');
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TRIPWIRE/);
  assert.doesNotMatch(r.out, /diskte YOK/);
});

test('doc-recency --base=<ref> biçimi + kod ve doküman birlikte değişti → exit 0', () => {
  const d = recencyRepo();
  git(d, 'checkout', '-q', '-b', 'pr');
  write(d, 'src/auth/jwt.ts', 'export const v = 2;\n');
  write(d, 'docs/AUTH.md', '<!-- doc-anchor: src/auth/ -->\n# Auth\nguncel\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'kod+doc');
  const r = rc(d, '--base=main', '--strict');
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('doc-recency --base: çözülemeyen ref → FAIL (fail-open değil)', () => {
  const d = recencyRepo();
  const r = rc(d, '--base', 'origin/yok', '--strict');
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /base ref çözülemedi/);
});

test('doc-recency --base --cascade birlikte çalışır: kod→[T] kademe 1 PR aralığından yakalanır', () => {
  const d = initRepo();
  write(d, 'src/svc/a.ts', 'export class Svc {}\n');
  write(d, 'docs/tech/svc.md', '---\nid: TECH-1\nfeature_ids: [f1]\nanchors:\n  - {repo: src/svc/a.ts, symbol: Svc, primary: true}\n---\n# T\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init'); git(d, 'branch', '-M', 'main');
  git(d, 'checkout', '-q', '-b', 'pr');
  write(d, 'src/svc/a.ts', 'export class Svc { x = 1 }\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'kod');
  const r = rc(d, '--base', 'main', '--cascade', '--strict');
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /KADEME 1/);
});

test('doc-recency: bilinmeyen bayrak künyesiz (paket) / eski künyede → UYARI, exit 0; v0.30+ künyede → FAIL (exit 1)', () => {
  const d = recencyRepo();
  const paket = rc(d, '--bilinmez');
  write(d, '.agentic-repo-setup.json', JSON.stringify({ skill_version: '0.29.0' }));
  const eski = rc(d, '--bilinmez');
  write(d, '.agentic-repo-setup.json', JSON.stringify({ skill_version: '0.30.0' }));
  const yeni = rc(d, '--bilinmez');
  cleanup(d);
  assert.equal(paket.status, 0, paket.out);
  assert.match(paket.out, /UYARI — bilinmeyen bayrak: --bilinmez/);
  assert.equal(eski.status, 0, eski.out);
  assert.equal(yeni.status, 1, yeni.out);
  assert.match(yeni.out, /bilinmeyen bayrak: --bilinmez/);
  assert.doesNotMatch(yeni.out, /diskte YOK/);
});

test('doc-recency: kategori bayrakları (--json --allow-empty --ignore= --registry= --facts=) TANINIR — v0.30+ künyede bile FAIL/UYARI yok', () => {
  const d = recencyRepo();
  write(d, '.agentic-repo-setup.json', JSON.stringify({ skill_version: '0.30.2' }));
  const r = rc(d, '--json', '--allow-empty', '--ignore=a,b', '--registry=x.yaml', '--facts=f.json');
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /bilinmeyen bayrak/);
});

test('doc-recency: --base değersiz → exit 1', () => {
  const d = recencyRepo();
  const r = rc(d, '--base');
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /--base bir değer ister/);
});

const FILL = '# T\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n';

test('integrity: [L0] anchors içinde `symbols:` kardeş listesi tech_docs sanılmaz (blok taşması; exit 0)', () => {
  const d = initRepo();
  write(d, 'src/a.ts', 'export class Foo {}\n');
  write(d, 'docs/tech/a.md', '---\nid: TECH-1\nfeature_ids: [f1]\nanchors:\n  - {repo: src/a.ts, symbol: Foo, primary: true}\n---\n' + FILL);
  write(d, 'docs/user/a.md', '---\nfeature_id: f1\ncoverage: eksik\nanchors:\n  tech_docs:\n    - docs/tech/a.md\n  symbols:\n    - IsBlockedStockActive\n    - AllWarehousesEnable\n---\n' + FILL);
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /IsBlockedStockActive/);
});

test('integrity: GERÇEK ölü tech_docs yolu blok taşması düzeltmesinden sonra HÂLÂ yakalanır (negatif kontrol, exit 1)', () => {
  const d = initRepo();
  write(d, 'docs/user/a.md', '---\nfeature_id: f1\ncoverage: eksik\nanchors:\n  tech_docs:\n    - docs/tech/yok.md\n  symbols:\n    - Foo\n---\n' + FILL);
  write(d, 'docs/tech/a.md', '---\nid: TECH-1\nfeature_ids: [f1]\nanchors:\n  - {repo: x, symbol: Y}\n---\n' + FILL);
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /docs\/tech\/yok\.md/);
});

test('integrity ÇAKIŞMA: aynı sembol FARKLI path → çakışma yok; AYNI path kesişmeyen feature_ids → ÇAKIŞMA (exit 1)', () => {
  const mk = (p1, p2) => {
    const d = initRepo();
    write(d, 'src/a/Q.cs', 'class Q {}\n');
    write(d, 'src/b/Q.cs', 'class Q {}\n');
    const t = (id, f, p) => `---\nid: ${id}\nfeature_ids: [${f}]\nanchors:\n  - {repo: be, symbol: Q, path: ${p}, primary: true}\n---\n` + FILL;
    write(d, 'docs/tech/1.md', t('TECH-1', 'f1', p1));
    write(d, 'docs/tech/2.md', t('TECH-2', 'f2', p2));
    git(d, 'add', '-A');
    return d;
  };
  const d1 = mk('src/a/Q.cs', 'src/b/Q.cs');
  const ok = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d1);
  cleanup(d1);
  assert.doesNotMatch(ok.out, /ÇAKIŞMA/, ok.out);
  const d2 = mk('src/a/Q.cs', 'src/a/Q.cs');
  const kotu = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d2);
  cleanup(d2);
  assert.equal(kotu.status, 1, kotu.out);
  assert.match(kotu.out, /ÇAKIŞMA/);
});

test('integrity ÇAKIŞMA: iki FARKLI repo, aynı path ve sembol → çakışma YOK (anahtar repo:path:symbol)', () => {
  const d = initRepo();
  write(d, 'src/a/Q.cs', 'class Q {}\n');
  const t = (id, f, repo) => `---\nid: ${id}\nfeature_ids: [${f}]\nanchors:\n  - {repo: ${repo}, symbol: Q, path: src/a/Q.cs, primary: true}\n---\n` + FILL;
  write(d, 'docs/tech/1.md', t('TECH-1', 'f1', 'repo-a'));
  write(d, 'docs/tech/2.md', t('TECH-2', 'f2', 'repo-b'));
  git(d, 'add', '-A');
  const r = run('check-doc-integrity.mjs', ['--rule=integrity', '--strict'], d);
  cleanup(d);
  assert.doesNotMatch(r.out, /ÇAKIŞMA/, r.out);
});
