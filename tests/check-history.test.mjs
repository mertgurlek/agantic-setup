import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initRepo, write, git, run, cleanup } from './helpers.mjs';

// check-history.mjs = check-append-only + check-co-update + check-stale-constants birleşimi
// (v0.16 konsolidasyonu). Test-case sayısı BİREBİR korunur — çağrı şekli değişir:
// run('check-history.mjs', ['--rule=<ad>', ...eskiArgv]).

// ============================================================================
// --rule=append-only (eski tests/check-append-only.test.mjs, BİREBİR taşındı)
// ============================================================================
const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'gates', 'check-history.mjs');
// env destekli koşum (APPEND_ONLY_EXTRA için) — helpers.run env geçirmiyor.
function runEnv(args, cwd, env) {
  const r = spawnSync(process.execPath, [GATE, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}

test('append-only: yalnız satır ekleme geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/DECISIONS.md', '- karar 1\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  write(d, 'docs/DECISIONS.md', '- karar 1\n- karar 2\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=append-only'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('append-only: eski satır silme/değiştirme fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'docs/DECISIONS.md', '- karar 1\n- karar 2\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  write(d, 'docs/DECISIONS.md', '- karar 2\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=append-only'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /append-only/i);
});

test('append-only: append-only olmayan dosya değişikliği serbest (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/notes.md', 'satır 1\nsatır 2\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/notes.md', 'tamamen yeni içerik\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=append-only'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('append-only: APPEND_ONLY_EXTRA ile ek dosyada satır silme fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'v0.8-KARAR-DEFTERI.md', '- karar 1\n- karar 2\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  write(d, 'v0.8-KARAR-DEFTERI.md', '- karar 2\n');
  git(d, 'add', '-A');
  const r = runEnv(['--rule=append-only'], d, { APPEND_ONLY_EXTRA: 'v0.8-KARAR-DEFTERI.md' });
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /append-only/i);
});

test('append-only: GARDEN_LOG sabit listede — eski satır silme fail (env\'siz, exit 1)', () => {
  const d = initRepo();
  write(d, 'docs/GARDEN_LOG.md', '- drift 1\n- drift 2\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  write(d, 'docs/GARDEN_LOG.md', '- drift 2\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=append-only'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /append-only/i);
});

test('append-only: GARDEN_LOG\'a yalnız satır ekleme geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/GARDEN_LOG.md', '- drift 1\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  write(d, 'docs/GARDEN_LOG.md', '- drift 1\n- drift 2\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=append-only'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('append-only: APPEND_ONLY_EXTRA env yokken aynı dosya korunmaz (geriye-uyum, exit 0)', () => {
  const d = initRepo();
  write(d, 'v0.8-KARAR-DEFTERI.md', '- karar 1\n- karar 2\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  write(d, 'v0.8-KARAR-DEFTERI.md', '- karar 2\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=append-only'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ============================================================================
// --rule=co-update (eski tests/check-co-update.test.mjs, BİREBİR taşındı)
// ============================================================================
test('co-update: yüzey değişti, companion yok → --strict fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'components/Btn.tsx', 'export const Btn = () => null;\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=co-update', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TRIPWIRE/i);
});

test('co-update: companion da güncellenmiş → geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'components/Btn.tsx', 'export const Btn = () => null;\n');
  write(d, 'docs/PRODUCT_LOG.md', '- buton görünürlüğü değişti\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=co-update', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('co-update: 🔴 companion\'a SADECE BOŞLUK eklenmiş (kozmetik oyunlama) → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/flows/giris.md', '# Giris\nAdim 1.\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'components/Login.tsx', 'export const L = () => null;\n');
  write(d, 'docs/flows/giris.md', '# Giris\nAdim 1.\n \n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=co-update', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /KOZMETİK DOKUNUŞ/);
});

test('co-update: companion\'a GERÇEK içerik eklenmiş → geçer (dürüst güncelleme cezalandırılmaz)', () => {
  const d = initRepo();
  write(d, 'docs/flows/giris.md', '# Giris\nAdim 1.\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'components/Login.tsx', 'export const L = () => null;\n');
  write(d, 'docs/flows/giris.md', '# Giris\nAdim 1.\nAdim 2: SMS 2FA kodu.\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=co-update', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('co-update: --strict yok → uyarı ama exit 0 (varsayılan)', () => {
  const d = initRepo();
  write(d, 'components/Btn.tsx', 'export const Btn = () => null;\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=co-update'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('co-update: yalnız iç dosya değişti → tripwire ateşlemez (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/util.ts', 'export const x = 1;\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=co-update', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ============================================================================
// --rule=stale-constants (eski tests/check-stale-constants.test.mjs, BİREBİR taşındı)
// ============================================================================
function role(d, name, body) {
  write(d, `.claude/agents/${name}.md`, body);
  git(d, 'add', '-A');
}

test('stale-constants: 🔴 gerçek pilot vakası ("120 hata sınırı") → --strict FAIL', () => {
  const d = initRepo();
  role(d, 'uygulayici', 'Kurallar:\n- 120 hata sınırını aşma; üstüne çıkarsan iş kapanmaz.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /BAYAT-SABİT FAIL/);
  assert.match(r.out, /hata sayısı/);
});

test('stale-constants: 🔴 gömülü test sayısı ("233 test yeşil") → --strict FAIL', () => {
  const d = initRepo();
  role(d, 'hakem', 'Doğrula:\n- Baseline 233 test yeşil olmalı.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /test sayısı/);
});

test('stale-constants: 🔴 gömülü kapsam oranı ("%82 kapsam") → --strict FAIL', () => {
  const d = initRepo();
  role(d, 'qa-gezgini', 'Kontrol:\n- Kapsam %82 altına düşmemeli.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /kapsam oranı/);
});

test('stale-constants: --strict verilmezse UYARI verir ama engellemez (exit 0)', () => {
  const d = initRepo();
  role(d, 'uygulayici', '- 120 hata sınırını aşma.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /BAYAT-SABİT UYARI/);
});

test('stale-constants: ⭐ DOĞRU YAZIM (kaynağa işaret) → temiz geçer', () => {
  const d = initRepo();
  role(d, 'uygulayici', 'Kurallar:\n- Güncel hata sınırını BASELINE.md\'den oku; üstüne çıkma.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: madde/adım numarası ("madde 10", "ADIM 1-10") MUAF', () => {
  const d = initRepo();
  role(d, 'hakem', '- madde 10: dış-modele denetlet.\n- ADIM 1-10 sırayla koşulur.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: sürüm ("v0.12") ve satır tavanı ("≤40 satır") MUAF', () => {
  const d = initRepo();
  role(d, 'kasif', '- v0.12 sözleşmesine uy.\n- Rol dosyası tavanı ≤40 satır.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: eksen sayısı ("3-eksen") MUAF', () => {
  const d = initRepo();
  role(d, 'uygulayici', '- Dokunulan akışı 3-eksen kontrolünden geçir.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: doldurulmamış şablon alanı ({{TEST_SAYISI}}) MUAF (placeholders kapısının işi)', () => {
  const d = initRepo();
  role(d, 'uygulayici', '- {{TEST_SAYISI}} test yeşil olmalı.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: açıkça "ör." ile yazılmış örnek sayı MUAF', () => {
  const d = initRepo();
  role(d, 'hakem', '- Baseline sapmasını bildir (ör. 12 hata eklendiyse).\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: kural metninin KARŞI-ÖRNEĞİ (❌/✅ satırı) MUAF', () => {
  const d = initRepo();
  role(d, 'uygulayici', '- ❌ "120 hata sınırını aşma" → ✅ "sınırı BASELINE.md\'den oku".\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: tarihli telemetri/ölçüm kaydı (gerekçe metni) MUAF', () => {
  const d = initRepo();
  role(d, 'kasif', '- Telemetri (2026-07-22): opus %84 / haiku %0,2 — tiering tersine dönmüştü.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: KAYNAK ATFI satırı ("Kaynak: pilot geri bildirimi — 120 hata") MUAF', () => {
  const d = initRepo();
  role(d, 'hakem', '- (Kaynak: pilot geri bildirimi — "120 hata" yazıyordu, gerçek 117\'ye düştü.)\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: 🔴 talimat satırının SONUNA "(bkz. …)" eklemek bayat sabiti AFFETMEZ', () => {
  const d = initRepo();
  role(d, 'uygulayici', '- Baseline 999 test yeşil olmalı (bkz. STATE.md)\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /test sayısı/);
});

test('stale-constants: 🔴 satır sonuna "MUAF" yazmak bayat sabiti affetmez', () => {
  const d = initRepo();
  role(d, 'uygulayici', '- 999 test yeşil olmalı MUAF\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('stale-constants: 🔴 satır sonuna "YASAK" yazmak bayat sabiti affetmez', () => {
  const d = initRepo();
  role(d, 'uygulayici', '- 888 test yeşil olmalı YASAK\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('stale-constants: 🔴 TARİHSİZ "(telemetri kaydı)" bayat sabiti affetmez', () => {
  const d = initRepo();
  role(d, 'uygulayici', '- 777 test yeşil olmalı (telemetri kaydı)\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('stale-constants: 🔴 satır ORTASINDA sürüm anmak ("…, v0.12 baseline") affetmez', () => {
  const d = initRepo();
  role(d, 'uygulayici', '- 999 test yeşil olmalı, v0.12 baseline\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('stale-constants: ⭐ sertleştirme sonrası meşru muafiyetler KORUNDU (tarihli telemetri)', () => {
  const d = initRepo();
  role(d, 'kasif', '- Telemetri (2026-07-22): opus %84 / haiku %0,2 — tiering tersine dönmüştü.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: rol dosyası DIŞINDAKİ dosyalar taranmaz (README\'de sayı serbest)', () => {
  const d = initRepo();
  write(d, 'README.md', '233 test yeşil, 120 hata var.\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no-op/);
});

test('stale-constants: staged rol dosyası yoksa no-op (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/x.ts', 'export const a = 1;\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('stale-constants: dosya argümanla da verilebilir (staged olmasa bile taranır)', () => {
  const d = initRepo();
  write(d, '.claude/agents/uygulayici.md', '- 120 hata sınırını aşma.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict', '.claude/agents/uygulayici.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('stale-constants: rol-dosyası deseni dışındaki yol ARGÜMANLA verilirse yine de taranır', () => {
  const d = initRepo();
  write(d, 'templates/roller.md', '- 120 hata sınırını aşma.\n');
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict', 'templates/roller.md'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('stale-constants: var olmayan yol argümanı → "TARAMA YAPILMADI" der (temiz DEMEZ)', () => {
  const d = initRepo();
  const r = run('check-history.mjs', ['--rule=stale-constants', '--strict', 'yok/olmayan.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /TARAMA YAPILMADI/);
  assert.doesNotMatch(r.out, /OK —/);
});

// ============================================================================
// --rule=friction-repeat (v0.20 — pilot geri bildirimi 2026-08-11 §5.5)
// Triyaj disiplinini mekanikleştirir: (a) yeni girdi "Mekanizma-adayı" taşır,
// (b) eşiği aşmış AÇIK girdiler NOT olarak görünür (bloke ETMEZ).
// İKİ YÖNLÜ DOĞUM (doctrine v0.20): yakalama + geçirme kontrolü birlikte.
// ============================================================================
const LOG_BASLIK = [
  '# Sürtünme Günlüğü (append-only)', '',
  '| Tarih | Hangi kural/kapı | Ne engelledi/yanılttı | Tekrar mı | Onaylayan |',
  '|-------|------------------|------------------------|-----------|-----------|',
].join('\n');

test('friction-repeat: staged günlük yoksa no-op (exit 0)', () => {
  const d = initRepo();
  write(d, 'x.txt', 'a');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=friction-repeat', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no-op/);
});

test('friction-repeat: GEÇİRME — Mekanizma-adayı taşıyan yeni girdi temiz geçer (--strict)', () => {
  const d = initRepo();
  write(d, 'docs/FRICTION_LOG.md', LOG_BASLIK + '\n' +
    '| 2026-08-11 | file-size kapısı | Tavan bloke etti. Mekanizma-adayı: muafiyet listesi üreteci. | 1. | insan onayı bekliyor |\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=friction-repeat', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('friction-repeat: GEÇİRME — dürüst "Mekanizma-adayı: YOK (E2)" de kabul edilir', () => {
  const d = initRepo();
  write(d, 'docs/FRICTION_LOG.md', LOG_BASLIK + '\n' +
    '| 2026-08-11 | hakem töreni | Küçük işte ağır geldi. Mekanizma-adayı: YOK (E2) | 1. | insan onayı bekliyor |\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=friction-repeat', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('friction-repeat: YAKALAMA — Mekanizma-adayı taşımayan yeni girdi → --strict exit 1', () => {
  const d = initRepo();
  write(d, 'docs/FRICTION_LOG.md', LOG_BASLIK + '\n' +
    '| 2026-08-11 | co-update kapısı | Yanlış-pozitif verdi, iki tur kaybettim. | 1. | insan onayı bekliyor |\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=friction-repeat', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Mekanizma-aday/);
});

test('friction-repeat: VARSAYILAN uyarıdır — bulgu varken bayraksız exit 0', () => {
  const d = initRepo();
  write(d, 'docs/FRICTION_LOG.md', LOG_BASLIK + '\n' +
    '| 2026-08-11 | bir kapı | mekanizma önerisi yok | 1. | insan onayı bekliyor |\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=friction-repeat'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
});

test('friction-repeat: eşiği aşmış AÇIK girdi NOT olarak görünür ama BLOKE ETMEZ', () => {
  const d = initRepo();
  write(d, 'docs/FRICTION_LOG.md', LOG_BASLIK + '\n' +
    '| 2026-08-11 | elle sayı senkronu | Üçüncü kez yaşandı. Mekanizma-adayı: health --fix yazsın. | 3. — EŞİK AŞILDI | insan onayı bekliyor |\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=friction-repeat', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);          // NOT tek başına FAIL vermez
  assert.match(r.out, /eşiği .*aşmış|EŞİK/i);
});

test('friction-repeat: KAPANMIŞ eşik girdisi NOT listesine girmez (yanlış-pozitif önlemi)', () => {
  const d = initRepo();
  write(d, 'docs/FRICTION_LOG.md', LOG_BASLIK + '\n' +
    '| 2026-08-11 | elle sayı senkronu | Kapandı. Mekanizma-adayı: eklendi. | 3. | süpervizör (2026-08-11) |\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=friction-repeat', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /eşiği/i);
});

test('friction-repeat: tablo başlığı/ayraç satırı bulgu üretmez', () => {
  const d = initRepo();
  write(d, 'docs/FRICTION_LOG.md', LOG_BASLIK + '\n');
  git(d, 'add', '-A');
  const r = run('check-history.mjs', ['--rule=friction-repeat', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ── v0.30.4: append-only --all (taban karşılaştırması; saha saha-D KOK-8a) ──
function aoRepo() {
  const d = initRepo();
  write(d, 'docs/DECISIONS.md', '- karar 1\n- karar 2\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init'); git(d, 'branch', '-M', 'main');
  git(d, 'checkout', '-q', '-b', 'pr');
  return d;
}
test('append-only --all: PR aralığında defterden satır silindi → FAIL (exit 1); staged boş olsa da', () => {
  const d = aoRepo();
  write(d, 'docs/DECISIONS.md', '- karar 2\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'sil');
  const r = run('check-history.mjs', ['--rule=append-only', '--all'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /append-only/i);
});
test('append-only --all: yalnız ekleme → OK, denetlenen sayı görünür (exit 0)', () => {
  const d = aoRepo();
  write(d, 'docs/DECISIONS.md', '- karar 1\n- karar 2\n- karar 3\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'ekle');
  const r = run('check-history.mjs', ['--rule=append-only', '--all'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 defter dosyasi denetlendi/);
});
test('append-only --all: APPEND_ONLY_TABAN açık taban kullanılır (exit 1); AÇIKÇA verilen ama çözülemeyen taban FAIL (sessiz atlanmaz)', () => {
  const d = aoRepo();
  write(d, 'docs/DECISIONS.md', '- karar 2\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'sil');
  const ok = run('check-history.mjs', ['--rule=append-only', '--all'], d, { APPEND_ONLY_TABAN: 'main' });
  const yok = run('check-history.mjs', ['--rule=append-only', '--all'], d, { APPEND_ONLY_TABAN: 'yok-dal' });
  const tire = run('check-history.mjs', ['--rule=append-only', '--all'], d, { APPEND_ONLY_TABAN: '--output=x' });
  cleanup(d);
  assert.equal(ok.status, 1, ok.out);
  assert.equal(yok.status, 1, yok.out);
  assert.match(yok.out, /çözülemedi/);
  assert.equal(tire.status, 1, tire.out);
});
test('append-only --all: taban HİÇ yoksa "ATLANDI" ilanı + fetch-depth ipucu (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/DECISIONS.md', '- karar 1\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init'); git(d, 'branch', '-M', 'topic');
  const r = run('check-history.mjs', ['--rule=append-only', '--all'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /ATLANDI/);
  assert.match(r.out, /fetch-depth: 0/);
});
