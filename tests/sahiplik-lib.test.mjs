// gates/lib/sahiplik.mjs birim testleri (v0.31.0) — kayıt/çakışma/oturum-içi/TTL/bırakma/yarış.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initRepo, cleanup, write } from './helpers.mjs';
import { al, sorgula, birak, liste, oturumAdiYaz, sahipTarifi, normYol } from '../gates/lib/sahiplik.mjs';

const LIB = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'gates', 'lib', 'sahiplik.mjs')).href;

function repo() {
  const dir = initRepo();
  write(dir, 'a.txt', 'a\n');
  write(dir, 'b.txt', 'b\n');
  return dir;
}

test('ilk alan kazanır, aynı sahip yeniler, farklı oturum çakışır', () => {
  const dir = repo();
  try {
    assert.equal(al({ cwd: dir, yol: 'a.txt', session: 'S1' }).durum, 'alindi');
    assert.equal(al({ cwd: dir, yol: 'a.txt', session: 'S1' }).durum, 'yenilendi');
    const r = al({ cwd: dir, yol: 'a.txt', session: 'S2' });
    assert.equal(r.durum, 'cakisma');
    assert.equal(r.sahip.session, 'S1');
    assert.equal(al({ cwd: dir, yol: 'b.txt', session: 'S2' }).durum, 'alindi');
  } finally { cleanup(dir); }
});

test('oturum içi: ana ajan ↔ alt ajan geçer, iki farklı alt ajan çakışır', () => {
  const dir = repo();
  try {
    assert.equal(al({ cwd: dir, yol: 'a.txt', session: 'S1', agent: 'x' }).durum, 'alindi');
    assert.equal(al({ cwd: dir, yol: 'a.txt', session: 'S1', agent: null }).durum, 'oturum-ici');
    assert.equal(al({ cwd: dir, yol: 'a.txt', session: 'S1', agent: 'y' }).durum, 'cakisma');
    assert.equal(al({ cwd: dir, yol: 'b.txt', session: 'S1' }).durum, 'alindi');
    assert.equal(al({ cwd: dir, yol: 'b.txt', session: 'S1', agent: 'y' }).durum, 'oturum-ici');
  } finally { cleanup(dir); }
});

test('TTL aşılmış kayıt devralınır, taze kayıt devralınmaz', () => {
  const dir = repo();
  try {
    const t0 = Date.now();
    al({ cwd: dir, yol: 'a.txt', session: 'S1', simdi: t0 });
    assert.equal(al({ cwd: dir, yol: 'a.txt', session: 'S2', simdi: t0 + 9 * 60_000 }).durum, 'cakisma');
    const r = al({ cwd: dir, yol: 'a.txt', session: 'S2', simdi: t0 + 11 * 60_000 });
    assert.equal(r.durum, 'devralindi');
    assert.equal(r.sahip.session, 'S1');
    assert.equal(sorgula({ cwd: dir, yol: 'a.txt', session: 'S2', simdi: t0 + 11 * 60_000 }).durum, 'benim');
  } finally { cleanup(dir); }
});

test('bırakma: alt ajan yalnız kendi kayıtlarını, oturum hepsini siler', () => {
  const dir = repo();
  try {
    al({ cwd: dir, yol: 'a.txt', session: 'S1', agent: 'x' });
    al({ cwd: dir, yol: 'b.txt', session: 'S1' });
    al({ cwd: dir, yol: 'c.txt', session: 'S2' });
    assert.equal(birak({ cwd: dir, session: 'S1', agent: 'x' }), 1);
    assert.deepEqual(liste({ cwd: dir }).map(k => k.yol).sort(), ['b.txt', 'c.txt']);
    assert.equal(birak({ cwd: dir, session: 'S1' }), 1);
    assert.deepEqual(liste({ cwd: dir }).map(k => k.yol), ['c.txt']);
  } finally { cleanup(dir); }
});

test('repo dışı yol ve oturumsuz çağrı kapsam dışıdır', () => {
  const dir = repo();
  try {
    assert.equal(al({ cwd: dir, yol: '../dis.txt', session: 'S1' }).durum, 'kapsam-disi');
    assert.equal(al({ cwd: dir, yol: 'a.txt', session: '' }).durum, 'kapsam-disi');
    assert.equal(normYol(dir, join(dir, 'alt', 'x.md')), 'alt/x.md');
  } finally { cleanup(dir); }
});

test('oturum adı beyan edilirse çakışma tarifinde görünür', () => {
  const dir = repo();
  try {
    al({ cwd: dir, yol: 'a.txt', session: 'S1-uzun-kimlik' });
    oturumAdiYaz({ cwd: dir, session: 'S1-uzun-kimlik', ad: 'pilot-fe' });
    const r = al({ cwd: dir, yol: 'a.txt', session: 'S2' });
    assert.match(sahipTarifi(r.sahip, { cwd: dir }), /"pilot-fe" oturumu/);
  } finally { cleanup(dir); }
});

test('eşzamanlı 20 süreç aynı dosyayı ister → tam bir kazanan', async () => {
  const dir = repo();
  try {
    const kod = `import(${JSON.stringify(LIB)}).then(m => process.stdout.write(m.al({ cwd: process.argv[1], yol: 'a.txt', session: process.argv[2] }).durum))`;
    const sonuc = await Promise.all(Array.from({ length: 20 }, (_, i) => new Promise(res => {
      const c = spawn(process.execPath, ['--input-type=module', '-e', kod, dir, `S${i}`]);
      let out = '';
      c.stdout.on('data', d => { out += d; });
      c.on('close', () => res(out.trim()));
    })));
    assert.equal(sonuc.filter(s => s === 'alindi').length, 1, sonuc.join(','));
    assert.equal(sonuc.filter(s => s === 'cakisma').length, 19, sonuc.join(','));
  } finally { cleanup(dir); }
});

test('bozuk (yarım yazılmış) kayıt: tazeyse çakışma, 5 sn\'den eskiyse çöp sayılır ve alınır', async () => {
  const { readdirSync, writeFileSync: yaz, utimesSync } = await import('node:fs');
  const dir = repo();
  try {
    al({ cwd: dir, yol: 'a.txt', session: 'S1' });
    const kd = join(dir, '.git', 'ajan-sahiplik');
    const ad = readdirSync(kd).find(n => n.endsWith('.json') && !n.startsWith('_'));
    yaz(join(kd, ad), '{"yol":"a.t'); // süreç yazım ortasında öldü
    assert.equal(al({ cwd: dir, yol: 'a.txt', session: 'S2' }).durum, 'cakisma');
    const eski = new Date(Date.now() - 60_000);
    utimesSync(join(kd, ad), eski, eski);
    assert.equal(sorgula({ cwd: dir, yol: 'a.txt', session: 'S2' }).durum, 'bayat');
    assert.equal(al({ cwd: dir, yol: 'a.txt', session: 'S2' }).durum, 'alindi');
  } finally { cleanup(dir); }
});
