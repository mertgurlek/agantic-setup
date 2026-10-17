import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { tmp, write, run, git, initRepo, cleanup } from './helpers.mjs';

// check-self-registry.mjs = check-rule-contracts + check-orphan-gates + check-design-tokens
// birleşimi (v0.16 konsolidasyonu). Test-case sayısı BİREBİR korunur — çağrı şekli değişir:
// run('check-self-registry.mjs', ['--rule=<ad>', ...eskiArgv]).
//
// check-orphan-gates fixture'ları v0.16'da 4→3 KONTROLE indirilen mantığa uyarlandı: docs/GUARDS.md
// artık yok, "(hedef repo)" muafiyeti CONTRACT.md'nin kapı satırında aranır (adım 11'de zaten
// gates/check-orphan-gates.mjs'te yapılan değişiklik, burada aynen taşınır).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATE = 'check-self-registry.mjs';

// ============================================================================
// --rule=rule-contracts (eski tests/check-rule-contracts.test.mjs, BİREBİR taşındı)
// ============================================================================
const TABLO = JSON.stringify([{
  file: 'doc.md',
  headings: ['## Kimlik'],
  patterns: [['kimlik cümlesi', 'kurulum süreci'], ['yasak cümlesi', 'dalkavukluk yasak', 'i']],
}]);

const TAM_DOC = '# Başlık\n\n## Kimlik\n\nBu bir kurulum süreci ürünüdür.\nDalkavukluk yasak.\n';

test('zorunlu cümle eksikse --strict FAIL (exit 1)', () => {
  const d = tmp();
  write(d, 'tablo.json', TABLO);
  write(d, 'doc.md', '# Başlık\n\n## Kimlik\n\nBu bir kurulum süreci ürünüdür.\n');
  const r = run(GATE, ['--rule=rule-contracts', '--strict', '--table=tablo.json'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /zorunlu cümle yok/);
  assert.match(r.out, /yasak cümlesi/);
  cleanup(d);
});

test('zorunlu başlık eksikse --strict FAIL', () => {
  const d = tmp();
  write(d, 'tablo.json', TABLO);
  write(d, 'doc.md', '# Başlık\n\nkurulum süreci — dalkavukluk yasak.\n');
  const r = run(GATE, ['--rule=rule-contracts', '--strict', '--table=tablo.json'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /başlık yok/);
  cleanup(d);
});

test('sözleşme hedefi dosya YOKSA da FAIL — işaret silinerek kapıdan kaçılmaz (ECC dersi)', () => {
  const d = tmp();
  write(d, 'tablo.json', TABLO);
  const r = run(GATE, ['--rule=rule-contracts', '--strict', '--table=tablo.json'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /DOSYA YOK/);
  cleanup(d);
});

test('regex bayrağı çalışır: "i" ile büyük/küçük harf farkı affedilir', () => {
  const d = tmp();
  write(d, 'tablo.json', TABLO);
  write(d, 'doc.md', '# B\n\n## Kimlik\n\nkurulum süreci.\nDALKAVUKLUK YASAK.\n');
  const r = run(GATE, ['--rule=rule-contracts', '--strict', '--table=tablo.json'], d);
  assert.equal(r.status, 0);
  cleanup(d);
});

test('bulgu varken --strict YOKSA uyarı basar ama exit 0 (opt-in kalıbı)', () => {
  const d = tmp();
  write(d, 'tablo.json', TABLO);
  write(d, 'doc.md', '# Başlık\n');
  const r = run(GATE, ['--rule=rule-contracts', '--table=tablo.json'], d);
  assert.equal(r.status, 0);
  assert.match(r.out, /UYARI/);
  cleanup(d);
});

test('tüm başlık/cümleler yerindeyse exit 0', () => {
  const d = tmp();
  write(d, 'tablo.json', TABLO);
  write(d, 'doc.md', TAM_DOC);
  const r = run(GATE, ['--rule=rule-contracts', '--strict', '--table=tablo.json'], d);
  assert.equal(r.status, 0);
  assert.match(r.out, /Rule-contracts OK/);
  cleanup(d);
});

test('tablo dosyası yoksa exit 1 — "temiz" ile "hiç bakmadım" karıştırılmaz', () => {
  const d = tmp();
  const r = run(GATE, ['--rule=rule-contracts', '--table=yok.json'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /okunamadı/);
  cleanup(d);
});

test('tablo bozuk JSON ise exit 1', () => {
  const d = tmp();
  write(d, 'tablo.json', '{bozuk');
  const r = run(GATE, ['--rule=rule-contracts', '--table=tablo.json'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /parse edilemedi/);
  cleanup(d);
});

test('repoOnly girdi: dosya YOKSA bulgu üretmez (bundle bağlamı), VARSA desenleri zorlar', () => {
  const d = tmp();
  const tablo = JSON.stringify([{ file: 'rol.md', repoOnly: true, patterns: [['verdict', 'KALDI']] }]);
  write(d, 'tablo.json', tablo);
  let r = run(GATE, ['--rule=rule-contracts', '--strict', '--table=tablo.json'], d);
  assert.equal(r.status, 0);
  assert.match(r.out, /repoOnly atlandı/);
  write(d, 'rol.md', '# rol (verdict kelimesi yok)\n');
  r = run(GATE, ['--rule=rule-contracts', '--strict', '--table=tablo.json'], d);
  assert.equal(r.status, 1);
  cleanup(d);
});

test('dogfood: gömülü sözleşme paketin kendi kökünde temiz geçer', () => {
  const r = run(GATE, ['--rule=rule-contracts', '--strict'], ROOT);
  assert.equal(r.status, 0, `paketin kendi doktrin sözleşmesi delik: ${r.out}`);
});

// ============================================================================
// --rule=orphan-gates (eski tests/check-orphan-gates.test.mjs — v0.16'da 4→3 KONTROLE
// uyarlandı: docs/GUARDS.md yok, "(hedef repo)" muafiyeti CONTRACT.md satırında aranır.
// v0.18.2 (pilot bulgusu B): 3→4 KONTROL — test dosyasının negatif-deney (exit 1 bekleyen)
// İÇERMESİ de aranır, YALNIZ VARLIĞI değil. tamFixture bu yüzden negatif assertion TAŞIR.)
// ============================================================================
function tamFixture(d) {
  write(d, 'gates/check-foo.mjs', '// sahte kapı\n');
  write(d, 'tests/check-foo.test.mjs', "assert.equal(r.status, 1, 'kirli girdi fail etmeli');\n");
  write(d, 'CONTRACT.md', '| `gates/check-foo.mjs` | KALİTE | ... | ... | — |\n');
  write(d, 'verify.mjs', "const steps = [['foo', ['gates/check-foo.mjs']]];\n");
}

test('dört kayıt da varsa exit 0', () => {
  const d = tmp();
  tamFixture(d);
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0);
  assert.match(r.out, /Orphan-gates OK/);
  cleanup(d);
});

test('CONTRACT satırı yoksa --strict FAIL', () => {
  const d = tmp();
  tamFixture(d);
  write(d, 'CONTRACT.md', '# Sözleşme (kapı satırı yok)\n');
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /CONTRACT\.md kayıt satırı yok/);
  cleanup(d);
});

test('birim testi yoksa --strict FAIL (v0.11 vakasının tersi de yakalanır)', () => {
  const d2 = tmp();
  write(d2, 'gates/check-foo.mjs', '// sahte kapı\n');
  write(d2, 'CONTRACT.md', '| `gates/check-foo.mjs` | ... |\n');
  write(d2, 'verify.mjs', "['gates/check-foo.mjs']\n");
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d2);
  assert.equal(r.status, 1);
  assert.match(r.out, /tests\/check-foo\.test\.mjs yok/);
  cleanup(d2);
});

// ── negatif-deney kanıtı (v0.18.2, pilot bulgusu B) ──
test('test dosyası VAR ama negatif deney YOK → --strict FAIL (boş/pozitif-only test dosyası artık yetmez)', () => {
  const d = tmp();
  write(d, 'gates/check-foo.mjs', '// sahte kapı\n');
  write(d, 'tests/check-foo.test.mjs', "assert.equal(r.status, 0, 'yalnizca pozitif deney');\n");
  write(d, 'CONTRACT.md', '| `gates/check-foo.mjs` | KALİTE | ... | ... | — |\n');
  write(d, 'verify.mjs', "const steps = [['foo', ['gates/check-foo.mjs']]];\n");
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /negatif deney yok/);
  assert.match(r.out, /KANITSIZ/);
  cleanup(d);
});

test('boş test dosyası → --strict FAIL (pilot vakası: exit kodu hiç set edilmemiş kapı sessizce geçiyordu)', () => {
  const d = tmp();
  write(d, 'gates/check-foo.mjs', '// sahte kapı\n');
  write(d, 'tests/check-foo.test.mjs', '// sahte test — hicbir assertion yok\n');
  write(d, 'CONTRACT.md', '| `gates/check-foo.mjs` | KALİTE | ... | ... | — |\n');
  write(d, 'verify.mjs', "const steps = [['foo', ['gates/check-foo.mjs']]];\n");
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /negatif deney yok/);
  cleanup(d);
});

test('assert.strictEqual varyasyonu da negatif deney sayılır (exit 0)', () => {
  const d = tmp();
  write(d, 'gates/check-foo.mjs', '// sahte kapı\n');
  write(d, 'tests/check-foo.test.mjs', "assert.strictEqual(result.status, 1);\n");
  write(d, 'CONTRACT.md', '| `gates/check-foo.mjs` | KALİTE | ... | ... | — |\n');
  write(d, 'verify.mjs', "const steps = [['foo', ['gates/check-foo.mjs']]];\n");
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0, r.out);
  cleanup(d);
});

// ── FP koruması: kapsam hakem turunda GENİŞLETİLDİ (v0.18.2, U1) ──
// Dar regex hedef repoda meşru test stillerini yanlış suçlardı (K29 emsali: %92 FP → geri çekilme).
// Hedef repo jest/vitest ya da assert.ok stili kullanabilir; PreToolUse hook kapıları exit 2 döner.
for (const [ad, assertion] of [
  ['assert.notEqual(x, 0)',        'assert.notEqual(r.status, 0);'],
  ['assert.ok(x === 1)',           'assert.ok(r.status === 1);'],
  ['assert.ok(x !== 0)',           'assert.ok(r.status !== 0);'],
  ['alan adı .code',               'assert.equal(res.code, 1);'],
  ['exit 2 (PreToolUse hook)',     'assert.equal(r.status, 2);'],
  ['jest/vitest expect().toBe(1)', 'expect(r.status).toBe(1);'],
  ['expect().not.toBe(0)',         'expect(r.exitCode).not.toBe(0);'],
]) {
  test(`negatif deney biçimi kabul edilir: ${ad} (FP yok, exit 0)`, () => {
    const d = tmp();
    write(d, 'gates/check-foo.mjs', '// sahte kapı\n');
    write(d, 'tests/check-foo.test.mjs', assertion + '\n');
    write(d, 'CONTRACT.md', '| `gates/check-foo.mjs` | KALİTE | ... | ... | — |\n');
    write(d, 'verify.mjs', "const steps = [['foo', ['gates/check-foo.mjs']]];\n");
    const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
    assert.equal(r.status, 0, r.out);
    cleanup(d);
  });
}

test('pozitif-only assertion negatif deney SAYILMAZ (exit 1) — kapsam genişledi diye gevşemedi', () => {
  const d = tmp();
  write(d, 'gates/check-foo.mjs', '// sahte kapı\n');
  write(d, 'tests/check-foo.test.mjs', 'assert.equal(r.status, 0);\nassert.equal(hits.length, 3);\n');
  write(d, 'CONTRACT.md', '| `gates/check-foo.mjs` | KALİTE | ... | ... | — |\n');
  write(d, 'verify.mjs', "const steps = [['foo', ['gates/check-foo.mjs']]];\n");
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /negatif deney yok/);
  cleanup(d);
});

test('hiçbir koşucuya bağlı değil + muafiyet yok → --strict FAIL', () => {
  const d = tmp();
  tamFixture(d);
  write(d, 'verify.mjs', 'const steps = [];\n');
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /koşucuya bağlı değil/);
  cleanup(d);
});

test('koşucusuz kapı CONTRACT satırında "(hedef repo)" muafiyetiyle temiz geçer (belgeli steps[]-dışılık)', () => {
  const d = tmp();
  tamFixture(d);
  write(d, 'verify.mjs', 'const steps = [];\n');
  write(d, 'CONTRACT.md', '| `gates/check-foo.mjs` | VARLIK | (hedef repo) | ... | — |\n');
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0, r.out);
  cleanup(d);
});

test('bulgu varken --strict YOKSA uyarı basar ama exit 0', () => {
  const d = tmp();
  tamFixture(d);
  write(d, 'CONTRACT.md', '# boş\n');
  const r = run(GATE, ['--rule=orphan-gates'], d);
  assert.equal(r.status, 0);
  assert.match(r.out, /UYARI/);
  cleanup(d);
});

test('gates/ ya da CONTRACT.md yoksa no-op exit 0 (opt-in; iki durum da ayrı denendi)', () => {
  const d = tmp();
  assert.equal(run(GATE, ['--rule=orphan-gates', '--strict'], d).status, 0);
  write(d, 'gates/check-foo.mjs', '//\n');
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0);
  assert.match(r.out, /no-op/);
  cleanup(d);
});

test('dogfood: paketin kendi kapı envanteri tam kayıtlı', () => {
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], ROOT);
  assert.equal(r.status, 0, `pakette orphan kapı var: ${r.out}`);
});

// ── alt-kural sınıf beyanı (v0.18.2, MADDE 16 — 5. kontrol) ──
// FRICTION_LOG 2026-08-06: "0 dosya şüpheli mi doğal mı" kararı ölçülmeden varsayılıyordu.
// tamFixture() sahte kapısı `const RULES = [...]` İÇERMEZ (parseRulesArray boş döner) — bu yüzden
// önceki dört kontrolün fixture'ları BU kontrolden etkilenmez, bilinçli olarak ayrı fixture kurulur.
function fixtureWithRule(d, className) {
  write(d, 'gates/check-foo.mjs', "const RULES = ['bar'];\n// sahte kapı\n");
  write(d, 'tests/check-foo.test.mjs', "assert.equal(r.status, 1, 'kirli girdi fail etmeli');\n");
  write(d, 'verify.mjs', "const steps = [['foo', ['gates/check-foo.mjs']]];\n");
  const classLine = className ? `\n| \`check-foo:bar\` | ${className} |\n` : '\n';
  write(d, 'CONTRACT.md', '| `gates/check-foo.mjs` | KALİTE | ... | ... | — |\n' + classLine);
}

test('alt-kural RULES[] içinde ama CONTRACT sınıf tablosunda beyanı YOK → --strict FAIL', () => {
  const d = tmp();
  fixtureWithRule(d, null);
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /sınıf beyanı yok/);
  assert.match(r.out, /check-foo:bar/);
  cleanup(d);
});

test('alt-kural sınıf beyanı VARSA (staged-diff) exit 0', () => {
  const d = tmp();
  fixtureWithRule(d, 'staged-diff');
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0, r.out);
  cleanup(d);
});

test('alt-kural sınıf beyanı VARSA (opt-in-artefakt) exit 0', () => {
  const d = tmp();
  fixtureWithRule(d, 'opt-in-artefakt');
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0, r.out);
  cleanup(d);
});

test('alt-kural sınıf beyanı VARSA (auto-discovery) exit 0', () => {
  const d = tmp();
  fixtureWithRule(d, 'auto-discovery');
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0, r.out);
  cleanup(d);
});

test('sınıf beyanı eksikken --strict YOKSA yalnız UYARI (geriye-uyumluluk: mevcut kurulu kapı kırılmaz)', () => {
  const d = tmp();
  fixtureWithRule(d, null);
  const r = run(GATE, ['--rule=orphan-gates'], d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
  assert.match(r.out, /sınıf beyanı yok/);
  cleanup(d);
});

test('dogfood: paketin kendi 20 alt-kuralı sınıf beyanı taşıyor', () => {
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], ROOT);
  assert.equal(r.status, 0, `pakette sınıf beyanı eksik alt-kural var: ${r.out}`);
  assert.doesNotMatch(r.out, /sınıf beyanı yok/);
});

// ============================================================================
// --rule=design-tokens (eski tests/check-design-tokens.test.mjs, BİREBİR taşındı)
// ============================================================================
function ui(d, name, body) {
  write(d, name, body);
  git(d, 'add', '-A');
}

test('design-tokens: DESIGN.md yoksa kapı no-op (temiz UI dosyası bile taranmaz)', () => {
  const d = initRepo();
  ui(d, 'src/Button.tsx', 'export const Button = () => <button style={{color:"#4F46E5"}}>Go</button>;\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /DESIGN\.md yok/);
});

test('design-tokens: 🔴 hardcoded hex renk → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n| primary | var(--primary) |\n');
  ui(d, 'src/Button.tsx', 'export const Button = () => <div style={{color:"#4F46E5"}}>Go</div>;\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TASARIM-TOKEN FAIL/);
  assert.match(r.out, /hardcoded hex renk/);
});

test('design-tokens: 🔴 saf inline-style (hex İÇERMEYEN) → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  ui(d, 'src/Card.tsx', 'export const Card = () => <div style={{padding: spacing.lg}}>Hi</div>;\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /inline style/);
});

test('design-tokens: 🔴 hardcoded rgb() → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  ui(d, 'src/Card.jsx', 'const bg = "rgb(79, 70, 229)";\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /hardcoded rgb/);
});

test('design-tokens: 🔴 Tailwind arbitrary değer (hex İÇERMEYEN) → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  ui(d, 'src/Hero.tsx', 'export const Hero = () => <div className="w-[437px] p-6">Hi</div>;\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Tailwind arbitrary/);
});

test('design-tokens: --strict verilmezse UYARI verir ama engellemez (exit 0)', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  ui(d, 'src/Button.tsx', 'export const Button = () => <div style={{color:"#4F46E5"}}>Go</div>;\n');
  const r = run(GATE, ['--rule=design-tokens'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /TASARIM-TOKEN UYARI/);
});

test('design-tokens: token-uyumlu className temiz geçer', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n| primary | text-primary |\n');
  ui(d, 'src/Button.tsx', 'export const Button = () => <button className="text-primary bg-card">Go</button>;\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Design-tokens OK/);
});

test('design-tokens: .css dosyasındaki token TANIMI muaf (tüketen değil, tanımlayan yüzey)', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  ui(d, 'src/globals.css', ':root { --primary: #4F46E5; }\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /staged UI dosyası yok/);
});

test('design-tokens: karşı-örnek işaretli (❌) satır muaf', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  ui(d, 'src/README.tsx', '// ❌ style={{color:"#4F46E5"}} — yanlış örnek, kullanma\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('design-tokens: 🔴 aynı satırda hem gerçek ihlal hem placeholder → hâlâ FAIL (hakem denetimi, 2026-07-28)', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  ui(d, 'src/Widget.tsx', 'export const W = () => <div style={{color:"#123456"}} data-x="{{FOO}}">Hi</div>;\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /TASARIM-TOKEN FAIL/);
});

test('design-tokens: saf placeholder satırı (yalnız {{ANAHTAR}} + ayraç) PLACEHOLDER_ONLY_LINE ile eşleşir', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  ui(d, 'src/Widget.tsx', '  {{PLACEHOLDER_LABEL}}\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Design-tokens OK/);
});

test('design-tokens: test/story dosyası hariç tutulur (mock veri renk taşıyabilir)', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  ui(d, 'src/Button.test.tsx', 'const mockColor = "#4F46E5";\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('design-tokens: açıkça verilen dosya argümanı staged filtresine tabi değil', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  const rel = write(d, 'src/Deep/Nested/Widget.tsx', 'const c = "#123456";\n');
  const r = run(GATE, ['--rule=design-tokens', '--strict', rel], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /hardcoded hex/);
});

test('design-tokens: staged UI dosyası yoksa no-op mesajı (DESIGN.md varken)', () => {
  const d = initRepo();
  write(d, 'DESIGN.md', '# Design tokens\n');
  git(d, 'add', '-A');
  const r = run(GATE, ['--rule=design-tokens'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /staged UI dosyası yok/);
});

// ============================================================================
// v0.30 B3 — rule-contracts hedef repoda no-op + orphan-gates kapı dizini keşfi
// ============================================================================
test('rule-contracts: SKILL.md yoksa (hedef repo) dürüst no-op, --strict bile exit 0 (saha: kalıcı FAIL)', () => {
  const d = tmp();
  const r = run(GATE, ['--rule=rule-contracts', '--strict'], d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no-op: SKILL\.md yok/);
  cleanup(d);
});

test('rule-contracts: SKILL.md VARKEN yerleşik tablo hâlâ zorlanır (kirli girdi → exit 1)', () => {
  const d = tmp();
  write(d, 'SKILL.md', '# boş skill — ALTIN KURAL başlığı yok\n');
  const r = run(GATE, ['--rule=rule-contracts', '--strict'], d);
  assert.equal(r.status, 1, r.out);
  cleanup(d);
});

const BT = String.fromCharCode(96);
const contractRowText = (gatePath) => `| ${BT}${gatePath}${BT} | KALİTE |\n\n| ${BT}check-foo:bar${BT} | staged-diff |\n`;

function hedefFixture(d, { contractRow = true } = {}) {
  write(d, 'scripts/gates/check-foo.mjs', "const RULES = ['bar'];\n// sahte kapı\n");
  write(d, 'scripts/gates/CONTRACT.md', contractRow ? contractRowText('scripts/gates/check-foo.mjs') : '# kayıt yok\n');
  write(d, 'package.json', '{"scripts":{"gate":"node scripts/gates/check-foo.mjs"}}\n');
}

test('orphan-gates: hedef düzen scripts/gates + scripts/gates/CONTRACT.md bulunur — temiz → exit 0 (tests/ yoksa test kontrolü atlanır)', () => {
  const d = tmp();
  hedefFixture(d);
  const r = run(GATE, ['--rule=orphan-gates', '--strict', '--dir=scripts/gates'], d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /scripts[\\/]gates/);
  assert.match(r.out, /test kontrolü ATLANDI/);
  cleanup(d);
});

test('orphan-gates: scripts/gates kirli (CONTRACT satırı yok) + açık --dir + --strict → exit 1', () => {
  const d = tmp();
  hedefFixture(d, { contractRow: false });
  const r = run(GATE, ['--rule=orphan-gates', '--strict', '--dir=scripts/gates'], d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /kayıt satırı yok/);
  cleanup(d);
});

test('orphan-gates: otomatik bulunan scripts/gates kirli + --strict → UYARI exit 0 (sessiz yeni FAIL dayatılmaz)', () => {
  const d = tmp();
  hedefFixture(d, { contractRow: false });
  const r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
  assert.match(r.out, /hedef-repo düzeni/);
  cleanup(d);
});

test('orphan-gates: no-op mesajı neyi aradığını söyler (kapı dizini yok / CONTRACT yok ayrı ayrı)', () => {
  const d = tmp();
  let r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /kapı dizini bulunamadı/);
  assert.match(r.out, /gates\/, scripts\/gates\//);
  write(d, 'scripts/gates/check-foo.mjs', '//\n');
  r = run(GATE, ['--rule=orphan-gates', '--strict'], d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /CONTRACT\.md bulunamadı/);
  cleanup(d);
});

test('orphan-gates: CONTRACT yalnız KÖKTE (scripts/gates/ içinde yok) → kök yedek konum bulunur, temiz → exit 0', () => {
  const d = tmp();
  write(d, 'scripts/gates/check-foo.mjs', "const RULES = ['bar'];\n");
  write(d, 'CONTRACT.md', contractRowText('scripts/gates/check-foo.mjs'));
  write(d, 'package.json', '{"scripts":{"gate":"node scripts/gates/check-foo.mjs"}}\n');
  const r = run(GATE, ['--rule=orphan-gates', '--strict', '--dir=scripts/gates'], d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /sözleşme: CONTRACT\.md/);
  cleanup(d);
});

// ============================================================================
// v0.30 K2d — --rule=install-version (WARN-ONLY, çıkış kodu DAİMA 0)
// ============================================================================
function ivFixture(kunyeSurum, kurulu, { git: gitVar = true, kurulumTip = 'package.json' } = {}) {
  const d = gitVar ? initRepo() : tmp();
  const skill = tmp();
  if (kunyeSurum !== null) write(d, '.agentic-repo-setup.json', JSON.stringify({ skill_version: kunyeSurum }));
  if (kurulu !== null) {
    if (kurulumTip === 'package.json') write(skill, 'package.json', JSON.stringify({ name: 'agentic-repo-setup', version: kurulu }));
    else write(skill, 'SKILL.md', '# agentic-repo-setup (v' + kurulu + ')\n');
  }
  return { d, skill, env: { AGENTIC_SKILL_DIR: skill } };
}

test('install-version: künye ESKİ → tek satır UYARI, exit 0', () => {
  const { d, skill, env } = ivFixture('0.28.0', '0.30.0');
  const r = run(GATE, ['--rule=install-version'], d, env);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /v0\.28\.0 ile kurulmuş, makinede v0\.30\.0 var/);
  assert.match(r.out, /--doctor --target=\./);
  cleanup(d); cleanup(skill);
});

test('install-version: künye YENİ (makineden ileri) → sessiz, exit 0', () => {
  const { d, skill, env } = ivFixture('0.31.0', '0.30.0');
  const r = run(GATE, ['--rule=install-version'], d, env);
  assert.equal(r.status, 0, r.out);
  assert.equal(r.out, '');
  cleanup(d); cleanup(skill);
});

test('install-version: EŞİT sürüm → sessiz, exit 0', () => {
  const { d, skill, env } = ivFixture('0.30.0', '0.30.0');
  const r = run(GATE, ['--rule=install-version'], d, env);
  assert.equal(r.status, 0, r.out);
  assert.equal(r.out, '');
  cleanup(d); cleanup(skill);
});

test('install-version: kurulu skill YOK (dizin var sürüm yok / dizin yok) → sessiz, exit 0', () => {
  const a = ivFixture('0.28.0', null);
  let r = run(GATE, ['--rule=install-version'], a.d, a.env);
  assert.equal(r.status, 0, r.out);
  assert.equal(r.out, '');
  const b = ivFixture('0.28.0', null);
  r = run(GATE, ['--rule=install-version'], b.d, { AGENTIC_SKILL_DIR: join(b.skill, 'olmayan') });
  assert.equal(r.status, 0, r.out);
  assert.equal(r.out, '');
  for (const x of [a, b]) { cleanup(x.d); cleanup(x.skill); }
});

test('install-version: künye YOK → sessiz, exit 0', () => {
  const { d, skill, env } = ivFixture(null, '0.30.0');
  const r = run(GATE, ['--rule=install-version'], d, env);
  assert.equal(r.status, 0, r.out);
  assert.equal(r.out, '');
  cleanup(d); cleanup(skill);
});

test('install-version: sürüm package.json yoksa SKILL.md başlığındaki (vX.Y.Z) kalıbından okunur', () => {
  const { d, skill, env } = ivFixture('0.28.0', '0.30.0', { kurulumTip: 'SKILL.md' });
  const r = run(GATE, ['--rule=install-version'], d, env);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /makinede v0\.30\.0 var/);
  cleanup(d); cleanup(skill);
});

test('install-version: günde en fazla BİR KEZ — ikinci koşu sessiz, damga .git/agentic-surum-uyari', () => {
  const { d, skill, env } = ivFixture('0.28.0', '0.30.0');
  const r1 = run(GATE, ['--rule=install-version'], d, env);
  const r2 = run(GATE, ['--rule=install-version'], d, env);
  assert.match(r1.out, /UYARI install-version/);
  assert.equal(r2.out, '');
  assert.equal(r2.status, 0);
  assert.equal(readFileSync(join(d, '.git', 'agentic-surum-uyari'), 'utf8').trim(), new Date().toISOString().slice(0, 10));
  cleanup(d); cleanup(skill);
});

test('install-version: .git yoksa damgasız — her koşuda uyarır, yine exit 0', () => {
  const { d, skill, env } = ivFixture('0.28.0', '0.30.0', { git: false });
  const r1 = run(GATE, ['--rule=install-version'], d, env);
  const r2 = run(GATE, ['--rule=install-version'], d, env);
  assert.match(r1.out, /UYARI install-version/);
  assert.match(r2.out, /UYARI install-version/);
  assert.equal(r2.status, 0);
  cleanup(d); cleanup(skill);
});

test('install-version: --strict verilse bile ve bozuk künye JSON olsa bile exit 0 (commit asla bloke etmez)', () => {
  const d = initRepo();
  write(d, '.agentic-repo-setup.json', '{bozuk');
  const r = run(GATE, ['--rule=install-version', '--strict'], d, { AGENTIC_SKILL_DIR: d });
  assert.equal(r.status, 0, r.out);
  const o = ivFixture('0.28.0', '0.30.0');
  const r2 = run(GATE, ['--rule=install-version', '--strict'], o.d, o.env);
  assert.equal(r2.status, 0, r2.out);
  cleanup(d); cleanup(o.d); cleanup(o.skill);
});
