// install-doctor birim testleri (v0.14 — K23): kurulum makbuzu mutabakatı + --seal mührü.
// Kalıp: tests/install-exam.test.mjs (runScript + izole fixture); verdict sözlüğü aynı
// (PASS/FAIL/ÖLÇÜLEMEDİ/UYGULANAMAZ; FAIL→exit 1, diğerleri tek başına düşürmez).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmp, write, runScript, cleanup } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const S = 'install-doctor.mjs';
const MAN = '.agentic-repo-setup.json';

function makbuz(d, { sealed = false, gate = 'gates/check-utf8.mjs' } = {}) {
  write(d, gate, '// generic kopya kapı\n');
  write(d, 'CLAUDE.md', '# Kurallar (repo-özgü)\n');
  const entry = sealed
    ? { path: gate, sha256: sha(join(d, gate)), sealed_at: '2026-07-27', skill_version: '0.14.0' }
    : gate;
  write(d, MAN, JSON.stringify({
    skill: 'agentic-repo-setup', skill_version: '0.14.0',
    generic_files: { gates: [entry], runner: [], ci: [] },
    repo_owned_files: ['CLAUDE.md'],
  }, null, 2));
  return gate;
}
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const sonuc = (out, id) => JSON.parse(out).results.find(r => r.id === id);

// ── MÜHÜR (--seal) ────────────────────────────────────────────────────────────
test('--seal: düz-yol girdilere sha256 mührü yazar, repo_owned dokunulmaz', () => {
  const d = tmp();
  const gate = makbuz(d);
  const r = runScript(S, ['--seal', '--target=.'], d);
  assert.equal(r.status, 0);
  const m = JSON.parse(readFileSync(join(d, MAN), 'utf8'));
  assert.equal(m.generic_files.gates[0].path, gate);
  assert.equal(m.generic_files.gates[0].sha256, sha(join(d, gate)));
  assert.deepEqual(m.repo_owned_files, ['CLAUDE.md']);   // string kaldı — hash YOK
  cleanup(d);
});

test('--seal: künyede kayıtlı dosya diskte yoksa FAIL (yalan künye mühürlenmez)', () => {
  const d = tmp();
  makbuz(d);
  write(d, MAN, JSON.stringify({ skill_version: '0.14.0',
    generic_files: { gates: ['gates/YOK.mjs'] }, repo_owned_files: [] }));
  const r = runScript(S, ['--seal', '--target=.'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /diskte YOK/);
  cleanup(d);
});

// ── MUTABAKAT: temiz taraf ────────────────────────────────────────────────────
test('mühürlü + birebir → tüm kontroller PASS, exit 0', () => {
  const d = tmp();
  makbuz(d, { sealed: true });
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0);
  for (const id of ['①', '②', '③', '④']) assert.equal(sonuc(r.out, id).verdict, 'PASS', id);
  cleanup(d);
});

// ── MUTABAKAT: yakalama tarafı ────────────────────────────────────────────────
test('generic dosya SİLİNMİŞSE ② FAIL (aşınmış kurulum), exit 1', () => {
  const d = tmp();
  write(d, MAN, JSON.stringify({ skill_version: '0.14.0',
    generic_files: { gates: ['gates/silinmis.mjs'] }, repo_owned_files: [] }));
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 1);
  assert.equal(sonuc(r.out, '②').verdict, 'FAIL');
  cleanup(d);
});

test('mühürlü dosya DEĞİŞMİŞSE ③ FAIL (drift), exit 1 — doctor un varlık sebebi', () => {
  const d = tmp();
  const gate = makbuz(d, { sealed: true });
  write(d, gate, '// elle kurcalanmış kapı\n');
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 1);
  const x = sonuc(r.out, '③');
  assert.equal(x.verdict, 'FAIL');
  assert.match(x.detail, /repo_owned'a taşı/);   // reçete: tazele YA DA bilinçli fork beyanı
  cleanup(d);
});

test('repo_owned dosya İÇERİĞİ değişirse hiçbir kontrol düşmez (yaşayan doküman)', () => {
  const d = tmp();
  makbuz(d, { sealed: true });
  write(d, 'CLAUDE.md', '# Kurallar — tamamen yeniden yazıldı, bu MEŞRU\n');
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0);
  assert.equal(sonuc(r.out, '④').verdict, 'PASS');
  cleanup(d);
});

test('repo_owned dosya SİLİNMİŞSE ④ FAIL (varlık denetimi)', () => {
  const d = tmp();
  write(d, MAN, JSON.stringify({ skill_version: '0.14.0',
    generic_files: { gates: [] }, repo_owned_files: ['CLAUDE.md'] }));
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 1);
  assert.equal(sonuc(r.out, '④').verdict, 'FAIL');
  cleanup(d);
});

// ── DÜRÜST SINIRLAR ───────────────────────────────────────────────────────────
test('makbuz YOKSA ① UYGULANAMAZ + exit 0 (makbuz-öncesi kurulum suçlanmaz)', () => {
  const d = tmp();
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0);
  const x = sonuc(r.out, '①');
  assert.equal(x.verdict, 'UYGULANAMAZ');
  assert.match(x.detail, /--seal/);   // mühür yolu gösterilir
  cleanup(d);
});

test('makbuz VAR ama BOZUKSA ① FAIL (yalan künye ≠ künyesizlik), exit 1', () => {
  const d = tmp();
  write(d, MAN, '{bozuk json');
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 1);
  assert.equal(sonuc(r.out, '①').verdict, 'FAIL');
  cleanup(d);
});

test('kimliksiz (mühürsüz) künyede ③ ÖLÇÜLEMEDİ + exit 0 — drift ölçülemez, uydurulmaz', () => {
  const d = tmp();
  makbuz(d, { sealed: false });
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0);
  const x = sonuc(r.out, '③');
  assert.equal(x.verdict, 'ÖLÇÜLEMEDİ');
  assert.match(x.detail, /--seal/);
  cleanup(d);
});

// ── 🔴 v0.14 hakem bulgusu B1 regresyonu: DÜZ-LİSTE künye ─────────────────────
// generic_files kategorisiz düz liste olduğunda seal "OK" deyip HİÇBİR mühür yazmıyordu
// (sarmalayıcı-referans kopması — yalan başarı). Bu test hem write-back'i hem ardından
// doctor'un mührü GÖRDÜĞÜNÜ kanıtlar.
test('düz-liste künyede --seal GERÇEKTEN yazar; ardından doctor ③ PASS (yalan-başarı regresyonu)', () => {
  const d = tmp();
  write(d, 'gates/check-utf8.mjs', '// generic kopya\n');
  write(d, MAN, JSON.stringify({ skill_version: '0.14.0',
    generic_files: ['gates/check-utf8.mjs'], repo_owned_files: [] }));
  const s = runScript(S, ['--seal', '--target=.'], d);
  assert.equal(s.status, 0);
  const m = JSON.parse(readFileSync(join(d, MAN), 'utf8'));
  assert.equal(m.generic_files[0].sha256?.length, 64, 'mühür künyeye YAZILMALI (yalan başarı yasak)');
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(sonuc(r.out, '③').verdict, 'PASS', r.out);
  cleanup(d);
});

// ── 🔴 v0.14 hakem bulgusu U1 regresyonu: CRLF bağışıklığı ────────────────────
// Ham-bayt hash'i, autocrlf'li taze clone'un CRLF smudge'ında TÜM metin dosyalarda sahte-drift
// üretirdi (v0.13.1 bundle-CRLF dersinin çapraz-makine hâli). Hash EOL-normalize edilir.
test('LF ile mühürlenen dosya CRLF\'e dönse de ③ PASS (sahte-drift yok); gerçek içerik değişimi yine FAIL', () => {
  const d = tmp();
  const gate = makbuz(d, { sealed: false, gate: 'gates/eol.mjs' });
  write(d, gate, 'satir bir\nsatir iki\n');
  runScript(S, ['--seal', '--target=.'], d);
  write(d, gate, 'satir bir\r\nsatir iki\r\n');            // yalnız EOL değişti
  let r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(sonuc(r.out, '③').verdict, 'PASS', r.out);
  write(d, gate, 'satir bir\r\nGERCEK degisiklik\r\n');    // içerik de değişti
  r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(sonuc(r.out, '③').verdict, 'FAIL', r.out);
  cleanup(d);
});

// ── verify.mjs dispatch (install-exam kalıbının aynısı) ──────────────────────
test('verify.mjs --doctor dispatch çalışır (exit + çıktı doctor\'dan)', () => {
  const d = tmp();
  makbuz(d, { sealed: true });
  const r = spawnSync(process.execPath,
    [join(HERE, '..', 'verify.mjs'), '--doctor', `--target=${d}`, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /"results"/);
  cleanup(d);
});

// ── v0.30 (G4): toggle üç-durum · fork beyanı · eski şema · T5 UYARI kontrolleri ───────────────
const kunyeYaz = (d, ek = {}) => write(d, MAN, JSON.stringify({
  skill: 'agentic-repo-setup', skill_version: '0.30.0',
  toggles: { muhatap: { pm_urun: false, qa_senaryo: false, son_kullanici_dokumani: false, test_koprusu: false },
             takip: { state: false, yan_bug: false } },
  generic_files: { gates: [], runner: [], ci: [] }, repo_owned_files: [], ...ek }, null, 2));

test('T1: toggle null = SORULMADI → ⑥ UYARI ama çıkış kodu DEĞİŞMEZ (eski kurulumlara yeni FAIL dayatılmaz)', () => {
  const d = tmp();
  kunyeYaz(d, { toggles: { muhatap: { pm_urun: null, qa_senaryo: false, son_kullanici_dokumani: false, test_koprusu: false },
                           takip: { state: null, yan_bug: false } } });
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0, r.out);
  const x = sonuc(r.out, '⑥');
  assert.equal(x.verdict, 'UYARI');
  assert.deepEqual(x.paths, ['muhatap.pm_urun', 'takip.state']);
  cleanup(d);
});

test('T1: tüm toggle cevaplı (true/false) → ⑥ PASS', () => {
  const d = tmp();
  kunyeYaz(d);
  assert.equal(sonuc(runScript(S, ['--target=.', '--json'], d).out, '⑥').verdict, 'PASS');
  cleanup(d);
});

test('T1: eski künyede (<0.30.0) muhatap false → BİLGİ "sorulmadan yazılmış olabilir"', () => {
  const d = tmp();
  kunyeYaz(d, { skill_version: '0.12.0' });
  const x = sonuc(runScript(S, ['--target=.', '--json'], d).out, '⑥');
  assert.equal(x.verdict, 'BİLGİ');
  assert.match(x.detail, /sorulmadan yazılmış olabilir/);
  cleanup(d);
});

// ── B10a fork ──
test('B10a: --fork makine yazar {path, sha256, fork:{neden,tarih,mühür_sha256}}; sonra drift FAIL DEĞİL, ⑦ BİLGİ', () => {
  const d = tmp();
  const gate = makbuz(d, { sealed: true });
  const muhur = JSON.parse(readFileSync(join(d, MAN), 'utf8')).generic_files.gates[0].sha256;
  write(d, gate, '// bilinçli yerel fork\n');
  let r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 1, 'fork beyanından önce drift FAIL');
  r = runScript(S, [`--fork=${gate}`, '--neden=TS tip sözdizimi yanlış-pozitifi', '--target=.'], d);
  assert.equal(r.status, 0, r.out);
  const e = JSON.parse(readFileSync(join(d, MAN), 'utf8')).generic_files.gates[0];
  assert.equal(e.path, gate);
  assert.equal(e.sha256, sha(join(d, gate)));
  assert.equal(e.fork.neden, 'TS tip sözdizimi yanlış-pozitifi');
  assert.equal(e.fork['mühür_sha256'], muhur);
  assert.match(e.fork.tarih, /^\d{4}-\d{2}-\d{2}$/);
  r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(sonuc(r.out, '③').verdict, 'ÖLÇÜLEMEDİ');
  const f = sonuc(r.out, '⑦');
  assert.equal(f.verdict, 'BİLGİ');
  assert.deepEqual(f.paths, [gate]);
  cleanup(d);
});

test('B10a: boş --neden REDDEDİLİR (künye değişmez); bilinmeyen yol REDDEDİLİR', () => {
  const d = tmp();
  const gate = makbuz(d, { sealed: true });
  const once = readFileSync(join(d, MAN), 'utf8');
  let r = runScript(S, [`--fork=${gate}`, '--neden=  ', '--target=.'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /neden/);
  r = runScript(S, [`--fork=${gate}`, '--target=.'], d);
  assert.equal(r.status, 1);
  r = runScript(S, ['--fork=gates/yok.mjs', '--neden=x', '--target=.'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /arasında yok/);
  assert.equal(readFileSync(join(d, MAN), 'utf8'), once, 'reddedilen komut künyeyi DEĞİŞTİRMEMELİ');
  cleanup(d);
});

// ── B10b eski şema ──
test('B10b: eski şema (audience_toggles, generic/owned listesi yok) normalize edilir; ölçülemeyen ÖLÇÜLEMEDİ; dosya yeniden YAZILMAZ', () => {
  const d = tmp();
  const eski = JSON.stringify({ skill: 'agentic-repo-setup', skill_version: '0.12.0', gates_contract_version: 1,
    audience_toggles: { product_management: true, qa_scenarios: true, user_facing_docs: false, test_bridge: false, ci: false },
    canonical_gate_directory: 'scripts/gates' }, null, 2);
  write(d, MAN, eski);
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.kunye.schema, 'audience (eski)');
  assert.equal(j.kunye.toggles.muhatap.pm_urun, true);
  assert.equal(j.kunye.toggles.muhatap.son_kullanici_dokumani, false);
  assert.equal(j.kunye.toggles.takip.state, null);
  assert.equal(sonuc(r.out, '②').verdict, 'ÖLÇÜLEMEDİ');
  assert.equal(sonuc(r.out, '③').verdict, 'ÖLÇÜLEMEDİ');
  assert.equal(sonuc(r.out, '④').verdict, 'ÖLÇÜLEMEDİ');
  assert.match(sonuc(r.out, '⑥b').detail, /audience_toggles\.ci/);
  assert.equal(readFileSync(join(d, MAN), 'utf8'), eski, 'normalize dosyaya YAZMAZ');
  cleanup(d);
});

// ── T5 git kontrolleri ──
const gitc = (d, ...a) => spawnSync('git', ['-C', d, ...a], { encoding: 'utf8' });
function gitRepo() {
  const d = tmp();
  gitc(d, 'init', '-q', '-b', 'main');
  gitc(d, 'config', 'user.email', 't@e.com'); gitc(d, 'config', 'user.name', 't'); gitc(d, 'config', 'commit.gpgsign', 'false');
  return d;
}
const commit = (d, msg) => { gitc(d, 'add', '-A'); gitc(d, 'commit', '-q', '--allow-empty', '-m', msg); };

test('T5(a): kurulum yalnız feature dalında → ⑧ UYARI (pilot vakası); ana dalda varsa PASS; exit 0', () => {
  const d = gitRepo();
  write(d, 'README.md', 'x\n'); commit(d, 'base');
  gitc(d, 'checkout', '-q', '-b', 'feat/kurulum');
  kunyeYaz(d); commit(d, 'kurulum');
  let r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(sonuc(r.out, '⑧').verdict, 'UYARI');
  assert.match(sonuc(r.out, '⑧').detail, /ekip ana dalda görmüyor/);
  gitc(d, 'checkout', '-q', 'main'); gitc(d, 'merge', '-q', 'feat/kurulum');
  r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(sonuc(r.out, '⑧').verdict, 'PASS');
  cleanup(d);
});

test('T5(a): git reposu değilse ⑧ ÖLÇÜLEMEDİ (tek başına düşürmez)', () => {
  const d = tmp();
  kunyeYaz(d);
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(sonuc(r.out, '⑧').verdict, 'ÖLÇÜLEMEDİ');
  cleanup(d);
});

test('T5(b): STATE son dokunuştan beri >30 commit → ⑨ UYARI "STATE bayat (N commit)"; ≤30 PASS', () => {
  const d = gitRepo();
  kunyeYaz(d, { toggles: { muhatap: { pm_urun: false, qa_senaryo: false, son_kullanici_dokumani: false, test_koprusu: false },
                           takip: { state: true, yan_bug: false } } });
  write(d, 'docs/STATE.md', '# durum\n'); commit(d, 'state');
  for (let i = 0; i < 5; i++) commit(d, `e${i}`);
  assert.equal(sonuc(runScript(S, ['--target=.', '--json'], d).out, '⑨').verdict, 'PASS');
  for (let i = 0; i < 26; i++) commit(d, `f${i}`);      // STATE'ten sonra toplam 31 > 30
  const r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(sonuc(r.out, '⑨').verdict, 'UYARI');
  assert.match(sonuc(r.out, '⑨').detail, /STATE bayat \(31 commit\)/);
  cleanup(d);
});

test('T5(c): doküman toggle açık + son kod commitlerinde doküman hiç dokunulmamış → ⑩ UYARI; dokunulmuşsa PASS', () => {
  const d = gitRepo();
  kunyeYaz(d, { toggles: { muhatap: { pm_urun: false, qa_senaryo: false, son_kullanici_dokumani: true, test_koprusu: false },
                           takip: { state: false, yan_bug: false } } });
  commit(d, 'kunye');                                   // künye commiti kod değil
  for (let i = 0; i < 3; i++) { write(d, `src/m${i}.ts`, `export const a${i} = ${i};\n`); commit(d, `kod${i}`); }
  write(d, 'docs/notlar.md', 'x\n'); write(d, 'tests/m0.test.ts', 't\n'); commit(d, 'docs ve test (kod sayılmaz)');
  let r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(sonuc(r.out, '⑩').verdict, 'UYARI');
  assert.match(sonuc(r.out, '⑩').detail, /son 3 kod commit.inin 0.ında/);
  write(d, 'src/m9.ts', 'export {};\n'); write(d, 'docs/user/giris.md', 'u\n'); commit(d, 'kod ve user doc');
  r = runScript(S, ['--target=.', '--json'], d);
  assert.equal(sonuc(r.out, '⑩').verdict, 'PASS');
  cleanup(d);
});

// ── v0.30.4: STATE yolu (kök → docs/ → docs/<alt>/) ──
test('v0.30.4: ⑨ docs/agentic/STATE.md bulunur (diskte YOK UYARI\'sı vermez) ve PASS', () => {
  const d = gitRepo();
  kunyeYaz(d, { toggles: { muhatap: { pm_urun: false, qa_senaryo: false, son_kullanici_dokumani: false, test_koprusu: false },
                           takip: { state: true, yan_bug: false } } });
  write(d, 'docs/agentic/STATE.md', '# durum\n'); commit(d, 'state');
  const r = runScript(S, ['--target=.', '--json'], d);
  const x = sonuc(r.out, '⑨');
  assert.equal(x.verdict, 'PASS', r.out);
  assert.match(x.detail, /docs\/agentic\/STATE\.md/);
  cleanup(d);
});

test('v0.30.4: ⑨ takip.state=true ve hiçbir yerde STATE.md yok → UYARI (kirli girdi)', () => {
  const d = gitRepo();
  kunyeYaz(d, { toggles: { muhatap: { pm_urun: false, qa_senaryo: false, son_kullanici_dokumani: false, test_koprusu: false },
                           takip: { state: true, yan_bug: false } } });
  commit(d, 'x');
  assert.equal(sonuc(runScript(S, ['--target=.', '--json'], d).out, '⑨').verdict, 'UYARI');
  cleanup(d);
});

// ── v0.30.4: --fork künyede KAYITSIZ dosya için girdiyi generic'e fork'lu ekler ──
test('v0.30.4: --fork künyede olmayan ama diskte duran dosyayı generic\'e fork\'lu EKLER; diskte yoksa RED', () => {
  const d = tmp();
  makbuz(d, { sealed: true });
  write(d, 'gates/lib/doc-integrity/integrity.mjs', '// yerel yama\n');
  let r = runScript(S, ['--fork=gates/lib/doc-integrity/integrity.mjs', '--neden=B7 yerel yama', '--target=.'], d);
  assert.equal(r.status, 0, r.out);
  const m = JSON.parse(readFileSync(join(d, MAN), 'utf8'));
  const e = m.generic_files.gates.find(x => x.path === 'gates/lib/doc-integrity/integrity.mjs');
  assert.ok(e, 'girdi eklenmeli');
  assert.equal(e.sha256, sha(join(d, 'gates/lib/doc-integrity/integrity.mjs')));
  assert.equal(e.fork.neden, 'B7 yerel yama');
  assert.equal(e.fork['mühür_sha256'], null);
  r = runScript(S, ['--fork=gates/lib/yok.mjs', '--neden=x', '--target=.'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /diskte de yok/);
  cleanup(d);
});

test('v0.30.4 hakem: ⑨ birden çok STATE adayında hangisinin seçildiği yazılır (kök öncelikli); docs/archive atlanır', () => {
  const d = gitRepo();
  kunyeYaz(d, { toggles: { muhatap: { pm_urun: false, qa_senaryo: false, son_kullanici_dokumani: false, test_koprusu: false },
                           takip: { state: true, yan_bug: false } } });
  write(d, 'STATE.md', '# kök\n'); write(d, 'docs/agentic/STATE.md', '# alt\n'); write(d, 'docs/archive/STATE.md', '# eski\n');
  commit(d, 'state');
  const x = sonuc(runScript(S, ['--target=.', '--json'], d).out, '⑨');
  assert.match(x.detail, /^STATE\.md /);
  assert.match(x.detail, /birden çok STATE adayı: STATE\.md, docs\/agentic\/STATE\.md — seçilen/);
  assert.doesNotMatch(x.detail, /archive/);
  cleanup(d);
});
