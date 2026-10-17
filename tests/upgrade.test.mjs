// upgrade birim testleri (v0.15 — K24): kurulum yükseltme/onarım.
// Kalıp: tests/install-doctor.test.mjs (izole fixture + runScript + JSON asserts).
// Fixture İKİ dizin kurar: sahte KAYNAK (paket) + HEDEF (kurulu repo) — gerçek pakete dokunmaz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmp, write, runScript, git, cleanup } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const S = 'upgrade.mjs';
const MAN = '.agentic-repo-setup.json';
const sha = (p) => createHash('sha256').update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const oku = (d, rel) => readFileSync(join(d, rel), 'utf8');
const kunye = (d) => JSON.parse(oku(d, MAN));

// KAYNAK paket fixture'ı: package.json + CONTRACT.md (sözleşme sürümü) + gates/
function kaynakKur(icerik = '// kapı v2\n', { contract = '1', version = '0.15.0' } = {}) {
  const s = tmp();
  write(s, 'package.json', JSON.stringify({ name: 'agentic-repo-setup', version }));
  write(s, 'CONTRACT.md', `# Kapı Sözleşmesi (gates_contract_version: ${contract})\n`);
  write(s, 'gates/check-utf8.mjs', icerik);
  return s;
}
// HEDEF repo fixture'ı: künye + kurulu (opsiyonel mühürlü) kapı
function hedefKur({ icerik = '// kapı v1\n', muhurlu = true, yol = 'gates/check-utf8.mjs',
                    contract = 1, version = '0.14.0', dosyaYaz = true } = {}) {
  const d = tmp();
  if (dosyaYaz) write(d, yol, icerik);
  const girdi = muhurlu && dosyaYaz
    ? { path: yol, sha256: sha(join(d, yol)), sealed_at: '2026-07-27', skill_version: version }
    : yol;
  write(d, MAN, JSON.stringify({
    skill: 'agentic-repo-setup', skill_version: version, gates_contract_version: contract,
    installed_at: '2026-07-01', last_upgraded_at: null, toggles: { muhatap: {} },
    generic_files: { gates: [girdi], runner: [], ci: [] },
    repo_owned_files: [], notes: 'fixture',
  }, null, 2));
  return d;
}
const durum = (out, p) => JSON.parse(out).plan.find(x => x.path === p)?.durum;

// ── TEMİZ TARAF (yanlış-alarm yokluğu) ────────────────────────────────────────
test('kaynak = hedef → GÜNCEL, tazelenecek yok, exit 0', () => {
  const s = kaynakKur('// aynı\n'), d = hedefKur({ icerik: '// aynı\n' });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d);
  assert.equal(r.status, 0);
  assert.equal(durum(r.out, 'gates/check-utf8.mjs'), 'GÜNCEL');
  cleanup(s); cleanup(d);
});

test('🔴 yalnız EOL farkı (LF kaynak / CRLF hedef) → GÜNCEL, sahte-bayatlık YOK', () => {
  const s = kaynakKur('satir bir\nsatir iki\n');
  const d = hedefKur({ icerik: 'satir bir\r\nsatir iki\r\n' });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d);
  assert.equal(durum(r.out, 'gates/check-utf8.mjs'), 'GÜNCEL', r.out);
  cleanup(s); cleanup(d);
});

test('künye yoksa UYGULANAMAZ + exit 0 (kurulmamış repo suçlanmaz)', () => {
  const s = kaynakKur(), d = tmp();
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d);
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.out).verdict, 'UYGULANAMAZ');
  cleanup(s); cleanup(d);
});

// ── YAKALAMA (upgrade'in varlık sebebi) ───────────────────────────────────────
test('mühürlü + drift yok + kaynaktan farklı → BAYAT; DRY-RUN dosyaya DOKUNMAZ', () => {
  const s = kaynakKur('// kapı v2\n'), d = hedefKur({ icerik: '// kapı v1\n' });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d);
  assert.equal(durum(r.out, 'gates/check-utf8.mjs'), 'BAYAT');
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// kapı v1\n', 'dry-run YAZMAMALI');
  cleanup(s); cleanup(d);
});

test('--apply → dosya tazelendi, künye mührü DİSKTEN yenilendi, last_upgraded_at yazıldı', () => {
  const s = kaynakKur('// kapı v2\n'), d = hedefKur({ icerik: '// kapı v1\n' });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(r.status, 0);
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// kapı v2\n');
  const m = kunye(d);
  assert.equal(m.generic_files.gates[0].sha256, sha(join(d, 'gates/check-utf8.mjs')));
  assert.equal(m.generic_files.gates[0].skill_version, '0.15.0');
  assert.ok(m.last_upgraded_at, 'last_upgraded_at yazılmalı');
  assert.equal(m.skill_version, '0.15.0', 'tam yükseltmede kök sürüm bump edilir');
  cleanup(s); cleanup(d);
});

test('--apply sonrası install-doctor ③ PASS (uçtan uca mutabakat zinciri)', () => {
  const s = kaynakKur('// kapı v2\n'), d = hedefKur({ icerik: '// kapı v1\n' });
  runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty'], d);
  const dr = runScript('install-doctor.mjs', [`--target=${d}`, '--json'], d);
  assert.equal(dr.status, 0);
  assert.equal(JSON.parse(dr.out).results.find(x => x.id === '③').verdict, 'PASS', dr.out);
  cleanup(s); cleanup(d);
});

// ── ÇAKIŞMA / KULLANICI-İŞİ KORUMA (EN KRİTİK) ────────────────────────────────
test('🔴 DRIFT\'li dosya --apply ile bile EZİLMEZ (kullanıcının işi silinmez)', () => {
  const s = kaynakKur('// kapı v2\n'), d = hedefKur({ icerik: '// kapı v1\n' });
  write(d, 'gates/check-utf8.mjs', '// KULLANICI elle değiştirdi\n');   // mühür artık uymuyor
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(durum(r.out, 'gates/check-utf8.mjs'), 'ATLANDI-DRIFT');
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// KULLANICI elle değiştirdi\n');
  assert.match(r.out, /repo_owned'a taşı/);
  cleanup(s); cleanup(d);
});

test('MÜHÜRSÜZ girdi --apply ile tazelenmez (bilgisizlik ≠ temizlik)', () => {
  const s = kaynakKur('// kapı v2\n'), d = hedefKur({ icerik: '// kapı v1\n', muhurlu: false });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(durum(r.out, 'gates/check-utf8.mjs'), 'ATLANDI-MÜHÜRSÜZ');
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// kapı v1\n');
  assert.match(r.out, /--seal/);
  cleanup(s); cleanup(d);
});

test('EKSİK dosya --apply ile geri KONULMAZ (silme kararı ölçülmeden cevaplanmaz)', () => {
  const s = kaynakKur(), d = hedefKur({ dosyaYaz: false });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(durum(r.out, 'gates/check-utf8.mjs'), 'ATLANDI-EKSİK');
  assert.equal(JSON.parse(r.out).yazilan.length, 0);
  cleanup(s); cleanup(d);
});

test('🔴 repo_owned dosyası ASLA tazelenmez — planda BİLE görünmez (ALTIN KURAL)', () => {
  const s = kaynakKur();
  write(s, 'templates/CLAUDE.template.md', '# ŞABLON — hedefe kopyalanmamalı\n');
  const d = hedefKur();
  write(d, 'CLAUDE.md', '# BENİM ölçülmüş rehberim\n');
  const m = kunye(d); m.repo_owned_files = ['CLAUDE.md'];
  writeFileSync(join(d, MAN), JSON.stringify(m, null, 2));
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(JSON.parse(r.out).plan.find(x => x.path === 'CLAUDE.md'), undefined, 'owned planda olmamalı');
  assert.equal(oku(d, 'CLAUDE.md'), '# BENİM ölçülmüş rehberim\n');
  cleanup(s); cleanup(d);
});

// ── ÖN-KAPILAR ────────────────────────────────────────────────────────────────
test('🔴 gates_contract_version uyuşmazlığı → BLOKE, exit 1, künye/dosya DEĞİŞMEZ (kaçış yok)', () => {
  const s = kaynakKur('// kapı v2\n', { contract: '2' });
  const d = hedefKur({ icerik: '// kapı v1\n', contract: 1 });
  const oncekiKunye = oku(d, MAN);
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /MİGRASYON/);
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// kapı v1\n');
  assert.equal(oku(d, MAN), oncekiKunye, 'künye byte-birebir kalmalı');
  cleanup(s); cleanup(d);
});

test('downgrade (paket < kurulum) → RED; --allow-downgrade ile geçer', () => {
  const s = kaynakKur('// eski paket\n', { version: '0.13.0' });
  const d = hedefKur({ icerik: '// kapı v1\n', version: '0.14.0' });
  let r = runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /DOWNGRADE/);
  r = runScript(S, [`--target=${d}`, `--source=${s}`, '--allow-downgrade', '--json'], d);
  assert.equal(r.status, 0);
  cleanup(s); cleanup(d);
});

test('--apply + TAZELENECEK dosya commit\'siz değişiklik taşıyorsa → RED; --allow-dirty geçer', () => {
  const s = kaynakKur('// kapı v2\n'), d = hedefKur({ icerik: '// kapı v1\n' });
  git(d, 'init', '-q'); git(d, 'config', 'user.email', 't@t'); git(d, 'config', 'user.name', 't');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  // hedef dosyayı mühre UYGUN kalacak şekilde değiştiremeyiz (drift olurdu) → mühür yenilenip
  // dosya commit'siz bırakılır: künye seal'lenmiş hâliyle commit'li, dosya çalışma ağacında kirli.
  write(d, 'gates/check-utf8.mjs', '// kapı v1b\n');
  const m = kunye(d);
  m.generic_files.gates[0].sha256 = sha(join(d, 'gates/check-utf8.mjs'));
  writeFileSync(join(d, MAN), JSON.stringify(m, null, 2));
  git(d, 'add', MAN); git(d, 'commit', '-q', '-m', 'seal');
  let r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply'], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /commit'lenmemiş/);
  r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty'], d);
  assert.equal(r.status, 0);
  cleanup(s); cleanup(d);
});

// 🔴 v0.15 e2e dogfood bulgusu: `--doctor --seal` künyeyi yazar; hemen ardından `--apply`
// koşulduğunda "künye commit'siz" diye REDDEDİLİYORDU (kısır döngü). Guard yalnız TAZELENECEK
// dosyaların kirliliğine bakar — künye ve ilgisiz dosyalar bloke ETMEZ.
test('ilgisiz kirli dosya + commit\'siz künye --apply\'ı BLOKE ETMEZ (seal→upgrade kısır döngüsü)', () => {
  const s = kaynakKur('// kapı v2\n'), d = hedefKur({ icerik: '// kapı v1\n' });
  git(d, 'init', '-q'); git(d, 'config', 'user.email', 't@t'); git(d, 'config', 'user.name', 't');
  git(d, 'add', 'gates'); git(d, 'commit', '-q', '-m', 'init');   // künye BİLEREK commit'siz
  write(d, 'baska-dosya.txt', 'ilgisiz kirlilik\n');
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// kapı v2\n');
  cleanup(s); cleanup(d);
});

test('--strict: dry-run\'da BAYAT varsa exit 1 (CI alarmı); --strict yoksa exit 0', () => {
  const s = kaynakKur('// kapı v2\n'), d = hedefKur({ icerik: '// kapı v1\n' });
  assert.equal(runScript(S, [`--target=${d}`, `--source=${s}`], d).status, 0);
  assert.equal(runScript(S, [`--target=${d}`, `--source=${s}`, '--strict'], d).status, 1);
  cleanup(s); cleanup(d);
});

// ── YOL EŞLEME (süpervizör kararı: ad-ile-arama, TEK eşleşmede kabul) ──────────
test('hedef kapıyı scripts/ altına kopyalamışsa ad-eşleşmesiyle bulunur (tek eşleşme)', () => {
  const s = kaynakKur('// kapı v2\n');
  const d = hedefKur({ icerik: '// kapı v1\n', yol: 'scripts/check-utf8.mjs' });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d);
  const kayit = JSON.parse(r.out).plan[0];
  assert.equal(kayit.durum, 'BAYAT');
  assert.match(kayit.kaynak, /ad-eşleşmesi/);
  cleanup(s); cleanup(d);
});

test('ad BELİRSİZSE (2+ eşleşme) → ÖLÇÜLEMEDİ, uydurma yok', () => {
  const s = kaynakKur('// kapı v2\n');
  write(s, 'gates/lib/check-utf8.mjs', '// ikinci eşleşme (izin listesi içinde)\n');
  const d = hedefKur({ icerik: '// kapı v1\n', yol: 'tools/check-utf8.mjs' });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(durum(r.out, 'tools/check-utf8.mjs'), 'ÖLÇÜLEMEDİ');
  assert.equal(oku(d, 'tools/check-utf8.mjs'), '// kapı v1\n');
  cleanup(s); cleanup(d);
});

// ── KISMİ BAŞARI / KÜNYE BÜTÜNLÜĞÜ ────────────────────────────────────────────
test('kısmi yükseltmede kök skill_version BUMP EDİLMEZ (yalan künye yasağı)', () => {
  const s = kaynakKur('// kapı v2\n');
  write(s, 'gates/check-secrets.mjs', '// secrets v2\n');
  const d = hedefKur({ icerik: '// kapı v1\n' });
  write(d, 'gates/check-secrets.mjs', '// secrets v1\n');
  const m = kunye(d);
  m.generic_files.gates.push('gates/check-secrets.mjs');   // MÜHÜRSÜZ → atlanacak
  writeFileSync(join(d, MAN), JSON.stringify(m, null, 2));
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  const son = kunye(d);
  assert.equal(JSON.parse(r.out).kismi, true);
  assert.equal(son.skill_version, '0.14.0', 'kısmi yükseltmede kök sürüm ESKİ kalmalı');
  assert.ok(son.last_upgraded_at, 'yine de last_upgraded_at yazılır');
  cleanup(s); cleanup(d);
});

test('künyenin dokunulmayan alanları korunur (bilinmeyen alan dahil)', () => {
  const s = kaynakKur('// kapı v2\n'), d = hedefKur({ icerik: '// kapı v1\n' });
  const m = kunye(d);
  m.custom_field = { ozel: 'korunmalı' }; m.notes = 'elle yazılmış not';
  writeFileSync(join(d, MAN), JSON.stringify(m, null, 2));
  runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty'], d);
  const son = kunye(d);
  assert.deepEqual(son.custom_field, { ozel: 'korunmalı' });
  assert.equal(son.notes, 'elle yazılmış not');
  assert.equal(son.installed_at, '2026-07-01');
  cleanup(s); cleanup(d);
});

test('düz-liste (kategorisiz) generic_files formunda mühür GERÇEKTEN yazılır (B1 sınıfı regresyon)', () => {
  const s = kaynakKur('// kapı v2\n'), d = tmp();
  write(d, 'gates/check-utf8.mjs', '// kapı v1\n');
  write(d, MAN, JSON.stringify({ skill_version: '0.14.0', gates_contract_version: 1,
    generic_files: [{ path: 'gates/check-utf8.mjs', sha256: sha(join(d, 'gates/check-utf8.mjs')) }],
    repo_owned_files: [] }, null, 2));
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(r.status, 0);
  const son = kunye(d);
  assert.equal(son.generic_files[0].sha256, sha(join(d, 'gates/check-utf8.mjs')), 'mühür künyeye YAZILMALI');
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// kapı v2\n');
  cleanup(s); cleanup(d);
});

// ── ÖNERİ-YENİ + dispatch ─────────────────────────────────────────────────────
test('pakette VAR künyede YOK olan kapı yalnız ÖNERİ — otomatik KURULMAZ', () => {
  const s = kaynakKur('// aynı\n');
  write(s, 'gates/check-yeni.mjs', '// yeni kapı\n');
  const d = hedefKur({ icerik: '// aynı\n' });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.deepEqual(JSON.parse(r.out).yeni_adaylar, ['gates/check-yeni.mjs']);
  assert.equal(JSON.parse(r.out).yazilan.length, 0);
  assert.equal(kunye(d).generic_files.gates.length, 1, 'künyeye kendiliğinden eklenmemeli');
  cleanup(s); cleanup(d);
});

test('verify.mjs --upgrade dispatch çalışır', () => {
  const s = kaynakKur('// aynı\n'), d = hedefKur({ icerik: '// aynı\n' });
  const r = spawnSync(process.execPath,
    [join(HERE, '..', 'verify.mjs'), '--upgrade', `--target=${d}`, `--source=${s}`, '--json'],
    { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /"plan"/);
  cleanup(s); cleanup(d);
});

// ── v0.30 (G4): fork atlama · göç raporu (B10c) · eski şema (B10b) · --toggle (T6) ────────────
const hedefKunye = (d, ek) => write(d, MAN, JSON.stringify({
  skill: 'agentic-repo-setup', skill_version: '0.14.0', gates_contract_version: 1,
  generic_files: { gates: [], runner: [], ci: [] }, repo_owned_files: [], ...ek }, null, 2));

test('B10a: fork beyanlı dosya ATLANDI-FORK (kaynak farklı olsa da dokunulmaz); --apply bile ezmez; beyanlı fork KISMİ sayılmaz → künye skill_version bump EDİLİR (v0.30.3)', () => {
  const s = kaynakKur('// kapı v2\n');
  const d = hedefKur({ icerik: '// kapı v1\n' });
  let r = runScript('install-doctor.mjs', [`--fork=gates/check-utf8.mjs`, '--neden=yerel kalibrasyon', `--target=${d}`], d);
  assert.equal(r.status, 0, r.out);
  r = runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d);
  const adim = JSON.parse(r.out).plan.find(x => x.path === 'gates/check-utf8.mjs');
  assert.equal(adim.durum, 'ATLANDI-FORK');
  assert.match(adim.not, /ELLE karşılaştır/);
  r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// kapı v1\n', 'fork dosyası EZİLMEMELİ');
  assert.equal(kunye(d).skill_version, '0.15.0', "beyanlı fork sürüm bump'ını kilitlememeli (saha: portal 0.23.1'de kaldı)");
  cleanup(s); cleanup(d);
});

test('B10c: gates_contract_version 1→2 dry-run GÖÇ RAPORU basar (eski kapı → kategori + --rule=, komut satırları), hiçbir dosya DEĞİŞMEZ, exit 1 (eski sözleşme korunur)', () => {
  const s = kaynakKur('// kapı v2\n', { contract: '2' });
  const d = tmp();
  write(d, 'scripts/gates/check-utf8.mjs', '// eski\n');
  write(d, 'scripts/gates/check-doc-truth.mjs', '// eski\n');
  write(d, 'scripts/gates/check-ozel-kural.mjs', '// repoya özgü\n');
  write(d, 'package.json', JSON.stringify({ scripts: { verify: 'node scripts/gates/check-utf8.mjs && node scripts/gates/check-ozel-kural.mjs' } }, null, 2));
  write(d, '.githooks/pre-commit', '#!/bin/sh\nnode scripts/gates/check-doc-truth.mjs CLAUDE.md || exit 1\n');
  hedefKunye(d, { generic_files: { gates: ['scripts/gates/check-utf8.mjs'], runner: [], ci: [] } });
  const once = ['scripts/gates/check-utf8.mjs', 'package.json', '.githooks/pre-commit', MAN].map(p => oku(d, p));
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d);
  assert.equal(r.status, 1, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.mod, 'goc-raporu');
  const kap = Object.fromEntries(j.goc_raporu.kapilar.map(k => [k.yol, k]));
  assert.equal(kap['scripts/gates/check-utf8.mjs'].yeni_cagri, 'node gates/check-hygiene.mjs --rule=utf8');
  assert.equal(kap['scripts/gates/check-doc-truth.mjs'].yeni_cagri, 'node gates/check-doc-integrity.mjs --rule=doc-truth');
  assert.equal(kap['scripts/gates/check-ozel-kural.mjs'].yeni_cagri, null, 'özel kapı eşlenmez, uydurulmaz');
  assert.deepEqual(j.goc_raporu.eslesmeyen, ['scripts/gates/check-ozel-kural.mjs']);
  assert.match(kap['scripts/gates/check-utf8.mjs'].yerel_durum, /bilinmiyor/);
  const satirlar = j.goc_raporu.komutlar.map(c => `${c.dosya}:${c.satir}:${c.eski}`);
  assert.ok(satirlar.includes('package.json:3:check-utf8.mjs') || satirlar.some(x => x.startsWith('package.json:') && x.endsWith('check-utf8.mjs')), satirlar.join(','));
  assert.ok(satirlar.includes('.githooks/pre-commit:2:check-doc-truth.mjs'), satirlar.join(','));
  assert.deepEqual(['scripts/gates/check-utf8.mjs', 'package.json', '.githooks/pre-commit', MAN].map(p => oku(d, p)), once, 'rapor HİÇBİR dosyayı değiştirmemeli');
  cleanup(s); cleanup(d);
});

test('B10c: göç raporundaki eski-kapı → kategori eşlemesi CONTRACT.md "Alt-kural sınıf beyanı" tablosuyla TUTARLI (uydurma değil)', () => {
  const contract = readFileSync(join(HERE, '..', 'CONTRACT.md'), 'utf8');
  const eskiler = ['utf8', 'secrets', 'placeholders', 'file-size', 'doc-truth', 'doc-recency', 'integrity', 'acceptance',
    'brief-provenance', 'coverage-gate', 'registry-join', 'hakem-verdict', 'plan-exists', 'mode-escalation',
    'append-only', 'co-update', 'stale-constants', 'rule-contracts', 'orphan-gates', 'design-tokens'];
  const s = kaynakKur('// x\n', { contract: '2' });
  const d = tmp();
  for (const e of eskiler) write(d, `scripts/gates/check-${e}.mjs`, '// eski\n');
  hedefKunye(d, {});
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d);
  const j = JSON.parse(r.out);
  assert.equal(j.goc_raporu.kapilar.length, 20);
  for (const k of j.goc_raporu.kapilar) {
    const m = k.yeni_cagri.match(/gates\/check-([a-z-]+)\.mjs --rule=([a-z0-9-]+)$/);
    assert.ok(m, k.yeni_cagri);
    assert.ok(contract.includes(`\`check-${m[1]}:${m[2]}\``), `${m[1]}:${m[2]} CONTRACT tablosunda yok`);
  }
  cleanup(s); cleanup(d);
});

test('B10b: eski şema (generic listesi yok) → plan ÖLÇÜLEMEDİ, hiçbir şey tazelenmez/yazılmaz, çökmez', () => {
  const s = kaynakKur('// kapı v2\n');
  const d = tmp();
  write(d, 'scripts/gates/check-utf8.mjs', '// eski\n');
  const eski = JSON.stringify({ skill: 'agentic-repo-setup', skill_version: '0.14.0', gates_contract_version: 1,
    audience_toggles: { product_management: true }, canonical_gate_directory: 'scripts/gates' }, null, 2);
  write(d, MAN, eski);
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(r.status, 0, r.out);
  const j = JSON.parse(r.out);
  assert.equal(j.plan.length, 1);
  assert.equal(j.plan[0].durum, 'ÖLÇÜLEMEDİ');
  assert.equal(oku(d, MAN), eski);
  cleanup(s); cleanup(d);
});

test('T6: --toggle künyeyi günceller (yalnız künye), katman dosya listesini + kaynağını basar; repo dosyası ÜRETMEZ', () => {
  const d = tmp();
  hedefKunye(d, { skill_version: '0.30.0', toggles: { muhatap: { pm_urun: null, son_kullanici_dokumani: null }, takip: { state: null, yan_bug: null } } });
  write(d, 'docs/STATE.md', '# var\n');
  let r = runScript(S, ['--toggle=son_kullanici_dokumani=true', `--target=${d}`], d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /docs\/registry\.yaml/);
  assert.match(r.out, /faz3-bilgi-katmani/);
  assert.equal(kunye(d).toggles.muhatap.son_kullanici_dokumani, true);
  assert.equal(kunye(d).toggles.muhatap.pm_urun, null, 'diğer toggle\'lara dokunulmaz');
  r = runScript(S, ['--toggle=takip.state=true', `--target=${d}`, '--json'], d);
  const j = JSON.parse(r.out);
  assert.equal(j.onceki, null);
  assert.equal(j.katman[0].yol, 'docs/STATE.md');
  assert.equal(j.katman[0].durum, 'VAR');
  assert.equal(kunye(d).toggles.takip.state, true);
  assert.throws(() => oku(d, 'docs/registry.yaml'), 'katman dosyası ÜRETİLMEMELİ (kurulumu ajan yapar)');
  cleanup(d);
});

test('T6: --toggle --dry-run künyeyi YAZMAZ; bilinmeyen toggle/değer ve eski şema REDDEDİLİR', () => {
  const d = tmp();
  hedefKunye(d, { skill_version: '0.30.0', toggles: { muhatap: { pm_urun: null }, takip: { state: null } } });
  const once = oku(d, MAN);
  let r = runScript(S, ['--toggle=pm_urun=true', '--dry-run', `--target=${d}`], d);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /DRY-RUN/);
  assert.equal(oku(d, MAN), once);
  r = runScript(S, ['--toggle=uydurma=true', `--target=${d}`], d);
  assert.equal(r.status, 1);
  assert.match(r.out, /bilinmeyen/);
  r = runScript(S, ['--toggle=pm_urun=belki', `--target=${d}`], d);
  assert.equal(r.status, 1);
  const e = tmp();
  write(e, MAN, JSON.stringify({ skill_version: '0.12.0', audience_toggles: { product_management: true } }));
  r = runScript(S, ['--toggle=pm_urun=true', `--target=${e}`], e);
  assert.equal(r.status, 1);
  assert.match(r.out, /eski/);
  assert.equal(oku(d, MAN), once);
  cleanup(d); cleanup(e);
});

// ── v0.30 hakem 2. tur: bağımlılık kapanışı + yükleme güvenlik ağı ───────────────────────────
// Hakem senaryosu: v0.29 künyesi + mühürlü ESKİ check-provenance.mjs + lib/mini-yaml.mjs. Paketteki yeni
// check-provenance `./lib/kunye-surum.mjs` import eder → hedefte YOK → tazelemek kapıyı ERR_MODULE_NOT_FOUND ile kırardı.
const PKG = join(HERE, '..');
function hakemHedef({ kunyeSurumIcerik = null } = {}) {
  const d = tmp();
  write(d, 'gates/check-provenance.mjs', '// eski v0.29 kapısı\n');
  write(d, 'gates/lib/mini-yaml.mjs', readFileSync(join(PKG, 'gates/lib/mini-yaml.mjs'), 'utf8'));
  if (kunyeSurumIcerik !== null) write(d, 'gates/lib/kunye-surum.mjs', kunyeSurumIcerik);
  const m = (p) => ({ path: p, sha256: sha(join(d, p)), sealed_at: '2026-09-01', skill_version: '0.29.0' });
  write(d, MAN, JSON.stringify({
    skill: 'agentic-repo-setup', skill_version: '0.29.0', gates_contract_version: Number(kontrat()),
    installed_at: '2026-09-01', last_upgraded_at: null, toggles: { muhatap: {} },
    generic_files: { gates: [m('gates/check-provenance.mjs'), m('gates/lib/mini-yaml.mjs')], runner: [], ci: [] },
    repo_owned_files: [], notes: 'fixture',
  }, null, 2));
  git(d, ['init', '-q']);
  return d;
}
const kontrat = () => (readFileSync(join(PKG, 'CONTRACT.md'), 'utf8').match(/gates_contract_version:\s*(\d+)/) || [])[1];

test('🔴 bağımlılık: dry-run BAĞIMLILIK-YENİ listeler, dosya OLUŞTURMAZ', () => {
  const d = hakemHedef();
  const r = runScript(S, [`--target=${d}`, '--json'], d);
  const p = JSON.parse(r.out).plan;
  const y = p.find(x => x.path === 'gates/lib/kunye-surum.mjs');
  assert.equal(y?.durum, 'BAĞIMLILIK-YENİ', r.out);
  assert.match(y.not, /gates\/check-provenance\.mjs bunu import ediyor/);
  assert.equal(p.find(x => x.path === 'gates/check-provenance.mjs').durum, 'BAYAT');
  assert.equal(existsSync(join(d, 'gates/lib/kunye-surum.mjs')), false, 'dry-run oluşturmamalı');
  cleanup(d);
});

test('🔴 bağımlılık: --apply kunye-surum.mjs oluşturur + künyeye mühürlü girdi + kapı GERÇEKTEN yüklenir (exit 0)', () => {
  const d = hakemHedef();
  const r = runScript(S, [`--target=${d}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(r.status, 0, r.out);
  assert.ok(existsSync(join(d, 'gates/lib/kunye-surum.mjs')), 'bağımlılık oluşmalı');
  const girdi = kunye(d).generic_files.gates.find(e => e.path === 'gates/lib/kunye-surum.mjs');
  assert.ok(girdi, 'künyeye eklenmeli');
  assert.equal(girdi.sha256, sha(join(d, 'gates/lib/kunye-surum.mjs')));
  assert.ok(girdi.sealed_at && girdi.skill_version);
  const gate = spawnSync(process.execPath, ['gates/check-provenance.mjs', '--rule=coverage-gate'], { cwd: d, encoding: 'utf8' });
  assert.equal(gate.status, 0, (gate.stdout || '') + (gate.stderr || ''));
  assert.notEqual(oku(d, 'gates/check-provenance.mjs'), '// eski v0.29 kapısı\n');
  cleanup(d);
});

test('🔴 bağımlılık hedefte FORK\'lu (künyede yok, içerik farklı) → importer ATLANIR, bağımlılığa YAZILMAZ, kapı kırılmaz', () => {
  const d = hakemHedef({ kunyeSurumIcerik: '// yerel fork\nexport const kunyeSurumuEnAz = () => true;\n' });
  const r = runScript(S, [`--target=${d}`, '--apply', '--allow-dirty', '--json'], d);
  const o = JSON.parse(r.out);
  const e = o.plan.find(x => x.path === 'gates/check-provenance.mjs');
  assert.equal(e.durum, 'ATLANDI-BAĞIMLILIK', r.out);
  assert.match(e.not, /kunye-surum\.mjs/);
  assert.match(e.not, /KAYITSIZ-FARKLI/, 'neden açık: künyede kayıtsız yerel yama');
  assert.doesNotMatch(e.not, /--seal/, 'yalnız --fork önerilir');
  assert.match(e.not, /--fork=gates\/lib\/kunye-surum\.mjs/);
  assert.equal(oku(d, 'gates/check-provenance.mjs'), '// eski v0.29 kapısı\n', 'yarım tazeleme YOK');
  assert.match(oku(d, 'gates/lib/kunye-surum.mjs'), /yerel fork/, 'fork ezilmemeli');
  assert.equal(kunye(d).skill_version, '0.29.0', 'kısmi: kök sürüm bump edilmez');
  cleanup(d);
});

test('🔴 güvenlik ağı: yazılan dosya YÜKLENEMİYORSA yedekten geri alınır + FAIL raporu + exit 1', () => {
  // `import 'ars-olmayan-paket-xyz'` bare-spec: kapanış çözücü görmez (göreli değil) → yalnız yükleme denemesi yakalar.
  const s = kaynakKur("import 'ars-olmayan-paket-xyz';\n");
  const d = hedefKur({ icerik: '// kapı v1\n' });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(r.status, 1, r.out);
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// kapı v1\n', 'geri alınmalı');
  assert.match(JSON.parse(r.out).yazilamayan[0].hata, /YÜKLEME FAIL.*GERİ ALINDI/);
  assert.equal(kunye(d).generic_files.gates[0].sha256, sha(join(d, 'gates/check-utf8.mjs')), 'künye mührü eski dosyaya ait kalmalı');
  cleanup(s); cleanup(d);
});

test('bağımlılık kapanışı özyinelemeli: A→B→C (ikisi de hedefte yok) → ikisi de BAĞIMLILIK-YENİ; --apply kapı yüklenir', () => {
  const s = kaynakKur("import { b } from './lib/b.mjs';\nexport const a = b;\n");
  write(s, 'gates/lib/b.mjs', "export * from './c.mjs';\nexport const b = 1;\n");
  write(s, 'gates/lib/c.mjs', 'export const c = 2;\n');
  const d = hedefKur({ icerik: '// kapı v1\n' });
  const dry = JSON.parse(runScript(S, [`--target=${d}`, `--source=${s}`, '--json'], d).out).plan;
  assert.deepEqual(dry.filter(x => x.durum === 'BAĞIMLILIK-YENİ').map(x => x.path).sort(), ['gates/lib/b.mjs', 'gates/lib/c.mjs']);
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(r.status, 0, r.out);
  assert.ok(existsSync(join(d, 'gates/lib/c.mjs')));
  assert.equal(kunye(d).generic_files.gates.length, 3);
  cleanup(s); cleanup(d);
});

// ── v0.30.2: tazelenebilir kaynak = İZİN LİSTESİ (gates/**); şablon-üretimi/kaynaksız girdi BİLGİ ─────────
// Sahada skill'in KENDİ docs/SIDE-BUGS-LOG.md + .github/workflows/verify.yml'i hedeflere yazılmaya çalışıldı.
function hedefCokKur({ gatesIcerik = '// kapı v1\n' } = {}) {
  const d = tmp();
  const dosyalar = { 'gates/check-utf8.mjs': gatesIcerik, 'docs/SIDE-BUGS-LOG.md': '# hedefin kendi defteri\nSB-1 hedef\n',
    '.github/workflows/verify.yml': 'name: hedef-ci\n', 'scripts/verify.mjs': '// yerel reçete\n' };
  const girdi = (p) => { write(d, p, dosyalar[p]); return { path: p, sha256: sha(join(d, p)), sealed_at: '2026-07-27', skill_version: '0.14.0' }; };
  write(d, MAN, JSON.stringify({ skill: 'agentic-repo-setup', skill_version: '0.14.0', gates_contract_version: 1,
    installed_at: '2026-07-01', last_upgraded_at: null, toggles: { muhatap: {} },
    generic_files: { gates: [girdi('gates/check-utf8.mjs')],
      runner: [girdi('scripts/verify.mjs')], ci: [girdi('.github/workflows/verify.yml'), girdi('docs/SIDE-BUGS-LOG.md')] },
    repo_owned_files: [], notes: 'fixture' }, null, 2));
  return d;
}
function kaynakCokKur() {
  const s = kaynakKur('// kapı v2\n', { version: '0.15.0' });
  write(s, 'docs/SIDE-BUGS-LOG.md', '# SKILL KENDİ DEFTERİ SB-1…SB-27\n');
  write(s, '.github/workflows/verify.yml', 'name: skill-kendi-ci\n');
  return s;
}

test('🔴 skill KENDİ docs/SIDE-BUGS-LOG.md + .github/workflows/verify.yml dosyası hedefe ASLA yazılmaz; kapı tazelenir', () => {
  const s = kaynakCokKur(), d = hedefCokKur();
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(oku(d, 'docs/SIDE-BUGS-LOG.md'), '# hedefin kendi defteri\nSB-1 hedef\n');
  assert.equal(oku(d, '.github/workflows/verify.yml'), 'name: hedef-ci\n');
  assert.equal(oku(d, 'scripts/verify.mjs'), '// yerel reçete\n');
  assert.equal(oku(d, 'gates/check-utf8.mjs'), '// kapı v2\n', 'izin listesindeki kapı yine tazelenir');
  cleanup(s); cleanup(d);
});

test('izin-dışı generic girdi: şablon-üretimi → BİLGİ-ŞABLON, kaynaksız → BİLGİ-KAYNAKSIZ; KISMİ değil, kök sürüm BUMP edilir', () => {
  const s = kaynakCokKur(), d = hedefCokKur();
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  const j = JSON.parse(r.out);
  assert.equal(durum(r.out, 'docs/SIDE-BUGS-LOG.md'), 'BİLGİ-ŞABLON');
  assert.equal(durum(r.out, '.github/workflows/verify.yml'), 'BİLGİ-ŞABLON');
  assert.equal(durum(r.out, 'scripts/verify.mjs'), 'BİLGİ-KAYNAKSIZ');
  assert.match(j.plan.find(x => x.path === 'docs/SIDE-BUGS-LOG.md').not, /ŞABLON-ÜRETİMİ \/ repo-owned/);
  assert.equal(j.kismi, false);
  assert.equal(kunye(d).skill_version, '0.15.0', 'BİLGİ girdiler bump yapmayı bloke etmemeli');
  cleanup(s); cleanup(d);
});

test('yalnız BİLGİ/GÜNCEL girdi (yazılacak dosya yok) → kök skill_version yine bump edilir (portal 0.23.1 vakası)', () => {
  const s = kaynakKur('// aynı\n', { version: '0.15.0' }), d = hedefCokKur({ gatesIcerik: '// aynı\n' });
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(JSON.parse(r.out).yazilan.length, 0);
  assert.equal(kunye(d).skill_version, '0.15.0');
  cleanup(s); cleanup(d);
});

test('--sahiplen: girdiyi generic_files → repo_owned_files taşır (dosyaya dokunulmaz); olmayan yol REDDEDİLİR, künye değişmez', () => {
  const s = kaynakCokKur(), d = hedefCokKur();
  const once = oku(d, 'docs/SIDE-BUGS-LOG.md');
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--sahiplen=docs/SIDE-BUGS-LOG.md,scripts/verify.mjs', '--json'], d);
  assert.equal(r.status, 0, r.out);
  const k = kunye(d);
  const tumGeneric = Object.values(k.generic_files).flat().map(e => e.path);
  assert.ok(!tumGeneric.includes('docs/SIDE-BUGS-LOG.md') && !tumGeneric.includes('scripts/verify.mjs'));
  assert.deepEqual([...k.repo_owned_files].sort(), ['docs/SIDE-BUGS-LOG.md', 'scripts/verify.mjs']);
  assert.ok(tumGeneric.includes('.github/workflows/verify.yml') && tumGeneric.includes('gates/check-utf8.mjs'), 'diğer girdiler yerinde');
  assert.equal(oku(d, 'docs/SIDE-BUGS-LOG.md'), once);
  const kBefore = oku(d, MAN);
  const r2 = runScript(S, [`--target=${d}`, `--source=${s}`, '--sahiplen=yok/boyle.md'], d);
  assert.notEqual(r2.status, 0);
  assert.equal(oku(d, MAN), kBefore, 'hata durumunda künye değişmez');
  cleanup(s); cleanup(d);
});

test('--sahiplen --dry-run künyeyi YAZMAZ', () => {
  const s = kaynakCokKur(), d = hedefCokKur();
  const once = oku(d, MAN);
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--sahiplen=docs/SIDE-BUGS-LOG.md', '--dry-run'], d);
  assert.equal(r.status, 0, r.out);
  assert.equal(oku(d, MAN), once);
  cleanup(s); cleanup(d);
});

test('doctor: kapı dizini dışı generic girdi → BİLGİ ⑪ (drift FAIL değil), meşru değişim suçlanmaz', () => {
  const d = hedefCokKur();
  write(d, 'docs/SIDE-BUGS-LOG.md', '# yaşayan defter — SB-2 eklendi\n');   // mühürden sapma
  const r = spawnSync(process.execPath, [join(HERE, '..', 'scripts', 'install-doctor.mjs'), `--target=${d}`, '--json'], { encoding: 'utf8' });
  const res = JSON.parse(r.stdout).results;
  assert.notEqual(res.find(x => x.id === '③').verdict, 'FAIL', 'yaşayan dosya drift FAIL vermemeli');
  const b = res.find(x => x.id === '⑪');
  assert.equal(b.verdict, 'BİLGİ');
  assert.ok(b.paths.includes('docs/SIDE-BUGS-LOG.md') && b.paths.includes('.github/workflows/verify.yml'));
  cleanup(d);
});

// ── açık liste: yaşam-döngüsü araçları (scripts/upgrade.mjs …) tazelenir; listede olmayan paket dosyası BİLGİ kalır ──
test('açık liste: scripts/upgrade.mjs paketten tazelenir; scripts/brainstorm.mjs (listede yok) BİLGİ-ŞABLON, verify.mjs BİLGİ kalır', () => {
  const s = kaynakKur('// kapı v2\n', { version: '0.15.0' });
  write(s, 'scripts/upgrade.mjs', '// upgrade v2\n');
  write(s, 'scripts/brainstorm.mjs', '// paketin brainstorm v2\n');
  write(s, 'verify.mjs', '// paket verify\n');
  const d = tmp();
  const dosyalar = { 'scripts/upgrade.mjs': '// upgrade v1\n', 'scripts/brainstorm.mjs': '// hedef brainstorm\n', 'scripts/verify.mjs': '// yerel\n' };
  const girdi = (p) => { write(d, p, dosyalar[p]); return { path: p, sha256: sha(join(d, p)), sealed_at: '2026-07-27', skill_version: '0.14.0' }; };
  write(d, MAN, JSON.stringify({ skill: 'agentic-repo-setup', skill_version: '0.14.0', gates_contract_version: 1,
    installed_at: '2026-07-01', last_upgraded_at: null, toggles: { muhatap: {} },
    generic_files: { gates: [], runner: Object.keys(dosyalar).map(girdi), ci: [] }, repo_owned_files: [], notes: 'fixture' }, null, 2));
  const r = runScript(S, [`--target=${d}`, `--source=${s}`, '--apply', '--allow-dirty', '--json'], d);
  assert.equal(durum(r.out, 'scripts/upgrade.mjs'), 'BAYAT');
  assert.equal(oku(d, 'scripts/upgrade.mjs'), '// upgrade v2\n');
  assert.equal(durum(r.out, 'scripts/brainstorm.mjs'), 'BİLGİ-ŞABLON');
  assert.equal(oku(d, 'scripts/brainstorm.mjs'), '// hedef brainstorm\n', 'listede olmayan paket dosyası hedefe YAZILMAZ');
  assert.equal(durum(r.out, 'scripts/verify.mjs'), 'BİLGİ-KAYNAKSIZ');
  assert.equal(oku(d, 'scripts/verify.mjs'), '// yerel\n');
  cleanup(s); cleanup(d);
});

test('doctor ⑪: yaşam-döngüsü araçları listede → ⑪ içinde YOK; brainstorm.mjs ⑪ içinde', () => {
  const d = tmp();
  const dosyalar = { 'scripts/upgrade.mjs': 'a\n', 'scripts/install-doctor.mjs': 'b\n', 'scripts/install-exam.mjs': 'c\n', 'scripts/brainstorm.mjs': 'd\n' };
  const girdi = (p) => { write(d, p, dosyalar[p]); return { path: p, sha256: sha(join(d, p)), sealed_at: '2026-07-27', skill_version: '0.14.0' }; };
  write(d, MAN, JSON.stringify({ skill: 'agentic-repo-setup', skill_version: '0.14.0', gates_contract_version: 1, toggles: { muhatap: {} },
    generic_files: { gates: [], runner: Object.keys(dosyalar).map(girdi), ci: [] }, repo_owned_files: [] }, null, 2));
  const r = spawnSync(process.execPath, [join(HERE, '..', 'scripts', 'install-doctor.mjs'), `--target=${d}`, '--json'], { encoding: 'utf8' });
  const b = JSON.parse(r.stdout).results.find(x => x.id === '⑪');
  assert.deepEqual(b.paths, ['scripts/brainstorm.mjs']);
  cleanup(d);
});
