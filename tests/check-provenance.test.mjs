import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmp, write, run, cleanup, initRepo, git } from './helpers.mjs';

const HERE_T = dirname(fileURLToPath(import.meta.url));

// check-provenance.mjs testleri — alt-kural başına bir bölüm.

// ============================================================================
// --rule=acceptance (eski tests/check-acceptance.test.mjs, BİREBİR taşındı)
// ============================================================================
const accept = (obj) => JSON.stringify(obj);

test('acceptance: passes:true + kanıt geçer (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'f.acceptance.json', accept({
    id: 'F1', status: 'in_dev',
    criteria: [{ id: 'AC-1', desc: 'liste yüklenir', passes: true, evidence: 'test: list.spec geçti' }],
  }));
  const r = run('check-provenance.mjs', ['--rule=acceptance', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('acceptance: passes:true ama kanıt boş fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'f.acceptance.json', accept({
    id: 'F1', status: 'in_dev',
    criteria: [{ id: 'AC-1', desc: 'x', passes: true, evidence: '' }],
  }));
  const r = run('check-provenance.mjs', ['--rule=acceptance', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /evidence|kanıt|Kanıtsız/i);
});

test('acceptance: criteria yok fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'f.acceptance.json', accept({ id: 'F1', status: 'in_dev', criteria: [] }));
  const r = run('check-provenance.mjs', ['--rule=acceptance', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('acceptance: passes:false varsayılan → uyarı (exit 0)', () => {
  const d = tmp();
  const f = write(d, 'f.acceptance.json', accept({
    id: 'F1', status: 'in_dev',
    criteria: [{ id: 'AC-1', desc: 'x', passes: false, evidence: '' }],
  }));
  const r = run('check-provenance.mjs', ['--rule=acceptance', f], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('acceptance: passes:false + --release fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'f.acceptance.json', accept({
    id: 'F1', status: 'in_dev',
    criteria: [{ id: 'AC-1', desc: 'x', passes: false, evidence: '' }],
  }));
  const r = run('check-provenance.mjs', ['--rule=acceptance', f, '--release'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

test('acceptance: status=released ama passes:false fail (exit 1)', () => {
  const d = tmp();
  const f = write(d, 'f.acceptance.json', accept({
    id: 'F1', status: 'released',
    criteria: [{ id: 'AC-1', desc: 'x', passes: false, evidence: '' }],
  }));
  const r = run('check-provenance.mjs', ['--rule=acceptance', f], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
});

// ── boş-küme körlüğü MUAFİYETİ (v0.18.2, hakem turu 2026-08-06) ──
// `acceptance` OPT-IN ARTEFAKT tabanlıdır: tetikleyici `*.acceptance.json` iş yapıldıkça DOĞAR.
// Ana ajanın ilk kapsam kararı bunu şüpheli-sınıfa koymuştu; hakem ölçtü ve ÇÜRÜTTÜ — kurulmuş
// ama henüz kabul kriteri yazmamış repoda FAIL, "kullanmayan repo yeni FAIL görmez" sözleşmesini
// (CONTRACT madde 1-13) kırıyor ve kurulumun ilk günü CI'ı kırmızıya çeviriyordu.
// Bu iki test o REGRESYONUN nöbetçisidir: buraya FAIL geri gelirse testler kırılır.
test('acceptance: argümansız + .acceptance.json yok → NO-OP geçer (exit 0, opt-in muafiyeti)', () => {
  const d = initRepo();
  const r = run('check-provenance.mjs', ['--rule=acceptance'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /taranan=0/);
  assert.match(r.out, /opt-in artefakt yok/);
});

test('acceptance: --allow-empty verilse de davranış aynı (bayrak zararsızca yok sayılır)', () => {
  const d = initRepo();
  const r = run('check-provenance.mjs', ['--rule=acceptance', '--allow-empty'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /taranan=0/);
});

test('acceptance: var olmayan dosya argümanla verilince FAIL (exit 1) — sessizce yutulmaz', () => {
  const d = tmp();
  const r = run('check-provenance.mjs', ['--rule=acceptance', 'YOK-BOYLE-DOSYA.acceptance.json'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /diskte YOK/);
});

// ============================================================================
// --rule=brief-provenance (eski tests/check-brief-provenance.test.mjs, BİREBİR taşındı)
// ============================================================================
function cleanBrief(overrides = {}) {
  const b = {
    source_commit: 'abc1234',
    feature_id: 'sifre-sifirlama',
    tech_doc: 'docs/tech/auth/sifre-sifirlama.md',
    module: 'auth',
    client: 'Web',
    crosscheck: 'matched',
    step_df: 'auth/reset.js:submit',
    edge_df: 'auth/reset.js:validate',
    unknown_fields: '[]',
    needs_review: '[]',
    status: 'approved',
    ...overrides,
  };
  return [
    'brief_version: 1',
    `source_commit: ${b.source_commit}`,
    'source:',
    `  feature_id: ${b.feature_id}`,
    `  tech_doc: ${b.tech_doc}`,
    'assertion_crosscheck:',
    `  status: ${b.crosscheck}`,
    'fibery_fields:',
    `  module: ${b.module}`,
    `  client: ${b.client}`,
    'steps:',
    '  - order: 1',
    '    name: "giris yap"',
    `    derived_from: ${b.step_df}`,
    'edge_cases:',
    '  sifir_veri:',
    '    - name: "bos parola"',
    `      derived_from: ${b.edge_df}`,
    'unresolved:',
    `  unknown_fields: ${b.unknown_fields}`,
    `  needs_review: ${b.needs_review}`,
    `status: ${b.status}`,
    '',
  ].join('\n');
}

// v0.28.1: paketin golden fixture'ı (examples/test-brief.yaml) hiçbir koşucuya bağlı değildi —
// "exit 0 vermeli" diyordu ama kimse koşmuyordu. Artık bu test onu PAKETİN gerçek dosyasından okur.
test('brief-provenance: paketin golden fixture\'ı (examples/test-brief.yaml) temiz geçer', () => {
  const d = tmp();
  const brief = write(d, 'docs/test-briefs/golden.yaml',
    readFileSync(join(HERE_T, '..', 'examples', 'test-brief.yaml'), 'utf8'));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', brief], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 test-brief denetlendi/);
});

test('brief-provenance: test-brief yoksa sessizce gecer (exit 0, opt-in)', () => {
  const d = tmp();
  const r = run('check-provenance.mjs', ['--rule=brief-provenance'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /test-brief yok/);
});

test('brief-provenance: temiz onayli brief gecer (exit 0)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/brief-1.yaml', cleanBrief());
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Brief-provenance OK/);
});

test('brief-provenance: argumansiz standart konumdaki temiz brief bulunur ve gecer (exit 0)', () => {
  const d = tmp();
  write(d, 'test-briefs/b.yaml', cleanBrief());
  const r = run('check-provenance.mjs', ['--rule=brief-provenance'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Brief-provenance OK/);
});

test('brief-provenance: expected_results listeli step → derived_from dogru okunur (girinti-farkindalik, exit 0)', () => {
  const d = tmp();
  const brief = [
    'brief_version: 1',
    'generated_at: "2026-07-21"',
    'source_commit: abc123',
    'source:',
    '  feature_id: siparis-limiti',
    '  tech_doc: docs/tech/policy.md',
    'assertion_crosscheck:',
    '  status: matched',
    'fibery_fields:',
    '  module: Order Limit',
    '  client: example.io',
    'steps:',
    '  - order: 1',
    '    name: "limit asan tutar girilir"',
    '    expected_results:',
    '      - "uyari gosterilir"',
    '      - "buton disabled kalir"',
    '    derived_from: "repo:PolicySym"',
    'unresolved:',
    '  unknown_fields: []',
    '  needs_review: []',
    'status: approved',
    '',
  ].join('\n');
  const rel = write(d, 'docs/test-briefs/b.yaml', brief);
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Brief-provenance OK/);
});

test('brief-provenance: step derived_from bos → fail (exit 1)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/b.yaml', cleanBrief({ step_df: '' }));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /KAYNAKSIZ STEP/);
});

test('brief-provenance: edge-case derived_from bos → fail (exit 1)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/b.yaml', cleanBrief({ edge_df: '' }));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /KAYNAKSIZ EDGE-CASE/);
});

test('brief-provenance: approved + unresolved DOLU → fail (exit 1, fail-closed)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/b.yaml',
    cleanBrief({ unknown_fields: '[client]', needs_review: '[step-2-confidence-low]' }));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /FAIL-CLOSED IHLALI/);
});

test('brief-provenance: approved + crosscheck mismatch → fail (exit 1, semantik-drift)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/b.yaml', cleanBrief({ crosscheck: 'mismatch' }));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /SEMANTIK-DRIFT IHLALI/);
});

test('brief-provenance: provenance eksik (source_commit placeholder) → fail (exit 1)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/b.yaml', cleanBrief({ source_commit: '{{SHA}}' }));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /PROVENANCE EKSIK/);
  assert.match(r.out, /source_commit/);
});

test('brief-provenance: fibery module UNKNOWN + approved → fail (exit 1, schema-required)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/b.yaml', cleanBrief({ module: 'UNKNOWN' }));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /FIBERY SCHEMA-REQUIRED IHLALI/);
});

test('brief-provenance: crosscheck no_unit_test + approved → UYARI, gecer (exit 0)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/b.yaml', cleanBrief({ crosscheck: 'no_unit_test' }));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /CROSSCHECK UYARISI/);
});

test('brief-provenance: crosscheck no_unit_test + approved --strict ile fail (exit 1)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/b.yaml', cleanBrief({ crosscheck: 'no_unit_test' }));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel, '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /CROSSCHECK UYARISI/);
});

test('brief-provenance: unresolved DOLU ama status draft ise gecer (exit 0 — sadece approved bloke eder)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/b.yaml',
    cleanBrief({ status: 'needs_review', unknown_fields: '[client]' }));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Brief-provenance OK/);
});

test('brief-provenance: CRLF satir sonlu brief dogru okunur (exit 0, regresyon — Windows repo)', () => {
  const d = tmp();
  const rel = write(d, 'docs/test-briefs/crlf.yaml', cleanBrief().replace(/\n/g, '\r\n'));
  const r = run('check-provenance.mjs', ['--rule=brief-provenance', rel], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Brief-provenance OK/);
});

// ============================================================================
// --rule=coverage-gate (eski tests/check-coverage-gate.test.mjs, BİREBİR taşındı)
// ============================================================================
const T_OK = `---
id: TECH-AUTH-001
feature_ids: [sifre-sifirlama]
test_anchors:
  - behavior: "sıfırlama maili gönderilir"
    anchor: "backend:AuthService#SendReset"
    mock_depth: real
verification:
  status: dogrulandi
  mock_guarded_count: 0
---
# T
`;

const T_UNVERIFIED = `---
id: TECH-AUTH-002
feature_ids: [sifre-sifirlama]
verification:
  status: kontrol-bekliyor
  mock_guarded_count: 0
---
# T
`;

const T_MOCK_GUARDED = `---
id: TECH-AUTH-003
feature_ids: [sifre-sifirlama]
verification:
  status: dogrulandi
  mock_guarded_count: 2
---
# T
`;

const T_YALANCI = `---
id: TECH-AUTH-004
feature_ids: [sifre-sifirlama]
test_anchors:
  - behavior: "sıfırlama maili gönderilir"
    anchor: "backend:AuthService#SendReset"
    mock_depth: mock-guarded
verification:
  status: dogrulandi
  mock_guarded_count: 0
---
# T
`;

const T_DURUST = `---
id: TECH-AUTH-005
feature_ids: [sifre-sifirlama]
test_anchors:
  - behavior: "sıfırlama maili gönderilir"
    anchor: "backend:AuthService#SendReset"
    mock_depth: real
verification:
  status: dogrulandi
  mock_guarded_count: 0
---
# T
`;

function l0(techDocsYaml, coverageStatus) {
  return `---
id: TR-AUTH-001
feature_id: sifre-sifirlama
anchors:
  tech_docs: ${techDocsYaml}
coverage:
  status: ${coverageStatus}
  missing: []
---
# L0
`;
}

test('coverage-gate: tüm [T] doğrulanmış + coverage tam → geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_OK);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('coverage-gate: [T] doğrulanmamışken coverage=tam ise --strict FAIL verir', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_UNVERIFIED);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /coverage\.status=tam olmalıydı `eksik`/);
});

test('coverage-gate: mock_guarded_count>0 olan [T] dogrulandi olsa bile SAYILMAZ (--strict FAIL)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_MOCK_GUARDED);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /mock_guarded_count=2/);
});

test('coverage-gate: eksik [T] dosyası → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/olmayan.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /\[T\] yok/);
});

// v0.30 B9a: 'eksik' bir BİLGİ BEYANIDIR, af yetkisi değil — yapısal hata susturulamaz.
function l0m(techDocsYaml, coverageStatus, missingYaml) {
  return l0(techDocsYaml, coverageStatus).replace('missing: []', 'missing: ' + missingYaml);
}
const cg = (d, f, extra = ['--strict']) => run('check-provenance.mjs', ['--rule=coverage-gate', f, ...extra], d);

test('coverage-gate: NEG-3 — var olmayan [T] + coverage=eksik + missing dolu → YİNE FAIL (yapısal susturulamaz)', () => {
  const d = initRepo();
  write(d, 'docs/user/s.md', l0m('[../tech/olmayan.md]', 'eksik', '["kur dönüşümü"]'));
  const r = cg(d, 'docs/user/s.md');
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /REFERANS BÜTÜNLÜĞÜ/);
  assert.match(r.out, /\[T\] yok/);
});

test('coverage-gate: tech_docs boş + eksik → YİNE FAIL (yapısal)', () => {
  const d = initRepo();
  write(d, 'docs/user/bos.md', l0m('[]', 'eksik', '["x"]'));
  const r = cg(d, 'docs/user/bos.md');
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /tech_docs boş/);
});

test('coverage-gate: NEG-4 — kök-dışı referans (../../../etc/passwd) + eksik → FAIL', () => {
  const d = initRepo();
  write(d, 'docs/user/s.md', l0m('[../../../etc/passwd]', 'eksik', '["x"]'));
  const r = cg(d, 'docs/user/s.md');
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /kök-dışı/);
});

test('coverage-gate: NEG-5 — [T] var ama frontmatter sınırı yok + eksik → FAIL', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', '# frontmatter yok\nid: x\n');
  write(d, 'docs/user/s.md', l0m('[../tech/auth.md]', 'eksik', '["x"]'));
  const r = cg(d, 'docs/user/s.md');
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /frontmatter okunamıyor/);
});

test('coverage-gate: NEG-2 — eksik + doğrulanmamış [T] + missing[] BOŞ → --strict FAIL, bayraksız UYARI exit 0', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_UNVERIFIED);
  write(d, 'docs/user/s.md', l0('[../tech/auth.md]', 'eksik'));
  const r = cg(d, 'docs/user/s.md');
  const w = cg(d, 'docs/user/s.md', []);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /missing\[\]. BOŞ/);
  assert.equal(w.status, 0, w.out);
  assert.match(w.out, /UYARI/);
});

test('coverage-gate: eksik + hiç problem yok + missing boş → --strict FAIL (tam olmalı)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_OK);
  write(d, 'docs/user/s.md', l0('[../tech/auth.md]', 'eksik'));
  const r = cg(d, 'docs/user/s.md');
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /tam. olmalı/);
});

test('coverage-gate: POZİTİF — doğrulanmamış [T] + eksik + missing dolu (inline) → geçer', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_UNVERIFIED);
  write(d, 'docs/user/s.md', l0m('[../tech/auth.md]', 'eksik', '["kur dönüşümü test edilmiyor"]'));
  const r = cg(d, 'docs/user/s.md');
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('coverage-gate: POZİTİF — blok liste missing + CRLF (saha dersi) → geçer', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_UNVERIFIED);
  const body = l0('[../tech/auth.md]', 'eksik').replace('missing: []', 'missing:\n    - kur dönüşümü\n    - ikinci eksik').replace(/\n/g, '\r\n');
  write(d, 'docs/user/s.md', body);
  const r = cg(d, 'docs/user/s.md');
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('coverage-gate: ../tech/x.md (docs/user içinden köke düşen meşru göreli yol) kök-dışı SAYILMAZ', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_OK);
  write(d, 'docs/user/s.md', l0('[../tech/auth.md]', 'tam'));
  const r = cg(d, 'docs/user/s.md');
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('coverage-gate: --strict verilmezse tutarsızlık UYARI verir, engellemez (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_UNVERIFIED);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
});

test('coverage-gate: argümansız çağrı docs/user/**/*.md tarar (git-tracked)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_OK);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=coverage-gate'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 \[L0\]/);
});

test('coverage-gate: 🔴 BEYAN-GERÇEK ÇELİŞKİSİ — rollup 0 der ama mock_depth mock-guarded ise YAKALAR', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_YALANCI);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /BEYAN-GERÇEK ÇELİŞKİSİ/);
});

test('coverage-gate: mock_depth: real + rollup 0 (tutarlı/DÜRÜST) → YANLIŞ ALARM VERMEZ (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_DURUST);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

const T_KANITSIZ = `---
id: TECH-AUTH-006
feature_ids: [sifre-sifirlama]
verification:
  status: dogrulandi
  mock_guarded_count: 0
---
# T (hiç test_anchor yok ama "doğrulandı" diyor)
`;

test('coverage-gate: 🔴 KANITSIZ dogrulandi — test_anchors YOK ise `dogrulandi` VERİLEMEZ', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_KANITSIZ);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /KANITSIZ/);
});

const T_PARA_OKUMA = `---
id: TECH-PAY-001
feature_ids: [odeme-onayi]
risk_sinifi: para
test_anchors:
  - behavior: "çifte tahsilat engellenir"
    anchor: "backend:PaymentService#PreventDoubleCharge"
    mock_depth: real
verification:
  status: dogrulandi
  kanit_tipi: okuma
  mock_guarded_count: 0
---
# T (para riski, sadece kod okunarak doğrulanmış — YAKALANMALI)
`;

const T_PARA_TEST = `---
id: TECH-PAY-002
feature_ids: [odeme-onayi]
risk_sinifi: para
test_anchors:
  - behavior: "çifte tahsilat engellenir"
    anchor: "backend:PaymentService#PreventDoubleCharge"
    mock_depth: real
verification:
  status: dogrulandi
  kanit_tipi: test
  mock_guarded_count: 0
---
# T (para riski, testle doğrulanmış — GEÇMELİ)
`;

const T_NORMAL_OKUMA = `---
id: TECH-UI-001
feature_ids: [buton-rengi]
risk_sinifi: normal
test_anchors:
  - behavior: "buton rengi doğru"
    anchor: "frontend:ButtonTest#RendersCorrectColor"
    mock_depth: real
verification:
  status: dogrulandi
  kanit_tipi: okuma
  mock_guarded_count: 0
---
# T (normal risk, sadece kod okunarak doğrulanmış — bu dal TETİKLENMEMELİ)
`;

test('coverage-gate: 🔴 P0-REPRO — risk_sinifi: para + kanit_tipi: okuma + dogrulandi → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/tech/pay.md', T_PARA_OKUMA);
  write(d, 'docs/user/odeme-onayi.md', l0('[../tech/pay.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/odeme-onayi.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /P0-REPRO EKSİK/);
});

test('coverage-gate: risk_sinifi: para + kanit_tipi: test + dogrulandi → geçer (kanıt yeterli)', () => {
  const d = initRepo();
  write(d, 'docs/tech/pay.md', T_PARA_TEST);
  write(d, 'docs/user/odeme-onayi.md', l0('[../tech/pay.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/odeme-onayi.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('coverage-gate: risk_sinifi: normal + kanit_tipi: okuma + dogrulandi → geçer (yanlış alarm yok)', () => {
  const d = initRepo();
  write(d, 'docs/tech/ui.md', T_NORMAL_OKUMA);
  write(d, 'docs/user/buton-rengi.md', l0('[../tech/ui.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/buton-rengi.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

const T_PARA_KANIT_TIPI_YOK = `---
id: TECH-PAY-006
feature_ids: [odeme-onayi]
risk_sinifi: para
test_anchors:
  - behavior: "çifte tahsilat engellenir"
    anchor: "backend:PaymentService#PreventDoubleCharge"
    mock_depth: real
verification:
  status: dogrulandi
  mock_guarded_count: 0
---
# T (para riski, kanit_tipi alanı hiç yazılmamış — YAKALANMALI)
`;

test('coverage-gate: 🔴 P0-REPRO KAÇAK — risk_sinifi: para + kanit_tipi HİÇ YAZILMAMIŞ + dogrulandi → --strict FAIL', () => {
  const d = initRepo();
  write(d, 'docs/tech/pay6.md', T_PARA_KANIT_TIPI_YOK);
  write(d, 'docs/user/odeme-onayi6.md', l0('[../tech/pay6.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/odeme-onayi6.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /P0-REPRO EKSİK/);
});

const T_GIZLI_P0 = `---
feature_ids: [iade]
risk_sinifi: normal
test_anchors:
  - {behavior: "addCredits", anchor: "b:CreditService#AddCredits", mock_depth: real}
verification:
  status: dogrulandi
  kanit_tipi: okuma
  mock_guarded_count: 0
---
# Para iadesi addCredits ile yapilir
`;
const T_DURUST_NORMAL = `---
feature_ids: [tema]
risk_sinifi: normal
test_anchors:
  - {behavior: "tema", anchor: "b:ThemeService#Toggle", mock_depth: real}
verification:
  status: dogrulandi
  kanit_tipi: okuma
  mock_guarded_count: 0
---
# Kullanici temayi (renk) degistirir
`;

test('coverage-gate: 🔴 GİZLİ P0 — para sinyali (addCredits) + risk_sinifi:normal + okuma → FAIL', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_GIZLI_P0);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /GİZLİ P0/);
});

test('coverage-gate: DÜRÜST normal (para sinyali YOK) + okuma → geçer (yanlış alarm yok)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth.md', T_DURUST_NORMAL);
  write(d, 'docs/user/sifre-sifirlama.md', l0('[../tech/auth.md]', 'tam'));
  const r = run('check-provenance.mjs', ['--rule=coverage-gate', 'docs/user/sifre-sifirlama.md', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ============================================================================
// --rule=registry-join (eski tests/check-registry-join.test.mjs, BİREBİR taşındı)
// ============================================================================
test('registry-join: registry dosyası yoksa sessizce geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/x.md', '---\nfeature_ids: []\n---\n# X\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /registry dosyası yok/);
});

test('registry-join: tutarlı registry + [T] geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/auth/sifre-sifirlama.md', '---\nfeature_ids: [sifre-sifirlama]\n---\n# T\n');
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/auth/sifre-sifirlama.md\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Registry-join OK/);
});

test('registry-join: yetim [T] (feature_ids boş) UYARI verir ama geçer (exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/orphan.md', '---\nfeature_ids: []\n---\n# T\n');
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  baska-feature:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/dolu.md\n');
  write(d, 'docs/tech/dolu.md', '---\nfeature_ids: [baska-feature]\n---\n# T\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /YETİM \[T\]/);
});

test('registry-join: ölü yol (registry var-olmayan [T] dosyasına işaret ediyor) fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/olmayan.md\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ÖLÜ YOL/);
});

test('registry-join: [T] kendini olmayan feature_id\'e ait sayıyor fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'docs/tech/x.md', '---\nfeature_ids: [olmayan-feature]\n---\n# T\n');
  write(d, 'docs/registry.yaml', 'features:\n  baska-feature:\n    tech_docs: []\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ÇAPRAZ TUTARSIZLIK/);
  assert.match(r.out, /registry'de "olmayan-feature" YOK/);
});

test('registry-join: [T] feature_ids\'te var ama registry.tech_docs onu listelemiyor fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'docs/tech/x.md', '---\nfeature_ids: [sifre-sifirlama]\n---\n# T\n');
  write(d, 'docs/registry.yaml', 'features:\n  sifre-sifirlama:\n    tech_docs: []\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ÇAPRAZ TUTARSIZLIK/);
  assert.match(r.out, /LİSTELEMİYOR/);
});

test('registry-join: registry [T]\'yi listeliyor ama [T]\'nin feature_ids\'i onu içermiyor fail (exit 1, TERS yön)', () => {
  const d = initRepo();
  write(d, 'docs/tech/x.md', '---\nfeature_ids: [baska-gorev]\n---\n# T\n');
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/x.md\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ÇAPRAZ TUTARSIZLIK/);
  assert.match(r.out, /İÇERMİYOR/);
});

test('registry-join: registry [T]\'yi listeliyor ama dosyanın feature_ids alanı yok fail (exit 1)', () => {
  const d = initRepo();
  write(d, 'docs/tech/x.md', '# Frontmatter yok\n');
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/x.md\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /feature_ids alanı yok/);
});

test('registry-join: bir [T] birden çok feature\'a ait olabilir (çoklu-üyelik meşru, exit 0)', () => {
  const d = initRepo();
  write(d, 'docs/tech/login.md', '---\nfeature_ids: [sifre-sifirlama, giris-yapma]\n---\n# T\n');
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/login.md\n' +
    '  giris-yapma:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/login.md\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('registry-join: çözünürlük oranı düşükse (--strict olmadan) UYARI, geçer (exit 0)', () => {
  const d = initRepo();
  const lines = ['features:'];
  for (let i = 1; i <= 10; i++) {
    lines.push(`  feat-${i}:`);
    lines.push(i === 1 ? '    tech_docs:\n      - docs/tech/x.md' : '    tech_docs: []');
  }
  write(d, 'docs/tech/x.md', '---\nfeature_ids: [feat-1]\n---\n# T\n');
  write(d, 'docs/registry.yaml', lines.join('\n') + '\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /ÇÖZÜNÜRLÜK ORANI DÜŞÜK/);
});

test('registry-join: çözünürlük oranı düşükse --strict ile fail (exit 1)', () => {
  const d = initRepo();
  const lines = ['features:'];
  for (let i = 1; i <= 10; i++) {
    lines.push(`  feat-${i}:`);
    lines.push(i === 1 ? '    tech_docs:\n      - docs/tech/x.md' : '    tech_docs: []');
  }
  write(d, 'docs/tech/x.md', '---\nfeature_ids: [feat-1]\n---\n# T\n');
  write(d, 'docs/registry.yaml', lines.join('\n') + '\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join', 'docs/registry.yaml', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ÇÖZÜNÜRLÜK ORANI DÜŞÜK/);
});

test('registry-join: çok-satırlı YAML liste biçimindeki feature_ids doğru okunur (exit 0, regresyon)', () => {
  const d = initRepo();
  write(d, 'docs/tech/multi.md', '---\nfeature_ids:\n  - sifre-sifirlama\n  - giris-yapma\n---\n# T\n');
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/multi.md\n' +
    '  giris-yapma:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/multi.md\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Registry-join OK/);
});

test('registry-join: CRLF satır sonlu [T] dosyası tanınır (exit 0, regresyon — Windows repo)', () => {
  const d = initRepo();
  write(d, 'docs/tech/crlf.md', '---\r\nfeature_ids: [sifre-sifirlama]\r\n---\r\n# T\r\n');
  write(d, 'docs/registry.yaml',
    'features:\n' +
    '  sifre-sifirlama:\n' +
    '    tech_docs:\n' +
    '      - docs/tech/crlf.md\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Registry-join OK/);
});

test('registry-join: .template.md dosyaları [T] taraması dışında tutulur (exit 0)', () => {
  const d = initRepo();
  write(d, 'templates/T-teknik-dokuman.template.md', '---\nfeature_ids: []\n---\n# Şablon\n');
  write(d, 'docs/registry.yaml', 'features:\n  bir-feature:\n    tech_docs: []\n');
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=registry-join'], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /templates\/T-teknik-dokuman\.template\.md/);
});

// ============================================================================
// --rule=config-flags (v0.20 — konfig ekseni, pilot geri bildirimi 2026-08-11 §5.1)
// İKİ YÖNLÜ DOĞUM (doctrine v0.20): her kapı hem YAKALAMA (bozuğu yakalar) hem GEÇİRME
// (meşruyu geçirir) kontrolüyle doğar. İkisi de aşağıda; geçirme tarafı ayrıca 10-dokümanlık
// gerçekçi DOĞRU korpusla ölçülür — FRICTION_LOG 2026-08-04 dersi: birim testler mutlu-yol +
// tek negatif vakayla yeşile döner ve FP'yi tetikleyen koşulu hiç denemez.
// ============================================================================
const SOZLUK = [
  '# Ozellik Sozlugu', '',
  '```yaml',
  'canonical_source: backend',
  'consumers: [web, mobil]',
  'features:',
  '  - name: LoyaltyProgram',
  '    enforced_in: backend',
  '    checks: 83',
  '  - name: BankModule',
  '    enforced_in: backend',
  '    checks: 4',
  '```',
].join('\n');

// Mesru [L0]: kosullu ozellik, dort alan dolu, ad sozlukte VAR.
const L0_KOSULLU = [
  '---',
  'id: TR-TRAVEL-001',
  'feature_id: harcirah-hesaplama',
  'availability: flag_gated',
  'requires_features: []',
  'config_flags:',
  '  paid_feature: LoyaltyProgram',
  '  company_settings:',
  '    - field: IsSubsistenceCalculationActive',
  '      default: false',
  '      when_false: engel',
  '      etki: "kapaliysa harcirah hesaplama tumden reddedilir"',
  '---',
  '# Harcirah',
].join('\n');

// Mesru [L0]: OLCULDU ve kosul YOK — `paid_feature: null` + availability: always.
// Bu, kapinin en kritik GECIRME vakasi: "bos birakmak da bir cevaptir" hali.
const L0_KOSULSUZ = [
  '---',
  'id: TR-PROFIL-001',
  'feature_id: profil-guncelleme',
  'availability: always',
  'requires_features: []',
  'config_flags:',
  '  paid_feature: null',
  '  company_settings: []',
  '---',
  '# Profil',
].join('\n');

test('config-flags: sözlük YOKSA tümüyle no-op (exit 0) — kullanmayan ödemez', () => {
  const d = tmp();
  const l0 = write(d, 'docs/user/x.md', L0_KOSULSUZ);
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no-op/);
});

test('config-flags: GEÇİRME — koşullu meşru [L0] temiz geçer (--strict, exit 0)', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/travel.md', L0_KOSULLU);
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('config-flags: GEÇİRME — "ölçüldü, koşul yok" (paid_feature: null + always) temiz geçer', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/profil.md', L0_KOSULSUZ);
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('config-flags: GEÇİRME — 10 gerçekçi DOĞRU [L0] korpusunda 0 yanlış-pozitif', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const dosyalar = [];
  for (let i = 0; i < 5; i++) {
    dosyalar.push(write(d, `docs/user/kosullu-${i}.md`,
      L0_KOSULLU.replace('TR-TRAVEL-001', `TR-T-00${i}`).replace('harcirah-hesaplama', `ozellik-${i}`)));
    dosyalar.push(write(d, `docs/user/kosulsuz-${i}.md`,
      L0_KOSULSUZ.replace('TR-PROFIL-001', `TR-P-00${i}`).replace('profil-guncelleme', `sade-${i}`)));
  }
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', ...dosyalar], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /10 \[L0\]/);
});

test('config-flags: YAKALAMA — config_flags: {} (ölçülmedi mi, yok mu belirsiz) → --strict exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/bos.md', [
    '---', 'id: TR-X-001', 'availability: always', 'config_flags: {}', '---', '# X',
  ].join('\n'));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /hiç BAKILMADI|paid_feature: null/);
});

test('config-flags: YAKALAMA — flag_gated beyanı dayanaksız (koşul yok) → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/dayanaksiz.md', [
    '---', 'id: TR-X-002', 'availability: flag_gated',
    'config_flags:', '  paid_feature: null', '  company_settings: []', '---', '# X',
  ].join('\n'));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /dayanaksız/i);
});

test('config-flags: YAKALAMA — availability: always ama gerçek koşul VAR → çelişki, exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/celiski.md',
    L0_KOSULLU.replace('availability: flag_gated', 'availability: always'));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /çelişki/i);
});

test('config-flags: YAKALAMA — when_false kapalı-küme dışı değer → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/sinif.md', L0_KOSULLU.replace('when_false: engel', 'when_false: belki'));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /gorunurluk|geçersiz/i);
});

test('config-flags: YAKALAMA — company_settings zorunlu alanı eksik (etki yok) → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/eksik.md',
    L0_KOSULLU.replace('      etki: "kapaliysa harcirah hesaplama tumden reddedilir"\n', ''));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /etki/);
});

test('config-flags: YAKALAMA — paid_feature sözlükte YOK (çok-repo ad drifti) → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/drift.md', L0_KOSULLU.replace('LoyaltyProgram', 'loyaltyprogram'));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /sözlükte YOK/);
});

test('config-flags: YAKALAMA — availability hiç beyan edilmemiş → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/beyansiz.md', [
    '---', 'id: TR-X-003', 'feature_id: bir-sey', '---', '# X',
  ].join('\n'));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /availability/);
});

test('config-flags: YAKALAMA — sözlükte canonical_source boş (çok-repo sahipliği beyansız) → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK.replace('canonical_source: backend', 'canonical_source:'));
  const l0 = write(d, 'docs/user/x.md', L0_KOSULSUZ);
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /canonical_source/);
});

test('config-flags: YAKALAMA — sözlükte makine-okunur yaml bloğu YOK → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', '# Sozluk\n\nSadece nesir, tablo yok.\n');
  const l0 = write(d, 'docs/user/x.md', L0_KOSULSUZ);
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /yaml/i);
});

test('config-flags: VARSAYILAN uyarıdır — bulgu varken bayraksız exit 0', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/bos.md', [
    '---', 'id: TR-X-004', 'availability: always', 'config_flags: {}', '---', '# X',
  ].join('\n'));
  const r = run('check-provenance.mjs', ['--rule=config-flags', l0], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /UYARI/);
});

test('config-flags: --dictionary= ile sözlük yolu override edilir', () => {
  const d = tmp();
  write(d, 'ozel/sozluk.md', SOZLUK);
  const l0 = write(d, 'docs/user/x.md', L0_KOSULLU);
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--dictionary=ozel/sozluk.md', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ============================================================================
// v0.20.1 — ŞEMA BOOLEAN VARSAYIMINDAN ÇIKTI + [T] ÇAPRAZ KONTROLÜ
// Ölçüm (hedef repo, 2026-08-12): ayar alanlarının yaklaşık üçte biri bool DEĞİL — `when_false`
// onlarda anlamsız. Değişiklik EKLEME'dir: `when_false` kısayolu AYNEN çalışır (sahada
// 22 dosyada dolu; migrasyon borcu yaratılmadı).
// ============================================================================
const T_KOSULLU = [
  '---', 'id: TECH-TRAVEL-1', 'feature_ids: [harcirah-hesaplama]',
  'flags:', '  - ad: LoyaltyProgram', '    etki_sinifi: engel',
  'anchors: []', '---', '# T',
].join('\n');
const T_BOS = [
  '---', 'id: TECH-TRAVEL-1', 'feature_ids: [harcirah-hesaplama]',
  'flags: []', 'anchors: []', '---', '# T',
].join('\n');
const l0WithT = (cfBlock) => [
  '---', 'id: TR-A-001', 'feature_id: a', 'availability: flag_gated',
  'requires_features: []', 'config_flags:', cfBlock,
  'anchors:', '  tech_docs: [docs/tech/x.md]', '---', '# A',
].join('\n');
const CF_KOSULLU = [
  '  paid_feature: LoyaltyProgram',
  '  company_settings:',
  '    - field: IsSubsistenceActive',
  '      default: false',
  '      when_false: engel',
  '      etki: "kapaliysa reddedilir"',
].join('\n');

test('config-flags: GEÇİRME — geriye-uyum, `tip` YAZILMAMIŞ eski when_false biçimi geçer', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  write(d, 'docs/tech/x.md', T_KOSULLU);
  const l0 = write(d, 'docs/user/a.md', l0WithT(CF_KOSULLU));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('config-flags: GEÇİRME — bool OLMAYAN ayar (tip: sayi + kosul + etki_sinifi) geçer', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  write(d, 'docs/tech/x.md', T_KOSULLU);
  const l0 = write(d, 'docs/user/a.md', l0WithT([
    '  paid_feature: LoyaltyProgram',
    '  company_settings:',
    '    - field: MaxOrderAmount',
    '      tip: sayi',
    '      default: 5000',
    '      kosul: "talep tutari bu degeri asarsa"',
    '      etki_sinifi: kisit',
    '      etki: "tutar ustundeki talep gonderilemez"',
  ].join('\n')));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('config-flags: GEÇİRME — ölçülerek eklenen 5. sınıf `kapsam` kabul edilir', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  write(d, 'docs/tech/x.md', T_KOSULLU);
  const l0 = write(d, 'docs/user/a.md', l0WithT(CF_KOSULLU.replace('when_false: engel', 'when_false: kapsam')));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('config-flags: YAKALAMA — tip: sayi iken when_false ANLAMSIZ → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  write(d, 'docs/tech/x.md', T_KOSULLU);
  const l0 = write(d, 'docs/user/a.md', l0WithT([
    '  paid_feature: LoyaltyProgram',
    '  company_settings:',
    '    - field: MaxOrderAmount', '      tip: sayi', '      default: 5000',
    '      when_false: kisit', '      kosul: "asarsa"', '      etki_sinifi: kisit',
    '      etki: "x"',
  ].join('\n')));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ANLAMSIZ/);
});

test('config-flags: YAKALAMA — tip: sayi ama kosul YOK (değere bağlı davranış tarifsiz) → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  write(d, 'docs/tech/x.md', T_KOSULLU);
  const l0 = write(d, 'docs/user/a.md', l0WithT([
    '  paid_feature: LoyaltyProgram',
    '  company_settings:',
    '    - field: MaxOrderAmount', '      tip: sayi', '      default: 5000',
    '      etki_sinifi: kisit', '      etki: "x"',
  ].join('\n')));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /kosul.*ZORUNLU|ZORUNLU/);
});

test('config-flags: YAKALAMA — geçersiz tip → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  write(d, 'docs/tech/x.md', T_KOSULLU);
  const l0 = write(d, 'docs/user/a.md', l0WithT(CF_KOSULLU.replace('      default: false', '      tip: tarih\n      default: false')));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /tip: tarih.*geçersiz|geçersiz/);
});

test('config-flags: 🔴 YAKALAMA — [L0] koşul diyor, besleyen [T] `flags: []` diyor → ÇELİŞKİ', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  write(d, 'docs/tech/x.md', T_BOS);
  const l0 = write(d, 'docs/user/a.md', l0WithT(CF_KOSULLU));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /ÇELİŞKİ/);
  assert.match(r.out, /ÇAĞIRDIĞI SERVİSE/);
});

test('config-flags: YAKALAMA — [T] flags maddesinde etki_sinifi eksik → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  write(d, 'docs/tech/x.md', T_KOSULLU.replace('    etki_sinifi: engel\n', ''));
  const l0 = write(d, 'docs/user/a.md', l0WithT(CF_KOSULLU));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /etki_sinifi/);
});

test('config-flags: YAKALAMA — [T] flags adı sözlükte yok (ad drifti) → exit 1', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  write(d, 'docs/tech/x.md', T_KOSULLU.replace('ad: LoyaltyProgram', 'ad: loyaltyprogram'));
  const l0 = write(d, 'docs/user/a.md', l0WithT(CF_KOSULLU));
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /sözlükte YOK/);
});

test('config-flags: GEÇİRME — [T] YOKSA çapraz kontrol sessizdir (coverage-gate işi)', () => {
  const d = tmp();
  write(d, 'docs/FEATURE-DICTIONARY.md', SOZLUK);
  const l0 = write(d, 'docs/user/a.md', l0WithT(CF_KOSULLU));   // docs/tech/x.md YAZILMADI
  const r = run('check-provenance.mjs', ['--rule=config-flags', '--strict', l0], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

// ============================================================================
// --rule=integration-cards (v0.27 — dış-sistem ekseni, saha vakası 2026-09-26: AWS SES iki
// bölgede, biri sandbox; ajan bölge boyutunu bilmeden "sandbox" dedi ve ~1 saat ısrar etti)
// İKİ YÖNLÜ DOĞUM: YAKALAMA (kartsız SDK, boş alan, URL olmayan kaynak) + GEÇİRME (gerçekçi
// DOĞRU kart korpusu 0 yanlış-pozitif; SDK yoksa no-op; bayat kart --strict'i bloke etmez).
// ============================================================================
const bugunISO = () => new Date().toISOString().slice(0, 10);
const kart = ({ servis = 'AWS SES', paketler = '[@aws-sdk/client-sesv2]',
  kaynak = 'https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html',
  dogrulandi = bugunISO(), boyutlar = '[bolge, ortam]',
  prob = '"aws sesv2 get-account --region <bolge>"' } = {}) => [
  '---',
  `servis: ${servis}`,
  `paketler: ${paketler}`,
  `kaynak: ${kaynak}`,
  `dogrulandi: ${dogrulandi}`,
  `boyutlar: ${boyutlar}`,
  `prob: ${prob}`,
  '---',
  '# Kart',
  '| bolge=eu-west-1 | production | ProductionAccessEnabled: true | [ÖLÇÜLDÜ] |',
  '| bolge=us-east-1 | sandbox | ProductionAccessEnabled: false | [ÖLÇÜLDÜ] |',
].join('\n');
const pkg = (deps) => JSON.stringify({ name: 'x', dependencies: deps });

test('integration-cards: dış SDK YOKSA tümüyle no-op (exit 0) — kullanmayan ödemez', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ express: '^4', nodemailer: '^6', axios: '^1' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /no-op/);
});

test('integration-cards: 🔴 YAKALAMA — SES vakası: SDK var, kart YOK → --strict exit 1', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /AWS: @aws-sdk\/client-sesv2 {2}→ {2}entegrasyon kartı YOK/);
});

test('integration-cards: GEÇİRME — SES kartı bölge boyutuyla dolu → --strict exit 0', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  write(d, 'docs/integrations/aws-ses.md', kart());
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 dış SDK paketi 1 karta bağlı/);
});

test('integration-cards: GEÇİRME — gerçekçi DOĞRU korpus (npm+NuGet+pip, önek, boyutlar: yok) 0 yanlış-pozitif', () => {
  const d = tmp();
  const m1 = write(d, 'web/package.json', pkg({ stripe: '^14', '@aws-sdk/client-s3': '^3',
    '@aws-sdk/client-sesv2': '^3', '@types/node': '^20', openai: '^4' }));
  const m2 = write(d, 'api/Api.csproj', '<Project><ItemGroup>\n' +
    '<PackageReference Include="AWSSDK.Core" Version="3.7" />\n' +
    '<PackageReference Include="AWSSDK.SimpleEmailV2" Version="3.7" />\n' +
    '<PackageReference Include="Stripe.net" Version="43" />\n' +
    '<PackageReference Include="Newtonsoft.Json" Version="13" />\n</ItemGroup></Project>');
  const m3 = write(d, 'jobs/requirements.txt', '# worker\nboto3==1.34\nrequests>=2\n-r base.txt\n');
  write(d, 'docs/integrations/aws.md', kart({ servis: 'AWS', paketler: '[@aws-sdk/*, AWSSDK.*, boto3]' }));
  write(d, 'docs/integrations/stripe.md', kart({ servis: 'Stripe', paketler: '[stripe, Stripe.net]',
    kaynak: 'https://docs.stripe.com/keys', boyutlar: '[ortam, hesap]', prob: '"stripe balance retrieve"' }));
  write(d, 'docs/integrations/openai.md', kart({ servis: 'OpenAI', paketler: '[openai]',
    kaynak: 'https://platform.openai.com/docs/models', boyutlar: 'yok', prob: '"openai models list"' }));
  write(d, 'docs/integrations/README.md', '# Kartlar\nbu dizin entegrasyon kartlarını tutar');
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m1, m2, m3], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /8 dış SDK paketi 3 karta bağlı/);
});

test('integration-cards: YAKALAMA — kartta boyutlar BOŞ (bölünme biçimi sorulmamış) → exit 1', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  write(d, 'docs/integrations/aws-ses.md', kart({ boyutlar: '[]' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /boş\/eksik alan: boyutlar/);
});

test('integration-cards: YAKALAMA — doldurulmamış şablon alanı (dogrulandi/prob) → exit 1', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ twilio: '^5' }));
  write(d, 'docs/integrations/twilio.md', kart({ servis: 'Twilio', paketler: '[twilio]',
    prob: '"{{SALT_OKUR_KOMUT}}"', dogrulandi: '{{YYYY-AA-GG}}' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /dogrulandi, prob/);
});

test('integration-cards: YAKALAMA — kaynak URL değil ("hafızadan") → exit 1', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  write(d, 'docs/integrations/aws-ses.md', kart({ kaynak: 'hafizadan-biliyorum' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /`kaynak` bir URL değil/);
});

test('integration-cards: YAKALAMA — kart başka servisi kapsıyor, bu SDK açıkta kalıyor → exit 1', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3', '@azure/storage-blob': '^12' }));
  write(d, 'docs/integrations/aws.md', kart({ paketler: '[@aws-sdk/*]' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Azure: @azure\/storage-blob/);
  assert.doesNotMatch(r.out, /AWS: /);
});

test('integration-cards: bayat kart NOT düşer ama --strict ile bile BLOKE ETMEZ', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  write(d, 'docs/integrations/aws-ses.md', kart({ dogrulandi: '2020-01-01' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /bayat kart/);
});

test('integration-cards: VARSAYILAN uyarıdır — kartsız SDK varken bayraksız exit 0', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ stripe: '^14' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', m], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /INTEGRATION-CARDS UYARI/);
});

// --- hakem turu (K75, B-1 + U-1…U-8) regresyon nöbetçileri --------------------------------
test('integration-cards: 🔴 YAKALAMA (hakem B-1) — GERÇEK şablondan kopyalanıp boyutlar doldurulmamış kart → exit 1', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  const sablon = readFileSync(join(HERE_T, '..', 'templates', 'entegrasyon-karti.template.md'), 'utf8')
    .replace('{{SERVIS_ADI}}', 'AWS SES').replace('"{{PAKET}}"', '"@aws-sdk/*"')
    .replace('{{RESMI_BELGE_URL}}', 'https://docs.aws.amazon.com/ses/').replace('{{YYYY-AA-GG}}', bugunISO())
    .replace('"{{SALT_OKUR_KOMUT}}"', '"aws sesv2 get-account"');   // boyutlar + gövde BİLEREK şablon hâlinde
  write(d, 'docs/integrations/aws-ses.md', sablon);
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /boş\/eksik alan: boyutlar/);
  assert.match(r.out, /gövdede \d+ doldurulmamış alan/);
});

test('integration-cards: YAKALAMA — liste öğesi TBD (dolu görünen ama cevap olmayan) → exit 1', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  write(d, 'docs/integrations/aws-ses.md', kart({ boyutlar: '[bolge, TBD]' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /boş\/eksik alan: boyutlar/);
});

test('integration-cards: YAKALAMA (hakem U-1) — argümanla verilen manifest diskte YOK → exit 1, "no-op" DEĞİL', () => {
  const d = tmp();
  const r = run('check-provenance.mjs', ['--rule=integration-cards', 'YOK-BOYLE.json'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /diskte YOK/);
  assert.doesNotMatch(r.out, /no-op/);
});

test('integration-cards: YAKALAMA (hakem U-3) — var olmayan gün ve GELECEK tarih → exit 1', () => {
  for (const tarih of ['2026-02-30', '2099-01-01']) {
    const d = tmp();
    const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
    write(d, 'docs/integrations/aws-ses.md', kart({ dogrulandi: tarih }));
    const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
    cleanup(d);
    assert.equal(r.status, 1, `${tarih}: ${r.out}`);
  }
});

test('integration-cards: YAKALAMA (hakem U-4) — --bayat-gun sayı değil → exit 1 (NOT sessizce susmaz)', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  write(d, 'docs/integrations/aws-ses.md', kart({ dogrulandi: '2020-01-01' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--bayat-gun=abc', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /pozitif tam sayı/);
});

test('integration-cards: YAKALAMA (hakem U-6) — `paketler: [*]` her servisi kapsamaz → exit 1', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ stripe: '^14' }));
  write(d, 'docs/integrations/hepsi.md', kart({ paketler: '["*"]' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /Stripe: stripe {2}→ {2}entegrasyon kartı YOK/);
  assert.match(r.out, /tek başına `\*`/);
});

test('integration-cards: GEÇİRME (hakem U-5/U-7) — çoklu prob/kaynak, blok prob, peerDeps, pip harf farkı → exit 0', () => {
  const d = tmp();
  const m1 = write(d, 'package.json', JSON.stringify({ name: 'x', peerDependencies: { openai: '^4' } }));
  const m2 = write(d, 'requirements.txt', 'Boto3==1.34\n');
  write(d, 'docs/integrations/aws.md', kart({ servis: 'AWS', paketler: '[boto3]',
    kaynak: '[https://docs.aws.amazon.com/ses/, https://docs.aws.amazon.com/general/latest/gr/ses.html]',
    prob: '\n  - "aws sesv2 get-account --region eu-west-1"\n  - "aws sesv2 get-account --region us-east-1"' }));
  write(d, 'docs/integrations/openai.md', kart({ servis: 'OpenAI', paketler: '["openai"]',
    kaynak: 'https://platform.openai.com/docs/models', boyutlar: 'yok', prob: '|\n  openai models list' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m1, m2], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /2 dış SDK paketi 2 karta bağlı/);
});

test('integration-cards: GEÇİRME (hakem Y-1) — gövdede KOD içindeki {{ad}} (e-posta şablon değişkeni) yer tutucu sayılmaz', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  write(d, 'docs/integrations/aws-ses.md', kart() +
    '\n## Tuzaklar\n- Şablon değişkeni `{{name}}` biçimindedir.\n```json\n{"Subject": "Merhaba {{name}}"}\n```\n');
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('integration-cards: YAKALAMA — boş gövdeli `prob: |` → exit 1', () => {
  const d = tmp();
  const m = write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  write(d, 'docs/integrations/aws-ses.md', kart({ prob: '|' }));
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict', m], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /boş\/eksik alan: prob/);
});

test('integration-cards: argümansız — manifesti git ls-files ile bulur, templates/ altını saymaz', () => {
  const d = initRepo();
  write(d, 'package.json', pkg({ '@aws-sdk/client-sesv2': '^3' }));
  write(d, 'templates/package.json', pkg({ stripe: '^14' }));
  write(d, 'docs/integrations/c.md', kart({ paketler: '[@aws-sdk/*]', kaynak: 'yanlis' }));
  git(d, 'add', '-A');
  const r = run('check-provenance.mjs', ['--rule=integration-cards', '--strict'], d);
  cleanup(d);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /1 dış SDK paketi/);
  assert.doesNotMatch(r.out, /Stripe/);
});
