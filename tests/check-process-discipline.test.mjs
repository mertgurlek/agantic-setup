import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initRepo, write, git, run, cleanup, tmp } from './helpers.mjs';
// delege-kotasi testleri stdin ister; helpers.run() stdin desteklemiyor (533 testi riske atmamak
// için helper DEĞİŞTİRİLMEDİ) → yalnız bu dosyada yerel bir spawn yardımcısı kullanılır.
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE_GATES = join(dirname(fileURLToPath(import.meta.url)), '..', 'gates');

// check-process-discipline.mjs = check-hakem-verdict + check-plan-exists + check-mode-escalation
// birleşimi (v0.16 konsolidasyonu). Test-case sayısı BİREBİR korunur — yalnız çağrı şekli değişir:
// run('check-process-discipline.mjs', ['--rule=<ad>', ...eskiArgv]).

// ============================================================================
// --rule=hakem-verdict (eski tests/check-hakem-verdict.test.mjs, BİREBİR taşındı)
// ============================================================================
function stageCode(d, rel = 'src/auth.mjs', content = 'export const x = 1;\n') {
  write(d, rel, content);
  git(d, 'add', '-A');
}

function verdictJson(overrides = {}) {
  return JSON.stringify({
    gorev: 'sifre-sifirlama',
    uygulayan: 'uygulayici-ajan',
    dogrulayan: 'hakem-ajan',
    verdict: 'onay',
    gerekce: 'Testler koştu, davranış doğrulandı.',
    timestamp: '2026-07-15T10:00:00+03:00',
    dis_model: { durum: 'atlandi', gerekce: 'hafif iş, tek dosya, davranış değişmedi' },
    ...overrides,
  });
}

test('hakem-verdict: kod diff var + verdict artefaktı YOK → --strict FAIL ("çağrılmamış")', () => {
  const d = initRepo();
  stageCode(d);
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /hakem çağrılmamış/);
});

test('hakem-verdict: kod diff var + verdict yok, --strict verilmezse UYARI ama exit 0', () => {
  const d = initRepo();
  stageCode(d);
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
});

test('hakem-verdict: kod diff yok (sadece doc değişti) → verdict aranmaz, geçer', () => {
  const d = initRepo();
  write(d, 'docs/README.md', '# readme\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no-op/);
});

test('hakem-verdict: kod diff var + dala karşılık gelen verdict VAR → geçer (exit 0)', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', verdictJson());
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('hakem-verdict: docs/verdicts/ konumu da kabul edilir', () => {
  const d = initRepo();
  stageCode(d);
  write(d, 'docs/verdicts/main.verdict.json', verdictJson());
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('hakem-verdict: 🔴 uygulayan==dogrulayan → --strict FAIL (aynı kişi kendi işini onaylayamaz)', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', verdictJson({ uygulayan: 'ayni-kisi', dogrulayan: 'ayni-kisi' }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /UYGULAYAN≠DOĞRULAYAN İHLALİ/);
});

test('hakem-verdict: verdict="red" olsa BİLE kapı BLOKLAMAZ (sadece raporlar, exit 0)', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', verdictJson({ verdict: 'red', gerekce: 'Test kapsamı yetersiz.' }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /VERDICT = "red"/);
});

test('hakem-verdict: verdict="kosullu" da BLOKLAMAZ, raporlar', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', verdictJson({ verdict: 'kosullu' }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /VERDICT = "kosullu"/);
});

test('hakem-verdict: eksik zorunlu alan (gerekce yok) → --strict FAIL', () => {
  const d = initRepo();
  stageCode(d);
  const bad = JSON.stringify({
    gorev: 'x', uygulayan: 'a', dogrulayan: 'b', verdict: 'onay', timestamp: '2026-07-15T10:00:00Z',
  });
  write(d, '.hakem/main.verdict.json', bad);
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /şema eksik alan/);
});

test('hakem-verdict: geçersiz verdict değeri (onay|red|kosullu dışı) → --strict FAIL', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', verdictJson({ verdict: 'belki' }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /geçerli değer değil/);
});

test('hakem-verdict: bozuk JSON → --strict FAIL ("hakem çağrısı KANITLANAMADI")', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', '{ bozuk json');
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /parse edilemedi/);
});

test('hakem-verdict: başka dala ait verdict (dosya adı ve içerik uyuşmuyor) → çağrı yok sayılır, FAIL', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/baska-dal.verdict.json', verdictJson());
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /hakem çağrılmamış/);
});

test('hakem-verdict: dosya adı eşleşmiyor ama içindeki `dal` alanı eşleşiyor → kabul edilir', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/verdict-001.verdict.json', verdictJson({ dal: 'main' }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('hakem-verdict: yalnız gates/tests/templates değişti → kod-diff sayılmaz, no-op', () => {
  const d = initRepo();
  write(d, 'tests/ornek.test.mjs', "import { test } from 'node:test';\n");
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no-op/);
});

test('hakem-verdict: 🔴 `dis_model` beyanı HİÇ YOK → --strict FAIL (sessiz atlama yakalanır)', () => {
  const d = initRepo();
  stageCode(d);
  const v = JSON.parse(verdictJson());
  delete v.dis_model;
  write(d, '.hakem/main.verdict.json', JSON.stringify(v));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /dis_model` beyanı YOK/);
});

// --- dayanak (v0.24): İKİ-YÖNLÜ DOĞUM — yakalar + geçirir + eski verdict'i kırmaz ---
test('hakem-verdict: 🔴 `dayanak_durumu`="COZULMEDI" → --strict FAIL (kaynağa bağlanamayan verdict sessiz geçmez)', () => {
  const d = initRepo();
  stageCode(d);
  const v = JSON.parse(verdictJson());
  v.dayanak = 'gates/check-process-discipline.mjs:runHakemVerdict';
  v.dayanak_durumu = 'COZULMEDI';
  write(d, '.hakem/main.verdict.json', JSON.stringify(v));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /COZULMEDI/);
});

test('hakem-verdict: 🔴 `dayanak` VAR ama `dayanak_durumu` geçersiz → --strict FAIL', () => {
  const d = initRepo();
  stageCode(d);
  const v = JSON.parse(verdictJson());
  v.dayanak = 'src/auth.ts:42';
  v.dayanak_durumu = 'belki';
  write(d, '.hakem/main.verdict.json', JSON.stringify(v));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /dayanak_durumu/);
});

test('hakem-verdict: GEÇİRME — `dayanak` + `cozuldu` geçerli verdict BLOKE EDİLMEZ (exit 0)', () => {
  const d = initRepo();
  stageCode(d);
  const v = JSON.parse(verdictJson());
  v.dayanak = 'src/auth.ts:42';
  v.dayanak_durumu = 'cozuldu';
  write(d, '.hakem/main.verdict.json', JSON.stringify(v));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('hakem-verdict: GERİYE UYUMLU — `dayanak` HİÇ YOKSA kapı sessiz (eski verdict kırılmaz)', () => {
  const d = initRepo();
  stageCode(d);
  const v = JSON.parse(verdictJson());
  delete v.dayanak;
  delete v.dayanak_durumu;
  write(d, '.hakem/main.verdict.json', JSON.stringify(v));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('hakem-verdict: 🔴 durum="atlandi" ama gerekce BOŞ → --strict FAIL (taşıyıcı kural)', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', verdictJson({ dis_model: { durum: 'atlandi' } }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /sessiz atlama YASAK/);
});

test('hakem-verdict: ⭐ durum="atlandi" + gerekce DOLU → geçer (atlamak meşru bir cevaptır)', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json',
    verdictJson({ dis_model: { durum: 'atlandi', gerekce: 'hafif mod; tek dosya, davranış değişmedi' } }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('hakem-verdict: durum="kosuldu" + model atfı VAR → geçer', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json',
    verdictJson({ dis_model: { durum: 'kosuldu', model: 'z-ai/glm-5.2' } }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('hakem-verdict: 🔴 durum="kosuldu" ama model atfı YOK → --strict FAIL (dış-model atıf kuralı)', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', verdictJson({ dis_model: { durum: 'kosuldu' } }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /atıf zorunlu/);
});

test('hakem-verdict: düz string kısayolu ("atlandi: hafif iş") kabul edilir', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', verdictJson({ dis_model: 'atlandi: hafif iş, tek dosya' }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('hakem-verdict: 🔴 durum bildirmeyen boş string beyanı ("bakılacak") → --strict FAIL', () => {
  const d = initRepo();
  stageCode(d);
  write(d, '.hakem/main.verdict.json', verdictJson({ dis_model: 'bakılacak' }));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--strict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /durum bildirmiyor/);
});

test('hakem-verdict: `dis_model` yok + --strict YOK → UYARI ama exit 0 (geriye-uyum)', () => {
  const d = initRepo();
  stageCode(d);
  const v = JSON.parse(verdictJson());
  delete v.dis_model;
  write(d, '.hakem/main.verdict.json', JSON.stringify(v));
  const r = run('check-process-discipline.mjs', ['--rule=hakem-verdict', '--branch=main'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
});

// ============================================================================
// --rule=plan-exists (eski tests/check-plan-exists.test.mjs, BİREBİR taşındı)
// ============================================================================
const BR = 'feature-sifre-sifirlama';

const PLAN_OK = JSON.stringify({
  davranis_degisir: true,
  etkilenen_anchors: ['backend:AuthService#SendReset'],
  kapsam: 'hafif',
  ozet: 'Şifre sıfırlama akışına rate-limit eklendi.',
}, null, 2);

const PLAN_DOLGU = JSON.stringify({
  davranis_degisir: true,
  etkilenen_anchors: [],
  kapsam: 'hafif',
}, null, 2);

const PLAN_EKSIK_ALAN = JSON.stringify({
  davranis_degisir: true,
  etkilenen_anchors: ['backend:AuthService#SendReset'],
}, null, 2);

const PLAN_YANLIS_KAPSAM = JSON.stringify({
  davranis_degisir: false,
  etkilenen_anchors: [],
  kapsam: 'orta',
}, null, 2);

test('plan-exists: anlamlı kod diff\'i yok → plan aranmaz, geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'README.md', 'not kod dosyası\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('plan-exists: 🔴 anlamlı kod diff\'i var + plan YOK → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /plan artefaktı yok/);
});

test('plan-exists: plan yok ama --strict verilmedi → UYARI, exit 0', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
});

test('plan-exists: şema-dolu plan (.json) var → geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, `docs/plans/${BR}.plan.json`, PLAN_OK);
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('plan-exists: 🔴 DOLGU-PLAN — davranis_degisir=true ama etkilenen_anchors boş → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, `docs/plans/${BR}.plan.json`, PLAN_DOLGU);
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /etkilenen_anchors boş/);
});

test('plan-exists: 🔴 eksik alan (kapsam yok) → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, `docs/plans/${BR}.plan.json`, PLAN_EKSIK_ALAN);
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /kapsam: hafif\|tam ZORUNLU/);
});

test('plan-exists: 🔴 kapsam geçersiz değer (orta) → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, `docs/plans/${BR}.plan.json`, PLAN_YANLIS_KAPSAM);
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /kapsam: hafif\|tam ZORUNLU/);
});

test('plan-exists: kod dosyasına SADECE boşluk/yorum eklenmiş (kozmetik) → plan aranmaz, geçer', () => {
  const d = initRepo();
  write(d, 'src/util.ts', 'export const x = 1;\n');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  write(d, 'src/util.ts', 'export const x = 1;\n// yorum eklendi\n\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('plan-exists: dal adı slug\'a çevrilir (dal="feature/sifre-sifirlama" → dosya "feature-sifre-sifirlama.plan.json")', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, 'docs/plans/feature-sifre-sifirlama.plan.json', PLAN_OK);
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', '--branch=feature/sifre-sifirlama'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('plan-exists: .plan.md (frontmatter) şema-dolu → geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, `docs/plans/${BR}.plan.md`, `---
davranis_degisir: true
etkilenen_anchors:
  - backend:AuthService#SendReset
kapsam: tam
---
# Plan
`);
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('plan-exists: bozuk JSON plan (parse hatası) → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, `docs/plans/${BR}.plan.json`, '{ bozuk json ');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /JSON parse edilemedi|ZORUNLU/);
});

test('plan-exists: P0 plan metadata dolu → strict geçer ve metadata uyarısı yok', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, `docs/plans/${BR}.plan.json`, JSON.stringify({
    ...JSON.parse(PLAN_OK),
    schema_version: 2,
    plan_adimlari: [{
      goal_id: 'G1',
      parent_goal: null,
      expected_outcome: 'Rate-limit testi geçer.',
      proof_artifacts: ['npm test'],
      write_set: ['src/auth.ts'],
    }],
  }));
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /PLAN-METADATA UYARI/);
});

test('plan-exists: eksik goal/proof ve write_set kesişimi → warn-only, strict yine geçer', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, `docs/plans/${BR}.plan.json`, JSON.stringify({
    ...JSON.parse(PLAN_OK),
    plan_adimlari: [
      { goal_id: '', expected_outcome: '', proof_artifacts: [], write_set: ['src/auth.ts'] },
      { goal_id: 'G2', expected_outcome: 'Sonuç', proof_artifacts: ['test'], write_set: ['src/auth.ts'] },
    ],
  }));
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /PLAN-METADATA UYARI/);
  assert.match(r.out, /goal_id eksik/);
  assert.match(r.out, /proof_artifacts boş/);
  assert.match(r.out, /write_set kesişimi/);
});

test('plan-exists: eski plan metadata alanları olmadan geriye uyumlu kalır', () => {
  const d = initRepo();
  write(d, 'src/auth.ts', 'export function reset() { return true; }\n');
  write(d, `docs/plans/${BR}.plan.json`, PLAN_OK);
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=plan-exists', '--strict', `--branch=${BR}`], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /PLAN-METADATA UYARI/);
});

// ============================================================================
// --rule=mode-escalation (eski tests/check-mode-escalation.test.mjs, BİREBİR taşındı)
// ============================================================================
function commitWithTrailer(d, trailer) {
  git(d, 'add', '-A');
  const msg = trailer ? `değişiklik\n\n${trailer}` : 'değişiklik';
  const r = git(d, 'commit', '-q', '-m', msg);
  assert.equal(r.status, 0, r.stderr);
}

test('mode-escalation: hafif dosya (sadece README) değişince ağır sinyal yok → geçer', () => {
  const d = initRepo();
  write(d, 'README.md', '# hello\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('mode-escalation: 🔴 controller değişti + commit trailer "Mode: hafif" → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'src/controllers/UserController.ts', 'export class UserController {}\n');
  commitWithTrailer(d, 'Mode: hafif');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /MOD-ESKALASYON FAIL/);
  assert.match(r.out, /public API \/ route/);
});

test('mode-escalation: DTO değişti + beyan HİÇ YOK → --strict FAIL (belirsizlik cezalandırılır)', () => {
  const d = initRepo();
  write(d, 'src/dtos/CreateUserDto.ts', 'export class CreateUserDto {}\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /beyanı: \(yok\)/);
});

test('mode-escalation: migration dosyası + STATE.md "mode: hafif" → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'migrations/0001_init.sql', 'CREATE TABLE x();\n');
  write(d, 'STATE.md', '# durum\nmode: hafif\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /migration/);
});

// v0.30 B4: STATE.md docs/ altında da aranır (saha: saha-G).
test('mode-escalation: docs/STATE.md "mode: hafif" + migration → --strict FAIL (kirli girdi)', () => {
  const d = initRepo();
  write(d, 'migrations/0001_init.sql', 'CREATE TABLE x();\n');
  write(d, 'docs/STATE.md', '# durum\nmode: hafif\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /mod beyanı: hafif/);
});

test('mode-escalation: docs/STATE.md "mode: tam" + migration → geçer (temiz girdi)', () => {
  const d = initRepo();
  write(d, 'migrations/0001_init.sql', 'CREATE TABLE x();\n');
  write(d, 'docs/STATE.md', '# durum\nmode: tam\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('mode-escalation: kök STATE.md alansız + docs/STATE.md "mode: tam" → docs beyanı okunur (geçer)', () => {
  const d = initRepo();
  write(d, 'migrations/0001_init.sql', 'CREATE TABLE x();\n');
  write(d, 'STATE.md', '# durum — alan yok\n');
  write(d, 'docs/STATE.md', 'mode: tam\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('mode-escalation: kök STATE.md öncelikli — kök "tam", docs "hafif" → geçer', () => {
  const d = initRepo();
  write(d, 'migrations/0001_init.sql', 'CREATE TABLE x();\n');
  write(d, 'STATE.md', 'mode: tam\n');
  write(d, 'docs/STATE.md', 'mode: hafif\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('mode-escalation: --strict verilmezse ağır sinyal + hafif beyanı UYARI verir, engellemez (exit 0)', () => {
  const d = initRepo();
  write(d, 'src/routes/orders.route.ts', 'export const router = {};\n');
  commitWithTrailer(d, 'Mode: hafif');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
});

test('mode-escalation: controller değişti + commit trailer "Mode: tam" → geçer (dürüst beyan cezalandırılmaz)', () => {
  const d = initRepo();
  write(d, 'src/controllers/UserController.ts', 'export class UserController {}\n');
  commitWithTrailer(d, 'Mode: tam');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('mode-escalation: config dosyası + STATE.md "mode: tam" → geçer', () => {
  const d = initRepo();
  write(d, 'config/auth.settings.json', '{}\n');
  write(d, 'STATE.md', '# durum\nmode: tam\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('mode-escalation: yalnızca refactor dosyası (route/dto/config dışı) → beyansız da geçer', () => {
  const d = initRepo();
  write(d, 'src/utils/format.ts', 'export const f = () => 1;\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('mode-escalation: trailer "mode: light" (İngilizce, küçük harf) hafif sayılır → FAIL', () => {
  const d = initRepo();
  write(d, 'src/routes/orders.route.ts', 'export const router = {};\n');
  commitWithTrailer(d, 'mode: light');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('mode-escalation: 🔴 controller SİLİNDİ (staged deletion) + beyan yok → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'src/controllers/UserController.ts', 'export class UserController {}\n');
  write(d, 'README.md', '# hello\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  git(d, 'rm', '-q', 'src/controllers/UserController.ts');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /public API \/ route/);
});

test('mode-escalation: 🔴 controller SİLİNDİ (committed, CI/post-commit yolu) + "Mode: hafif" → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'src/controllers/UserController.ts', 'export class UserController {}\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  git(d, 'rm', '-q', 'src/controllers/UserController.ts');
  commitWithTrailer(d, 'Mode: hafif');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('mode-escalation: 🔵 ağır sinyal + "Mode: devir" → FAIL YOK (exit 0), ama görünür DEVİR satırı basar', () => {
  const d = initRepo();
  write(d, 'src/controllers/UserController.ts', 'export class UserController {}\n');
  commitWithTrailer(d, 'Mode: devir');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /MOD = DEVİR/);
  assert.match(r.out, /aktarıldı mı/);
  assert.doesNotMatch(r.out, /MOD-ESKALASYON FAIL/);
});

test('mode-escalation: 🔵 ağır sinyal + STATE.md "mode: engel" → exit 0 + görünür ENGEL satırı', () => {
  const d = initRepo();
  write(d, 'migrations/0001_init.sql', 'CREATE TABLE x();\n');
  write(d, 'STATE.md', '# durum\nmode: engel\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /MOD = ENGEL/);
  assert.match(r.out, /neyin beklendiği/);
});

test('mode-escalation: İngilizce eşdeğerler (handoff/blocked) de tanınır → exit 0', () => {
  const d = initRepo();
  write(d, 'src/routes/orders.route.ts', 'export const router = {};\n');
  commitWithTrailer(d, 'Mode: handoff');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /MOD = DEVİR/);
});

test('mode-escalation: 🟠 "Mode: devir" ama diff\'te gerçek uygulama-kodu var → ÇELİŞKİ uyarısı (yine exit 0)', () => {
  const d = initRepo();
  write(d, 'src/controllers/UserController.ts', 'export class UserController { yeni() {} }\n');
  write(d, 'src/services/hesap.ts', 'export const hesapla = () => 42;\n');
  commitWithTrailer(d, 'Mode: devir');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /ÇELİŞKİ UYARISI/);
  assert.match(r.out, /src\/services\/hesap\.ts/);
});

test('mode-escalation: "Mode: devir" + yalnız doküman/test değişikliği → ÇELİŞKİ uyarısı YOK', () => {
  const d = initRepo();
  write(d, 'src/controllers/UserController.ts', 'export class UserController {}\n');
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'init');
  write(d, 'docs/devir-raporu.md', '# kök neden backend-ekibinde\n');
  write(d, 'tests/regresyon.test.ts', 'test("x", () => {});\n');
  commitWithTrailer(d, 'Mode: devir');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /ÇELİŞKİ/);
});

test('mode-escalation: tanınmayan beyan ("mode: draft") ağır sinyalle hâlâ --strict FAIL', () => {
  const d = initRepo();
  write(d, 'src/dtos/CreateUserDto.ts', 'export class CreateUserDto {}\n');
  write(d, 'STATE.md', '# durum\nmode: draft\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /MOD-ESKALASYON FAIL/);
});

// ============================================================================
// --rule=spec-receipt (v0.23.0, K55 ②) — TERS-SPEC: vaat (write_set) ↔ gerçek (staged diff)
// Kaynak ÖLÇÜM: 127 doğrulanmış S3b vakası; ~24'ü kod/dosya iddiası (kapının GERÇEK hedefi).
// İki tuzak ölçülerek bulundu: ① plan bayatlığı (bu repoda 28 commit) ② yön seçimi.
// ============================================================================
const SR_PLAN = (writeSet) => JSON.stringify({
  schema_version: 2,
  davranis_degisir: true,
  etkilenen_anchors: ['src:auth'],
  kapsam: 'tam',
  ozet: 'spec-receipt fixture',
  plan_adimlari: [{
    goal_id: 'G1', expected_outcome: 'çalışır', proof_artifacts: ['test'], write_set: writeSet,
  }],
}, null, 2);

test('spec-receipt: staged diff boş → no-op (staged-diff sınıfı, 0 dosya DOĞAL)', () => {
  const d = initRepo();
  const r = run('check-process-discipline.mjs', ['--rule=spec-receipt', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /staged diff boş/);
});

test('spec-receipt: plan dosyası yok → no-op (vaat yoksa kıyas da yok)', () => {
  const d = initRepo();
  write(d, 'src/x.js', 'export const a = 1;\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=spec-receipt', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /plan dosyası yok/);
});

test('spec-receipt: 🔴 vaat DIŞINDA yazım + --strict → FAIL', () => {
  const d = initRepo();
  write(d, 'docs/plans/main.plan.json', SR_PLAN(['src/auth.js']));
  write(d, 'src/auth.js', 'a\n');
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'init');
  write(d, 'src/other.js', 'b\n');          // plan bunu VAAT ETMEDİ
  git(d, 'add', 'src/other.js');
  const r = run('check-process-discipline.mjs', ['--rule=spec-receipt', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /SPEC-RECEIPT FAIL/);
  assert.match(r.out, /src\/other\.js/);
});

test('spec-receipt: vaat DIŞINDA yazım ama --strict YOK → UYARI, exit 0', () => {
  const d = initRepo();
  write(d, 'docs/plans/main.plan.json', SR_PLAN(['src/auth.js']));
  write(d, 'src/auth.js', 'a\n');
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'init');
  write(d, 'src/other.js', 'b\n');
  git(d, 'add', 'src/other.js');
  const r = run('check-process-discipline.mjs', ['--rule=spec-receipt'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /SPEC-RECEIPT UYARI/);
});

// GEÇİRME deneyleri (altın kural ②b — kapı İKİ kontrolle doğar)
test('spec-receipt: vaat İÇİNDE yazım geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/plans/main.plan.json', SR_PLAN(['src/auth.js']));
  write(d, 'src/auth.js', 'a\n');
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'init');
  write(d, 'src/auth.js', 'a2\n');
  git(d, 'add', 'src/auth.js');
  const r = run('check-process-discipline.mjs', ['--rule=spec-receipt', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /write_set'i örtüyor/);
});

test('spec-receipt: TUZAK ② — "vaat var ama diff yok" MEŞRUDUR (sessiz, exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/plans/main.plan.json', SR_PLAN(['src/auth.js', 'src/db.js']));
  write(d, 'src/auth.js', 'a\n'); write(d, 'src/db.js', 'z\n');
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'init');
  write(d, 'src/auth.js', 'a2\n');
  git(d, 'add', 'src/auth.js');            // src/db.js vaat edildi ama DOKUNULMADI
  const r = run('check-process-discipline.mjs', ['--rule=spec-receipt', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);        // adım henüz koşmadı → uyarı YOK
  assert.doesNotMatch(r.out, /db\.js/);
});

test('spec-receipt: write_set dizin öneki (src/) alt dosyaları örter', () => {
  const d = initRepo();
  write(d, 'docs/plans/main.plan.json', SR_PLAN(['src/']));
  write(d, 'README.md', 'x\n');
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'init');
  write(d, 'src/deep/nested.js', 'q\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=spec-receipt', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('spec-receipt: TUZAK ① — plan >3 commit bayatsa no-op (yanlış-alarm panzehiri)', () => {
  const d = initRepo();
  write(d, 'docs/plans/main.plan.json', SR_PLAN(['src/auth.js']));
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'plan');
  for (const n of [1, 2, 3, 4]) {          // plandan SONRA 4 commit
    write(d, `f${n}.md`, `${n}\n`); git(d, 'add', '-A'); git(d, 'commit', '-qm', `c${n}`);
  }
  write(d, 'src/vaat-disi.js', 'x\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=spec-receipt', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /commit geride/);
});

test('spec-receipt: planda write_set beyanı yoksa no-op', () => {
  const d = initRepo();
  write(d, 'docs/plans/main.plan.json', JSON.stringify({
    schema_version: 2, davranis_degisir: true, etkilenen_anchors: ['a'], kapsam: 'hafif', ozet: 'x',
    plan_adimlari: [{ goal_id: 'G1', expected_outcome: 'y', proof_artifacts: ['t'] }],
  }));
  git(d, 'add', '-A'); git(d, 'commit', '-qm', 'init');
  write(d, 'src/x.js', 'a\n'); git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=spec-receipt', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /write_set beyanı yok/);
});

// ============================================================================
// --rule=delege-kotasi (v0.23.0, K60) — tur-içi ham keşif kotası
// 🔴 STDIN ŞEMASI ÖLÇÜLDÜ (2026-08-27, geçici prob): PreToolUse stdin = JSON,
//    alanlar: session_id · transcript_path · cwd · prompt_id · permission_mode ·
//    effort · hook_event_name · tool_name · tool_input · tool_use_id.
//    Fixture'lar bu ÖLÇÜLMÜŞ şemayı kullanır — uydurma değil.
// Eşik ≥15: 647 gerçek turn üzerinden kalibre (%7,9 tetiklenme).
// ============================================================================
function runWithStdin(args, cwd, stdin) {
  const r = spawnSync(process.execPath,
    [join(HERE_GATES, 'check-process-discipline.mjs'), ...args],
    { cwd, encoding: 'utf8', input: stdin });
  return { status: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}
const HOOK = (promptId, toolName) => JSON.stringify({
  session_id: 'sess-1',
  transcript_path: 'C:/tmp/t.jsonl',
  cwd: '.',
  prompt_id: promptId,
  permission_mode: 'auto',
  effort: { level: 'medium' },
  hook_event_name: 'PreToolUse',
  tool_name: toolName,
  tool_input: { file_path: 'x.md' },
  tool_use_id: 'toolu_x',
});

test('delege-kotasi: stdin YOK → no-op (hook dışı çağrı, tur bağlamı yok)', () => {
  const d = tmp();
  const r = runWithStdin(['--rule=delege-kotasi', '--strict'], d, '');
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /hook stdin yok/);
});

test('delege-kotasi: stdin JSON değil → no-op (sözleşme dışı)', () => {
  const d = tmp();
  const r = runWithStdin(['--rule=delege-kotasi', '--strict'], d, 'düz metin');
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /JSON değil/);
});

test('delege-kotasi: keşif aracı OLMAYAN çağrı sayılmaz (Write)', () => {
  const d = tmp();
  const r = runWithStdin(['--rule=delege-kotasi', '--strict'], d, HOOK('T1', 'Write'));
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /keşif aracı değil/);
});

test('delege-kotasi: prompt_id yoksa no-op (tur sınırı bilinemez → sayaç güvenilmez)', () => {
  const d = tmp();
  const p = JSON.parse(HOOK('T1', 'Read')); delete p.prompt_id;
  const r = runWithStdin(['--rule=delege-kotasi', '--strict'], d, JSON.stringify(p));
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /prompt_id yok/);
});

test('delege-kotasi: kota içinde sessiz (15/15 geçer)', () => {
  const d = tmp();
  let r;
  for (let i = 0; i < 15; i++) r = runWithStdin(['--rule=delege-kotasi', '--strict'], d, HOOK('T1', 'Read'));
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /15\/15/);
});

test('delege-kotasi: 🔴 kota aşılınca UYARI (varsayılan, exit 0)', () => {
  const d = tmp();
  let r;
  for (let i = 0; i < 16; i++) r = runWithStdin(['--rule=delege-kotasi'], d, HOOK('T1', 'Read'));
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /DELEGE-KOTASI UYARI/);
  assert.match(r.out, /16 ham keşif/);
});

test('delege-kotasi: 🔴 --strict → exit 2 (PreToolUse: araç REDDEDİLİR)', () => {
  const d = tmp();
  let r;
  for (let i = 0; i < 16; i++) r = runWithStdin(['--rule=delege-kotasi', '--strict'], d, HOOK('T1', 'Read'));
  cleanup(d);
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /BLOKE/);
});

test('delege-kotasi: TUR DEĞİŞİNCE sayaç sıfırlanır (prompt_id anahtarı)', () => {
  const d = tmp();
  for (let i = 0; i < 16; i++) runWithStdin(['--rule=delege-kotasi'], d, HOOK('T1', 'Read'));
  const r = runWithStdin(['--rule=delege-kotasi', '--strict'], d, HOOK('T2', 'Read'));
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1\/15/);
});

test('delege-kotasi: --kota=N eşiği yükseltir (bilinçli aşım yolu)', () => {
  const d = tmp();
  let r;
  for (let i = 0; i < 18; i++) r = runWithStdin(['--rule=delege-kotasi', '--strict', '--kota=30'], d, HOOK('T1', 'Read'));
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /18\/30/);
});

test('delege-kotasi: Grep ve Glob da sayılır (Read ile aynı küme)', () => {
  const d = tmp();
  for (let i = 0; i < 8; i++) runWithStdin(['--rule=delege-kotasi'], d, HOOK('T1', 'Grep'));
  let r;
  for (let i = 0; i < 8; i++) r = runWithStdin(['--rule=delege-kotasi'], d, HOOK('T1', 'Glob'));
  cleanup(d);
  assert.match(r.out, /DELEGE-KOTASI UYARI/);   // 16 toplam
});

// v0.30.4: STATE.md docs/<alt>/ altında da aranır (saha: pilot docs/agentic/STATE.md) — tek yardımcı gates/lib/state-yolu.mjs.
test('mode-escalation: docs/agentic/STATE.md "mode: hafif" + migration → --strict FAIL (kirli girdi)', () => {
  const d = initRepo();
  write(d, 'migrations/0001_init.sql', 'CREATE TABLE x();\n');
  write(d, 'docs/agentic/STATE.md', '# durum\nmode: hafif\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /mod beyanı: hafif/);
});

test('mode-escalation: docs/agentic/STATE.md "mode: tam" + migration → geçer (temiz girdi)', () => {
  const d = initRepo();
  write(d, 'migrations/0001_init.sql', 'CREATE TABLE x();\n');
  write(d, 'docs/agentic/STATE.md', 'mode: tam\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('STATE araması: docs/archive/ ve .gizli/ atlanır; kök + docs/<alt> varsa kök öncelikli ve rapor kaynağı yazar', () => {
  const d = initRepo();
  write(d, 'migrations/0001_init.sql', 'CREATE TABLE x();\n');
  write(d, 'docs/archive/STATE.md', 'mode: tam\n');     // arşiv: güncel durum sayılmaz
  write(d, 'docs/.eski/STATE.md', 'mode: tam\n');
  write(d, 'docs/agentic/STATE.md', 'mode: hafif\n');
  write(d, 'STATE.md', 'mode: hafif\n');
  git(d, 'add', '-A');
  const r = run('check-process-discipline.mjs', ['--rule=mode-escalation', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /mod beyanı: hafif, kaynak: STATE\.md/);
});
