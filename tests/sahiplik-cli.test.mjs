// scripts/sahiplik.mjs CLI testleri (v0.31.0) — al/birak/liste/ad/kontrol/fotograf/karsilastir + çıkış kodları.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmp, initRepo, cleanup, write, runScript, git } from './helpers.mjs';

const S = 'sahiplik.mjs';
const env = id => ({ CLAUDE_CODE_SESSION_ID: id });

function repo() {
  const dir = initRepo();
  write(dir, 'a.txt', 'a\n');
  write(dir, 'b.txt', 'b\n');
  write(dir, 'src/x.js', 'x\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'i');
  return dir;
}

test('al → başka oturum çakışır (exit 1), ya hep ya hiç: kısmi alınanlar geri bırakılır', () => {
  const d = repo();
  try {
    assert.equal(runScript(S, ['al', 'a.txt'], d, env('S1')).status, 0);
    const r = runScript(S, ['al', 'b.txt', 'a.txt'], d, env('S2'));
    assert.equal(r.status, 1);
    assert.match(r.out, /ÇAKIŞMA a\.txt/);
    // b.txt S2'ye alınmamış olmalı → S3 alabilir
    assert.equal(runScript(S, ['al', 'b.txt'], d, env('S3')).status, 0);
  } finally { cleanup(d); }
});

test('birak: yola göre ve oturumun tümü; sonra başkası alabilir', () => {
  const d = repo();
  try {
    runScript(S, ['al', 'a.txt', 'b.txt'], d, env('S1'));
    assert.match(runScript(S, ['birak', 'a.txt'], d, env('S1')).out, /1 kayıt/);
    assert.equal(runScript(S, ['al', 'a.txt'], d, env('S2')).status, 0);
    assert.match(runScript(S, ['birak'], d, env('S1')).out, /1 kayıt/);
    assert.equal(runScript(S, ['al', 'b.txt'], d, env('S2')).status, 0);
  } finally { cleanup(d); }
});

test('liste --json + ad: çakışma mesajında oturum adı görünür', () => {
  const d = repo();
  try {
    runScript(S, ['al', 'a.txt', '--ad=Mavi-Oturum'], d, env('S1'));
    const j = JSON.parse(runScript(S, ['liste', '--json'], d, env('S1')).out);
    assert.equal(j.length, 1);
    assert.equal(j[0].yol, 'a.txt');
    assert.equal(j[0].ad, 'Mavi-Oturum');
    runScript(S, ['ad', 'Yeni', 'Ad'], d, env('S1'));
    const r = runScript(S, ['al', 'a.txt'], d, env('S2'));
    assert.equal(r.status, 1);
    assert.match(r.out, /"Yeni Ad" oturumu/);
    assert.match(runScript(S, ['liste'], d, env('S1')).out, /a\.txt/);
  } finally { cleanup(d); }
});

test('kontrol: çakışmada exit 1, serbest/kendi yolda 0, yazmaz', () => {
  const d = repo();
  try {
    runScript(S, ['al', 'a.txt'], d, env('S1'));
    assert.equal(runScript(S, ['kontrol', 'a.txt'], d, env('S2')).status, 1);
    assert.equal(runScript(S, ['kontrol', 'a.txt'], d, env('S1')).status, 0);
    assert.equal(runScript(S, ['kontrol', 'b.txt'], d, env('S2')).status, 0);
    assert.equal(runScript(S, ['al', 'b.txt'], d, env('S1')).status, 0); // kontrol b.txt'yi S2'ye yazmadı
  } finally { cleanup(d); }
});

test('oturum kimliği yok → exit 2; --session ile geçer; bilinmeyen komut exit 2', () => {
  const d = repo();
  try {
    const e = { CLAUDE_CODE_SESSION_ID: '' };
    const r = runScript(S, ['al', 'a.txt'], d, e);
    assert.equal(r.status, 2);
    assert.match(r.out, /oturum kimliği yok/);
    assert.equal(runScript(S, ['al', 'a.txt', '--session=ZZ'], d, e).status, 0);
    assert.equal(runScript(S, ['yok-komut'], d, env('S1')).status, 2);
    assert.equal(runScript(S, ['--help'], d, env('S1')).status, 0);
  } finally { cleanup(d); }
});

test('git reposu değilse uyarı + exit 0', () => {
  const d = tmp();
  try {
    const r = runScript(S, ['al', 'a'], d, env('S1'));
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /git reposu değil/);
  } finally { cleanup(d); }
});

test('fotograf → karsilastir: beyan içi değişiklik exit 0, beyan dışı exit 1', () => {
  const d = repo();
  try {
    const f = 'foto.json';
    assert.equal(runScript(S, ['fotograf', f], d, env('S1')).status, 0);
    write(d, 'src/x.js', 'x2\n');
    write(d, 'yeni/n.txt', 'n\n');
    assert.equal(runScript(S, ['karsilastir', f, '--yaz=src/,yeni/**'], d, env('S1')).status, 0);
    write(d, 'b.txt', 'b2\n');
    const r = runScript(S, ['karsilastir', f, '--yaz=src/'], d, env('S1'));
    assert.equal(r.status, 1);
    assert.match(r.out, /BEYAN DIŞI: b\.txt/);
    assert.match(r.out, /BEYAN DIŞI: yeni\/n\.txt/);
    assert.doesNotMatch(r.out, /BEYAN DIŞI: src\/x\.js/);
    // --yaz verilmediyse yalnız fark listesi, exit 0
    assert.equal(runScript(S, ['karsilastir', f], d, env('S1')).status, 0);
  } finally { cleanup(d); }
});

test('karsilastir: başka oturumun dosyası değiştiyse ÇAKIŞMA (exit 1)', () => {
  const d = repo();
  try {
    runScript(S, ['al', 'a.txt'], d, env('S2'));
    runScript(S, ['fotograf', 'foto.json'], d, env('S1'));
    write(d, 'a.txt', 'degisti\n');
    const r = runScript(S, ['karsilastir', 'foto.json', '--yaz=a.txt'], d, env('S1'));
    assert.equal(r.status, 1);
    assert.match(r.out, /ÇAKIŞMA: a\.txt/);
  } finally { cleanup(d); }
});
