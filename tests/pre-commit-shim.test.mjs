// templates/pre-commit-shim.template.sh (v0.28, D-34) — Node PROJENİN değil ARACIN bağımlılığıdır.
// İKİ YÖNLÜ: makinede node YOKSA commit engellenmez ama atlandığı SÖYLENİR (sessiz geçiş değil);
// node VARSA kapı komutları gerçekten koşar ve FAIL'i commit'e taşır (başlatıcı kapıyı yutmaz).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmp, initRepo, cleanup, runScript } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SABLON = readFileSync(join(HERE, '..', 'templates', 'pre-commit-shim.template.sh'), 'utf8');

// sh yolu ÜST ortamdan MUTLAK çözülür ("node yok" testi çocuğun PATH'ini boşaltır). Windows'ta
// `where sh` PATH'e bağlıdır — düz PowerShell/cmd PATH'inde Git'in usr\bin'i YOKTUR ve testler
// sessizce atlanıyordu (hakem U1, K74 ailesi: ortama bağlı sahte-yeşil). Yedek: Git'in kurulum
// kökünden (`git --exec-path` → …/mingw64/libexec/git-core) sh.exe türetilir.
function shBul() {
  if (process.platform !== 'win32') return existsSync('/bin/sh') ? '/bin/sh' : null;
  const w = (spawnSync('where', ['sh'], { encoding: 'utf8' }).stdout || '').split('\n')[0].trim();
  if (w) return w;
  const ex = (spawnSync('git', ['--exec-path'], { encoding: 'utf8' }).stdout || '').trim();
  if (!ex) return null;
  for (const aday of [resolve(ex, '..', '..', '..', 'usr', 'bin', 'sh.exe'), resolve(ex, '..', '..', '..', 'bin', 'sh.exe')]) {
    if (existsSync(aday)) return aday;
  }
  return null;
}
const SH = shBul();
const GIT_VAR = spawnSync('git', ['--version']).status === 0;
// Atlama YALNIZ git de yoksa meşrudur (git'siz makinede hook zaten koşmaz). git varken sh
// bulunamıyorsa bu bir ORTAM HATASIDIR — atlanmaz, test FAIL eder (aşağıdaki nöbetçi).
const ATLA = !GIT_VAR;

test('pre-commit shim: git varken sh BULUNMALI (bulunamazsa sessiz atlama yerine FAIL)', { skip: ATLA }, () => {
  assert.ok(SH, 'git kurulu ama sh çözülemedi — shim testleri koşamaz, yeşil SAYILMAZ');
});

function shimYaz(dir, yerel, kapilar) {
  writeFileSync(join(dir, 'pre-commit'), SABLON
    .replace('{{YEREL_KOMUTLAR}}', yerel).replace('{{KAPI_KOMUTLARI}}', kapilar).split('\r\n').join('\n'));
}
// Betik cwd'ye GÖRELİ verilir: Windows mutlak yolu (C:\...) msys sh'ta çözülmez (ölçüldü: exit 127).
const kos = (cwd, env, betik = './pre-commit') => {
  const r = spawnSync(SH, [betik], { cwd, encoding: 'utf8', env });
  return { status: r.status, out: ((r.stdout || '') + (r.stderr || '')).trim() };
};
const nodesuzEnv = (bosPath) => {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.toUpperCase() === 'PATH') delete env[k];
  env.PATH = bosPath;
  return env;
};

test('pre-commit shim: makinede node YOK → exit 0 + açık UYARI; node-bağımsız YEREL adım yine koşar', { skip: ATLA || !SH }, () => {
  const d = tmp();
  const bosPath = tmp();   // içinde hiçbir program olmayan PATH → `command -v node` bulamaz
  shimYaz(d, 'echo yerel-adim-kostu', 'node -e "process.exit(1)"');
  const r = kos(d, nodesuzEnv(bosPath));
  cleanup(d); cleanup(bosPath);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /node' bulunamadı — yerel kapılar ATLANDI/);
  assert.match(r.out, /yerel-adim-kostu/);
});

test('pre-commit shim: node VAR ve kapı FAIL → commit durur (başlatıcı kapıyı yutmaz)', { skip: ATLA || !SH }, () => {
  const d = initRepo();
  shimYaz(d, ':', 'node -e "process.exit(3)"');
  const r = kos(d, process.env);
  cleanup(d);
  assert.notEqual(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /ATLANDI/);
});

test('pre-commit shim: (hakem U2) çok satırda İLK kapı FAIL → `|| exit 1` yazılmasa da durur', { skip: ATLA || !SH }, () => {
  const d = initRepo();
  shimYaz(d, ':', 'node -e "process.exit(4)"\nnode -e "process.exit(0)"');
  const r = kos(d, process.env);
  cleanup(d);
  assert.notEqual(r.status, 0, r.out);
});

test('pre-commit shim: node-bağımsız YEREL adım FAIL → commit durur', { skip: ATLA || !SH }, () => {
  const d = initRepo();
  shimYaz(d, 'false', 'node -e "process.exit(0)"');
  const r = kos(d, process.env);
  cleanup(d);
  assert.notEqual(r.status, 0, r.out);
});

test('pre-commit shim: node VAR ve kapılar temiz → exit 0; $ROOT repo köküne çözülür', { skip: ATLA || !SH }, () => {
  const d = initRepo();
  writeFileSync(join(d, 'kok-isareti.txt'), 'x');
  shimYaz(d, ':', 'node -e "process.exit(require(\'fs\').existsSync(process.argv[1]) ? 0 : 5)" "$ROOT/kok-isareti.txt"');
  const r = kos(d, process.env);
  cleanup(d);
  assert.equal(r.status, 0, r.out);
});

test('install-hook (paketin kendi shim\'i, hakem U6): node YOK → exit 0 + uyarı', { skip: ATLA || !SH }, () => {
  const d = initRepo();
  const kur = runScript('install-hook.mjs', [], d);
  assert.equal(kur.status, 0, kur.out);
  const bosPath = tmp();
  const r = kos(d, nodesuzEnv(bosPath), './.git/hooks/pre-commit');
  cleanup(d); cleanup(bosPath);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /node' bulunamadı — yerel kapılar ATLANDI/);
});

// v0.30 (G5): şablon üç taahhüdü TAŞIMALI — hook halka işareti, install-version satırı, toggle-koşullu --cascade.
test('pre-commit shim şablonu (v0.30): GATES_RING=pre-commit export edilir (file-size halka-duyarlı)', () => {
  assert.match(SABLON, /^export GATES_RING=pre-commit\s*$/m);
  // export, kapı komutlarından ÖNCE olmalı (set -e + sıra)
  assert.ok(SABLON.indexOf('export GATES_RING=pre-commit') < SABLON.indexOf('{{KAPI_KOMUTLARI}}'));
});

test('pre-commit shim şablonu (v0.30): önerilen listede install-version (warn-only) + toggle-koşullu doc-recency --cascade', () => {
  assert.match(SABLON, /check-self-registry\.mjs"? --rule=install-version/);
  assert.match(SABLON, /--rule=doc-recency --cascade/);
  assert.match(SABLON, /son_kullanici_dokumani/);
});

test('ci-workflow şablonu (v0.30): doc-recency satırı --cascade alanı taşır, toggle adıyla bağlı; negatif: bayraksız satır yakalanır', () => {
  const ci = readFileSync(join(HERE, '..', 'templates', 'ci-workflow.template.yml'), 'utf8');
  const satir = ci.split(/\r?\n/).find(l => /--rule=doc-recency --strict/.test(l));
  assert.ok(satir, 'CI şablonunda doc-recency --strict satırı yok');
  assert.match(satir, /\{\{CASCADE_BAYRAGI\}\}/);
  assert.match(satir, /son_kullanici_dokumani/);
  // negatif deney: toggle alanı olmayan eski satır bu denetimden GEÇMEMELİ
  assert.doesNotMatch('node gates/check-doc-integrity.mjs --rule=doc-recency --strict', /\{\{CASCADE_BAYRAGI\}\}/);
});
