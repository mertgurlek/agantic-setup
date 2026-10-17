import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { tmp, write, run, cleanup, initRepo, git } from './helpers.mjs';

// check-hygiene.mjs = check-utf8 + check-secrets + check-placeholders + check-file-size
// birleşimi (v0.16 konsolidasyonu). Test-case sayısı BİREBİR korunur — çağrı şekli değişir:
// run('check-hygiene.mjs', ['--rule=<ad>', ...eskiArgv]).

// ============================================================================
// --rule=utf8 (eski tests/check-utf8.test.mjs, BİREBİR taşındı)
// ============================================================================
test('utf8: temiz UTF-8 dosya geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'a.md', '# Merhaba dünya\nçğşöüı içerik\n');
  const r = run('check-hygiene.mjs', ['--rule=utf8', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('utf8: BOM içeren dosya fail (exit 1)', () => {
  const d = tmp();
  writeFileSync(join(d, 'bom.md'), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('# bom\n')]));
  const r = run('check-hygiene.mjs', ['--rule=utf8', 'bom.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /BOM/);
});

test('utf8: geçersiz bayt dizisi fail (exit 1)', () => {
  const d = tmp();
  writeFileSync(join(d, 'bad.md'), Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));
  const r = run('check-hygiene.mjs', ['--rule=utf8', 'bad.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('utf8: metin-olmayan uzantı taranmaz (exit 0)', () => {
  const d = tmp();
  writeFileSync(join(d, 'img.png'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  const r = run('check-hygiene.mjs', ['--rule=utf8', 'img.png'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ── boş-küme körlüğü (v0.18.2, pilot bulgusu A) ──
test('utf8: git ls-files boş repo (tracked dosya yok) → taranan=0 FAIL (exit 1)', () => {
  const d = initRepo();
  const r = run('check-hygiene.mjs', ['--rule=utf8'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /taranan/i);
});

test('utf8: --allow-empty ile taranan=0 geçer (exit 0)', () => {
  const d = initRepo();
  const r = run('check-hygiene.mjs', ['--rule=utf8', '--allow-empty'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /allow-empty/);
});

test('utf8: normal taramada çıktı [taranan=N] etiketi taşır', () => {
  const d = tmp();
  const f = write(d, 'a.md', '# ok\n');
  const r = run('check-hygiene.mjs', ['--rule=utf8', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /\[taranan=1\]/);
});

// ============================================================================
// --rule=secrets (eski tests/check-secrets.test.mjs, BİREBİR taşındı)
// ============================================================================
const fakeAws = 'AKIA' + '1234567890ABCDEF';
const fakePk = '-----BEGIN ' + 'PRIVATE KEY-----\n' + 'MIIBFakeKeyDataNotRealAtAll\n' + '-----END ' + 'PRIVATE KEY-----';

test('secrets: temiz dosya geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'a.ts', 'export const sum = (x, y) => x + y;\n');
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('secrets: AWS anahtarı fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'leak.ts', `const key = "${fakeAws}";\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /AWS/);
});

test('secrets: private key fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'key.ts', `const pem = \`${fakePk}\`;\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('secrets: placeholder değer geçer (your-secret-here)', () => {
  const d = tmp();
  const f = write(d, 'env.md', '| JWT_SECRET | your-secret-here |\n');
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('secrets: env-türevi atama geçer (process.env)', () => {
  const d = tmp();
  const f = write(d, 'cfg.ts', 'const JWT_SECRET = process.env.JWT_SECRET;\n');
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('secrets: gerçek literal atama fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'cfg2.ts', 'const JWT_SECRET = "a1b2c3d4e5f6g7h8";\n');
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('secrets: maskeli rapor — değerin tamamı yazılmaz', () => {
  const d = tmp();
  const f = write(d, 'leak2.ts', `const key = "${fakeAws}";\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.ok(!r.out.includes(fakeAws), 'kapı eşleşmenin tamamını yazdırmamalı (maskeli)');
});

test('secrets: Stripe canlı anahtarı sk_live_ fail (exit 1)', () => {
  const d = tmp();
  const stripe = 'sk_' + 'live_' + '51AbCdEfGhIjKlMnOpQrStUv';
  const f = write(d, 'pay.ts', `const k = "${stripe}";\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Stripe/i);
});

test('secrets: .NET connection-string Password= fail (exit 1)', () => {
  const d = tmp();
  const conn = 'Server=db;User Id=sa;' + 'Password=' + 'Pr0dP@ss2024;';
  const f = write(d, 'appsettings.json', `{ "ConnectionStrings": { "Default": "${conn}" } }\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Password|Baglanti/i);
});

test('secrets: appsettings JSON gizli alanı "Secret" fail (exit 1)', () => {
  const d = tmp();
  const val = 'real256bit' + 'JwtSigningSecretValue9981';
  const f = write(d, 'appsettings.json', `{ "Jwt": { "Secret": "${val}" } }\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /JSON gizli|Config/i);
});

test('secrets: Azure AccountKey fail (exit 1)', () => {
  const d = tmp();
  const key = 'AccountKey=' + 'abcDEF123456789012345678901234567890ABCDEF==';
  const f = write(d, 'cfg.cs', `var conn = "DefaultEndpointsProtocol=https;${key}";\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Azure|AccountKey/i);
});

test('secrets: appsettings placeholder değer geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'appsettings.json', '{ "Jwt": { "Secret": "your-secret-here" } }\n');
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('secrets: conn-string TrustServerCertificate (Password yok) geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'appsettings.json', '{ "C": "Server=db;TrustServerCertificate=true" }\n');
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('secrets: Password=YOUR_DB_PASSWORD_HERE şablonu geçer (FP regresyonu, exit 0)', () => {
  const d = tmp();
  const f = write(d, 'appsettings.json', '{ "C": "Server=db;Password=YOUR_DB_PASSWORD_HERE;" }\n');
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('secrets: Password=YOUR_PASSWORD şablonu geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'cfg.cs', 'var c = "Server=x;Password=YOUR_PASSWORD";\n');
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('secrets: gerçek Password= değeri hâlâ fail (recall korundu, exit 1)', () => {
  const d = tmp();
  const real = 'Pr0d' + 'P@ssw0rd2024';
  const f = write(d, 'appsettings.json', `{ "C": "Server=prod;Password=${real};" }\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Password|Baglanti|Sifre/i);
});

test('secrets: Flutter .dart dosyasındaki Stripe anahtarı fail (exit 1)', () => {
  const d = tmp();
  const stripe = 'sk_' + 'live_' + '51FlutterMobileKeyAbcDef';
  const f = write(d, 'lib/config.dart', `const apiKey = "${stripe}";\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Stripe/i);
});

test('secrets: Terraform .tf password = "..." fail (exit 1)', () => {
  const d = tmp();
  const real = 'Pr0d' + 'DbP@ss2024Real';
  const f = write(d, 'main.tf', `resource "x" "y" {\n  password = "${real}"\n}\n`);
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Sifre|password/i);
});

test('secrets: Terraform password şablonu geçer (YOUR_PASSWORD_HERE, exit 0)', () => {
  const d = tmp();
  const f = write(d, 'main.tf', 'password = "YOUR_PASSWORD_HERE"\n');
  const r = run('check-hygiene.mjs', ['--rule=secrets', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ── boş-küme körlüğü (v0.18.2, pilot bulgusu A) — SADECE --all (ls-files) ŞÜPHELİ sınıf;
// staged-diff (argümansız/varsayılan) modu DOKUNULMAZ, orada 0 DOĞALDIR ──
test('secrets: staged-diff varsayılan modda taranan=0 DOĞALDIR, hâlâ exit 0 (FP olmasın)', () => {
  const d = initRepo();
  const r = run('check-hygiene.mjs', ['--rule=secrets'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('secrets: --all + tracked dosya yok → taranan=0 FAIL (exit 1)', () => {
  const d = initRepo();
  const r = run('check-hygiene.mjs', ['--rule=secrets', '--all'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /taranan/i);
});

test('secrets: --all --allow-empty ile taranan=0 geçer (exit 0)', () => {
  const d = initRepo();
  const r = run('check-hygiene.mjs', ['--rule=secrets', '--all', '--allow-empty'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /allow-empty/);
});

// ── ikinci-katman körlük: sayaç GERÇEKTEN İŞLENENİ saymalı, argümanla verilip diskte olmayan
// dosya sessizce yutulmamalı (ana ajan ölçtü 2026-08-06, placeholders'takiyle aynı sınıf) ──
test('secrets: var olmayan dosya argümanla verilince FAIL (exit 1), sessizce yutulmaz', () => {
  const d = tmp();
  const r = run('check-hygiene.mjs', ['--rule=secrets', 'YOK-BOYLE-DOSYA.ts'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /diskte\/index'te YOK/);
});

// ============================================================================
// --rule=placeholders (eski tests/check-placeholders.test.mjs, BİREBİR taşındı)
// ============================================================================
test('placeholders: doldurulmuş dosya geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'CLAUDE.md', '# Proje\nAdı: MyApp\nStack: Node\n');
  const r = run('check-hygiene.mjs', ['--rule=placeholders', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('placeholders: isimli doldurulmamış alan fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'CLAUDE.md', '# ' + '{{' + 'PROJE_ADI' + '}}\nStack: ?\n');
  const r = run('check-hygiene.mjs', ['--rule=placeholders', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /doldurulmam/i);
});

test('placeholders: {{...}} sözdizimi metni geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'GUARDS.md', 'Şablonlarda ' + '{{' + '...' + '}}' + ' biçimi kullanılır.\n');
  const r = run('check-hygiene.mjs', ['--rule=placeholders', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('placeholders: boş {{}} geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'STATE.md', 'Boş form: ' + '{{' + '}}' + ' anlatımdır.\n');
  const r = run('check-hygiene.mjs', ['--rule=placeholders', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ── boş-küme körlüğü (v0.18.2, pilot bulgusu A): argümansız mod git ls-files'ı kürate edilmiş
// bir desenle filtreler — eşleşen dosya yoksa taranan=0 ŞÜPHELİDİR (registry üretecinin sahada
// saymadığı dosyayı "güncel" sayması buradan doğdu) ──
test('placeholders: argümansız + eşleşen dosya yok → taranan=0 FAIL (exit 1)', () => {
  const d = initRepo();
  const r = run('check-hygiene.mjs', ['--rule=placeholders'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /taranan/i);
});

test('placeholders: --allow-empty ile taranan=0 geçer (exit 0)', () => {
  const d = initRepo();
  const r = run('check-hygiene.mjs', ['--rule=placeholders', '--allow-empty'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /allow-empty/);
});

test('placeholders: normal tarama [taranan=N] etiketi taşır', () => {
  const d = tmp();
  const f = write(d, 'CLAUDE.md', '# Proje\nAdı: MyApp\n');
  const r = run('check-hygiene.mjs', ['--rule=placeholders', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /\[taranan=1\]/);
});

// ── ikinci-katman körlük: sayaç NİYET EDİLENİ değil GERÇEKTEN İŞLENENİ saymalı
// (ana ajan ölçtü 2026-08-06: `--rule=placeholders YOK-BOYLE-DOSYA.md` "taranan=1" deyip exit 0
// veriyordu — dosya hiç okunmamıştı) ──
test('placeholders: var olmayan dosya argümanla verilince FAIL (exit 1) — "taranan=1" YALANI artık yok', () => {
  const d = tmp();
  const r = run('check-hygiene.mjs', ['--rule=placeholders', 'YOK-BOYLE-DOSYA.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /diskte YOK/);
  assert.doesNotMatch(r.out, /taranan=1\b/, 'kayip dosya taranan=1 sayilmamali');
});

// docs/user/ auto-discovery kapsamı (v0.18.3) — L0 son-kullanıcı makalesinde doldurulmamış {{...}}
// önceden GÖRÜNMEZDİ (filtre yalnız docs/flows|scenarios kapsıyordu). Kademeli tazelik zinciriyle
// aynı dalgada eklendi: [L0] artık argümansız taramaya girer.
test('placeholders: argümansız tarama docs/user/ altını da kapsar (doldurulmamış alan → FAIL)', () => {
  const d = initRepo();
  write(d, 'docs/user/pay.md', '# Ödeme\n\n{{DOLDURULMAMIS_ALAN}}\n');
  git(d, 'add', '-A');
  const r = run('check-hygiene.mjs', ['--rule=placeholders'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /docs\/user\/pay\.md/);
});

test('placeholders: docs/user/ altında doldurulmuş L0 dosyası geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/user/pay.md', '# Ödeme\n\nBu özellik ödeme akışını anlatır, doldurulmuş içerik.\n');
  git(d, 'add', '-A');
  const r = run('check-hygiene.mjs', ['--rule=placeholders'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('placeholders: şablon dosyası atlanan olarak GÖRÜNÜR raporlanır (yutulmaz)', () => {
  const d = tmp();
  const f1 = write(d, 'CLAUDE.md', '# Proje\nAdı: MyApp\n');
  const f2 = write(d, 'rol.template.md', '# {{ROL_ADI}}\n');
  const r = run('check-hygiene.mjs', ['--rule=placeholders', f1, f2], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /\[taranan=1\]/);
  assert.match(r.out, /atlanan=1.*rol\.template\.md/);
});

// ── model-tier deseni (eski tests/check-placeholders-model-tier.test.mjs, BİREBİR taşındı) ──
const GATE = fileURLToPath(new URL('../gates/check-hygiene.mjs', import.meta.url));

function runModelTier(content) {
  const dir = mkdtempSync(join(tmpdir(), 'ph-'));
  const f = join(dir, 'rol.md');
  writeFileSync(f, content, 'utf8');
  try {
    execFileSync(process.execPath, [GATE, '--rule=placeholders', f], { stdio: 'pipe' });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('doldurulmamis model-tier YAKALANIR (yorum icinde olsa bile)', () => {
  assert.strictEqual(runModelTier('---\nname: kasif\n# model: <kurulum anindaki en ucuz tier>\n---\n'), 1);
});

test('yorumsuz doldurulmamis model-tier de YAKALANIR', () => {
  assert.strictEqual(runModelTier('---\nname: kasif\nmodel: <orta tier>\n---\n'), 1);
});

test('doldurulmus model-tier TEMIZ', () => {
  assert.strictEqual(runModelTier('---\nname: kasif\nmodel: haiku\n---\n'), 0);
});

test('satir tamamen silinmis TEMIZ (kacis yolu calisiyor)', () => {
  assert.strictEqual(runModelTier('---\nname: kasif\n---\n'), 0);
});

test('placeholder SOZDIZIMINI anlatan metin yanlis-pozitif VERMEZ', () => {
  assert.strictEqual(runModelTier('model: <...> yazimi bir placeholder anlatir\n{{...}} da oyle\n'), 0);
});

test('eski {{ADI}} davranisi KORUNDU (regresyon)', () => {
  assert.strictEqual(runModelTier('# Rehber\nProje: {{PROJE_ADI}}\n'), 1);
});

test('doldurulmamis effort YAKALANIR (yorum icinde)', () => {
  assert.strictEqual(runModelTier('---\nname: kasif\n# effort: <low - kesif isi>\n---\n'), 1);
});

test('yorumsuz doldurulmamis effort de YAKALANIR', () => {
  assert.strictEqual(runModelTier('---\nname: hakem\neffort: <high - curutme isi>\n---\n'), 1);
});

test('doldurulmus effort TEMIZ', () => {
  assert.strictEqual(runModelTier('---\nname: kasif\neffort: low\n---\n'), 0);
});

test('effort satiri silinmis TEMIZ (kacis yolu)', () => {
  assert.strictEqual(runModelTier('---\nname: kasif\nmodel: haiku\n---\n'), 0);
});

test('model VE effort birlikte doldurulmamis -> IKISI de yakalanir', () => {
  assert.strictEqual(runModelTier('---\nname: kasif\n# model: <ucuz>\n# effort: <low>\n---\n'), 1);
});

test('effort sozdizimi-anlatimi yanlis-pozitif VERMEZ', () => {
  assert.strictEqual(runModelTier('effort: <...> yazimi bir placeholder anlatir\n'), 0);
});

// ============================================================================
// --rule=file-size (eski tests/check-file-size.test.mjs, BİREBİR taşındı)
// ============================================================================
const lines = (n) => Array.from({ length: n }, (_, i) => `satır ${i + 1}`).join('\n') + '\n';

test('file-size: rehber tavan altında geçer (exit 0)', () => {
  const d = tmp();
  write(d, 'CLAUDE.md', lines(100));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('file-size: rehber FAIL tavanını (300) aşınca fail (exit 1)', () => {
  const d = tmp();
  write(d, 'CLAUDE.md', lines(320));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'CLAUDE.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /REHBER/);
});

// --- SKILL.md kapsamı + circir (v0.25): kural MEKANIKSIZDI, mekanizmaya baglandi ---
test('file-size: 🔴 SKILL.md REHBER sayılır — 300 tavanını aşınca fail (v0.25: kural mekanizmasızdı)', () => {
  const d = tmp();
  write(d, 'SKILL.md', lines(320));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'SKILL.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /REHBER/);
});

test('file-size: GEÇİRME — SKILL.md tavan altındaysa bloke edilmez (exit 0)', () => {
  const d = tmp();
  write(d, 'SKILL.md', lines(120));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'SKILL.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('file-size: CIRCIR — muaf-listedeki dosya tavanında geçer, BÜYÜYÜNCE fail', () => {
  const d = tmp();
  write(d, 'scripts/size-baseline.json', JSON.stringify({ 'SKILL.md': 400 }));
  write(d, 'SKILL.md', lines(399));          // tavanın altında → geçer
  const ok = run('check-hygiene.mjs', ['--rule=file-size', 'SKILL.md'], d);
  write(d, 'SKILL.md', lines(420));          // tavanı aştı → FAIL
  const grown = run('check-hygiene.mjs', ['--rule=file-size', 'SKILL.md'], d);
  cleanup(d);
  assert.equal(ok.status, 0, ok.out);
  assert.equal(grown.status, 1, grown.out);
  assert.match(grown.out, /BUYUYEMEZ|buyumus/);
});

test('file-size: kod FAIL tavanını (1000) aşınca fail (exit 1)', () => {
  const d = tmp();
  write(d, 'big.ts', lines(1100));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'big.ts'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('file-size: kod WARN bandı (500-1000) geçer (exit 0)', () => {
  const d = tmp();
  write(d, 'mid.ts', lines(600));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'mid.ts'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('file-size: baseline muafiyeti büyümeyi engeller (exit 1)', () => {
  const d = tmp();
  write(d, 'scripts/size-baseline.json', JSON.stringify({ 'big.ts': 1100 }));
  write(d, 'big.ts', lines(1150));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'big.ts'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /buyumus|muaf/i);
});

test('file-size: baseline muaf dosya tavanda kalırsa geçer (exit 0)', () => {
  const d = tmp();
  write(d, 'scripts/size-baseline.json', JSON.stringify({ 'big.ts': 1200 }));
  write(d, 'big.ts', lines(1150));
  const r = run('check-hygiene.mjs', ['--rule=file-size', 'big.ts'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ============================================================================
// --rule=report-schema (v0.18.6, panel kararı 2026-08-06 — YAPISAL, BLOKE eder)
// ============================================================================
test('report-schema: keşif raporunda ÖNERİ başlığı fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'rapor.md',
    '# RAPOR\n\n| OLGU | KANIT_REFERANSI | SINIR | AÇIK_SORU |\n|---|---|---|---|\n| x | y:1 | - | - |\n\n## ÖNERİ\n\nBunu yap.\n');
  const r = run('check-hygiene.mjs', ['--rule=report-schema', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /YASAK/);
});

test('report-schema: keşif raporunda KARAR başlığı fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'rapor2.md',
    '# RAPOR\n\nOLGU: x\nKANIT_REFERANSI: y:1\n\n**KARAR**\n\nDevam et.\n');
  const r = run('check-hygiene.mjs', ['--rule=report-schema', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('report-schema: OLGU/KANIT_REFERANSI olmayan normal .md dosyasında ÖNERİ başlığı SERBEST (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'normal.md', '# Plan\n\n## ÖNERİ\n\nBu bir plan dosyasıdır, keşif raporu değildir.\n');
  const r = run('check-hygiene.mjs', ['--rule=report-schema', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('report-schema: temiz keşif raporu (yasak başlık yok) geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'rapor3.md', '# RAPOR\n\n| OLGU | KANIT_REFERANSI | SINIR | AÇIK_SORU |\n|---|---|---|---|\n| x | y:1 | - | - |\n');
  const r = run('check-hygiene.mjs', ['--rule=report-schema', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('report-schema: .template.md dosyası MUAF (şablon şemayı tarif eder), exit 0', () => {
  const d = tmp();
  const f = write(d, 'rapor.template.md', '# RAPOR\n\nOLGU: ...\nKANIT_REFERANSI: ...\n\n## ÖNERİ\n(şablon alanı — doldurulacak)\n');
  const r = run('check-hygiene.mjs', ['--rule=report-schema', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /atlanan/);
});

test('report-schema: var olmayan dosya argümanla verilince FAIL (exit 1)', () => {
  const d = tmp();
  const r = run('check-hygiene.mjs', ['--rule=report-schema', 'YOK-BOYLE-DOSYA.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /diskte YOK/);
});

// ============================================================================
// --rule=message-clarity (v0.18.6, panel kararı 2026-08-06 — ÜSLUP, varsayılan UYARI)
// ============================================================================
test('message-clarity: eylem satırı (→) olmayan UYARI varsayılanda exit 0 + bulgu üretir', () => {
  const d = tmp();
  const f = write(d, 'gates/check-fake.mjs', "console.error('Bir seyler ters gitti, düzelt.');\n");
  const r = run('check-hygiene.mjs', ['--rule=message-clarity', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
  assert.match(r.out, /eylem satırı/);
});

test('message-clarity: aynı eylemsiz mesaj --strict ile exit 1 verir', () => {
  const d = tmp();
  const f = write(d, 'gates/check-fake2.mjs', "console.error('Bir seyler ters gitti, düzelt.');\n");
  const r = run('check-hygiene.mjs', ['--rule=message-clarity', '--strict', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /FAIL/);
});

test('message-clarity: → eylem satırı taşıyan mesaj temiz geçer (exit 0, bulgu yok)', () => {
  const d = tmp();
  const f = write(d, 'gates/check-fake3.mjs', "console.error('Hata olustu.\\n  Duzeltme: → dosyayi kontrol et.');\n");
  const r = run('check-hygiene.mjs', ['--rule=message-clarity', '--strict', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('message-clarity: --json/JSON_OUT yolundaki çıplak kod-adı MUAFTIR (yakalanmaz)', () => {
  const d = tmp();
  const f = write(d, 'gates/check-fake4.mjs',
    "if (JSON_OUT) { console.error(JSON.stringify({ rule: 'no-arrow-code' })); }\n");
  const r = run('check-hygiene.mjs', ['--rule=message-clarity', '--strict', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('message-clarity: çıplak [kebab-case] kod-adı düz açıklamasız varsayılanda bulgu üretir', () => {
  const d = tmp();
  const f = write(d, 'gates/check-fake5.mjs', "console.warn('[orphan-gates]');\n");
  const r = run('check-hygiene.mjs', ['--rule=message-clarity', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /çıplak kod-adı/);
});

test('message-clarity: var olmayan dosya argümanla verilince FAIL (exit 1)', () => {
  const d = tmp();
  const r = run('check-hygiene.mjs', ['--rule=message-clarity', 'YOK-BOYLE-DOSYA.mjs'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /diskte YOK/);
});

// ============================================================================
// --rule=surface-residue (v0.23.0, K55 ①)
// Kaynak ÖLÇÜM: 137 oturum / 158 doğrulanmış S2 vakası (2026-08-27).
// Fixture'lar UYDURMA DEĞİL — gerçek vakalardan alındı (FIN-LEDGER-PLAN.md, is-asistani-plan.md).
// ============================================================================
test('surface-residue: temiz kalıcı belge geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'RAPOR.md', '# Analiz\n\n## Bulgular\nSistem X kullanıyor.\nÖlçüm: 42 kayıt.\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('surface-residue: üstü çizili düzeltme fail (exit 1) — gerçek vaka FIN-LEDGER-PLAN.md', () => {
  const d = tmp();
  const f = write(d, 'PLAN.md', '# Plan\n\n~~**QNB kapsamı belirsiz**~~ → **ÇÖZÜLDÜ: QNB = Enpara.**\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /üstü-çizili/i);
});

test('surface-residue: "düzeltildi" başlığı fail (exit 1) — gerçek vaka is-asistani-plan.md', () => {
  const d = tmp();
  const f = write(d, 'PLAN.md', '# Plan\n\n## Şema (v2 — GLM 5.2 eleştirisi sonrası düzeltildi)\nAkış.\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /düzeltildi/i);
});

test('surface-residue: "önceki YANLIŞTI" itirafı fail (exit 1) — gerçek vaka ai-analytics.md', () => {
  const d = tmp();
  const f = write(d, 'T-ai.md', '# AI\n\nÖnceki iki iddia FAKTÜEL YANLIŞTI, düzeltildi.\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('surface-residue: GÜNCELLEME damgası fail (exit 1) — gerçek vaka siparis-limiti.md', () => {
  const d = tmp();
  const f = write(d, 'politika.md', '# Politika\n\nGÜNCELLEME 2026-08-04 (çoklu-model denetim)\nKural X.\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

// GEÇİRME deneyleri (altın kural ②b: kapı İKİ kontrolle doğar — yoksa yanlış-alarma boğulur)
test('surface-residue: karar defterinde artık MEŞRU — muaf (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'v0.9-KARAR-DEFTERI.md', '# Defter\n\n~~eski karar~~ → revize edildi 2026-01-01\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /muaf=1/);
});

test('surface-residue: archive/ altı dondurulmuş tarih — muaf (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'archive/eski-plan.md', '# Eski\n\n~~yapılacak~~ → yapıldı\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('surface-residue: yol haritası bölümünde üstü çizili MEŞRU (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'README.md',
    '# Proje\n\n## Kurulum\nnpm i\n\n## v1.0 yol haritası\n1. ~~**Eski açık**~~ v0.8de kapatıldı.\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('surface-residue: bölüm muafiyeti SONRAKİ bölümde biter (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'README.md',
    '# P\n\n## v1.0 yol haritası\n1. ~~kapandı~~ tamam.\n\n## Mimari\n~~**Eski tasarım**~~ → yeni.\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Mimari|:7/);
});

// NEGATİF DENEY (MADDE 15) — "temiz" ile "hiç bakmadım" ayrımı
test('surface-residue: var olmayan dosya argümanla verilince FAIL (exit 1) — "taranan=1" YALANI yok', () => {
  const d = tmp();
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', 'YOK-BOYLE-DOSYA.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /diskte YOK/);
  assert.doesNotMatch(r.out, /taranan=1/);
});

test('surface-residue: GERÇEK boş küme FAIL (muafiyet yok, dosya yok → "hiç bakmadım")', () => {
  const d = initRepo();              // tracked dosya yok → git ls-files boş → scanned=0
  const r = run('check-hygiene.mjs', ['--rule=surface-residue'], d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /taranan dosya sayisi 0/);
  const r2 = run('check-hygiene.mjs', ['--rule=surface-residue', '--allow-empty'], d);
  cleanup(d);
  assert.equal(r2.status, 0, r2.out);
});

test('surface-residue: TAMAMI muaf küme "bakmadım" DEĞİL — geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'v0.1-KARAR-DEFTERI.md', '# D\n~~x~~ revize edildi\n');
  const r = run('check-hygiene.mjs', ['--rule=surface-residue', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /muaf=1/);
});
