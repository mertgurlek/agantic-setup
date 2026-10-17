#!/usr/bin/env node
// sahiplik.mjs — dosya sahipliği CLI'si (v0.31.0). Kayıt mantığı gates/lib/sahiplik.mjs'te; bu yalnız komut kabuğu.
//
// NEDEN VAR: paralel ajanlar/oturumlar aynı dosyayı ezmesin. Claude ajanlarını hook korur; dış-model
// koşuları (codex/openrouter) hook'a girmez → sarmalayıcı bu CLI ile ÖNCE beyan alır, SONRA fotoğraf farkıyla doğrular.
//
// KİMLİK: kapı DEĞİL, daemon DEĞİL — İNSAN/sarmalayıcı çağırır. Oturum: --session=<id> > env CLAUDE_CODE_SESSION_ID
// (Bash çocuklarında alt ajanda da var [ÖLÇÜLDÜ 2026-10-06]; agent_id env'de YOK → --agent ile verilir).
//
// Kullanım:
//   node scripts/sahiplik.mjs al <yol...> [--ad=<oturum-adı>] [--agent=<id>] [--kaynak=claude|openrouter|codex]
//   node scripts/sahiplik.mjs birak [yol...]        # yol yoksa oturumun tümü (--agent verilmişse yalnız o ajanın)
//   node scripts/sahiplik.mjs liste [--json]
//   node scripts/sahiplik.mjs ad <oturum-adı>       # ListAgents'ın ilk satırındaki ad (session_id mesaj adresi DEĞİL)
//   node scripts/sahiplik.mjs kontrol <yol...>      # yazmadan sorgu
//   node scripts/sahiplik.mjs fotograf <dosya.json> # dış-model koşusu ÖNCESİ çalışma-ağacı fotoğrafı
//   node scripts/sahiplik.mjs karsilastir <dosya.json> [--yaz=a,b,dizin/,glob/**]
// Çıkış: 0 temiz · 1 çakışma/beyan dışı · 2 kullanım hatası. Git reposu değilse uyarı + exit 0.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { al, sorgula, birak, liste, oturumAdiYaz, sahipTarifi, repoBaglami } from '../gates/lib/sahiplik.mjs';

const argv = process.argv.slice(2);
const bayrak = {};
const poz = [];
for (const a of argv) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) bayrak[m[1]] = m[2] ?? true; else poz.push(a);
}
const [komut, ...args] = poz;
const cwd = process.cwd();

function yardim() {
  const s = readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3));
  console.log(s.join('\n'));
}
function hata(msg) { console.error(`sahiplik: ${msg}`); process.exit(2); }

if (!komut || bayrak.help || komut === 'help') { yardim(); process.exit(komut || bayrak.help ? 0 : 2); }
const KOMUTLAR = ['al', 'birak', 'liste', 'ad', 'kontrol', 'fotograf', 'karsilastir'];
if (!KOMUTLAR.includes(komut)) hata(`bilinmeyen komut: ${komut} (--help)`);

const ctx = repoBaglami(cwd);
if (!ctx) { console.error('sahiplik: git reposu değil — no-op'); process.exit(0); }

const session = typeof bayrak.session === 'string' ? bayrak.session : process.env.CLAUDE_CODE_SESSION_ID || null;
const agent = typeof bayrak.agent === 'string' ? bayrak.agent : null;
const kaynak = typeof bayrak.kaynak === 'string' ? bayrak.kaynak : 'claude';
if (!['claude', 'openrouter', 'codex'].includes(kaynak)) hata(`--kaynak claude|openrouter|codex olmalı (verilen: ${kaynak})`);
const mutlak = y => resolve(cwd, y);
const oturumGerek = () => { if (!session) hata('oturum kimliği yok (--session=<id> ya da env CLAUDE_CODE_SESSION_ID)'); };

function git(...a) {
  return execFileSync('git', a, { cwd: ctx.kok, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 });
}
function sha(rel) {
  try { return createHash('sha1').update(readFileSync(resolve(ctx.kok, rel))).digest('hex'); } catch { return null; }
}
// Çalışma ağacı: { yol: sha1|null(silinmiş) } — yalnız kirli dosyalar (porcelain -z: yeniden adlandırmada 2. kayıt eski yol).
function agacDurumu() {
  const out = {};
  const parcalar = git('status', '--porcelain', '-uall', '-z').split('\0').filter(Boolean);
  for (let i = 0; i < parcalar.length; i++) {
    const xy = parcalar[i].slice(0, 2);
    const yol = parcalar[i].slice(3);
    if (/[RC]/.test(xy)) { i++; out[parcalar[i]] = null; }
    out[yol] = sha(yol);
  }
  return out;
}
const head = () => { try { return git('rev-parse', 'HEAD').trim(); } catch { return null; } };

function globRe(p) {
  if (p.endsWith('/')) p += '**';
  const src = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*');
  return new RegExp(`^${src}$`);
}
function beyanIcinde(rel, desenler) {
  return desenler.some(d => {
    const n = d.replace(/\\/g, '/').replace(/^\.\//, '');
    return globRe(n).test(rel) || (!/[*]/.test(n) && !n.endsWith('/') && rel.startsWith(n + '/'));
  });
}

switch (komut) {
  case 'al': {
    oturumGerek();
    if (!args.length) hata('al: en az bir yol ver');
    if (typeof bayrak.ad === 'string') oturumAdiYaz({ cwd, session, ad: bayrak.ad });
    const alinan = [], cakisan = [];
    for (const y of args) {
      const r = al({ cwd, yol: mutlak(y), session, agent, kaynak });
      if (r.durum === 'cakisma') cakisan.push({ y, sahip: r.sahip });
      else if (r.durum === 'alindi' || r.durum === 'devralindi') alinan.push(y);
    }
    if (cakisan.length) {
      if (alinan.length) birak({ cwd, session, agent, yollar: alinan.map(mutlak) }); // ya hep ya hiç
      for (const c of cakisan) console.log(`ÇAKIŞMA ${c.y} — ${sahipTarifi(c.sahip, { cwd })}`);
      console.log(`${cakisan.length} yol başkasında; hiçbiri alınmadı (kısmi alınanlar geri bırakıldı).`);
      process.exit(1);
    }
    console.log(`${args.length} yol alındı/yenilendi.`);
    break;
  }
  case 'birak': {
    oturumGerek();
    const n = birak({ cwd, session, agent: agent ?? undefined, yollar: args.length ? args.map(mutlak) : undefined });
    console.log(`${n} kayıt bırakıldı.`);
    break;
  }
  case 'liste': {
    const l = liste({ cwd });
    if (bayrak.json) { console.log(JSON.stringify(l, null, 2)); break; }
    if (!l.length) console.log('kayıt yok.');
    for (const k of l) console.log(`${k.yol} · ${sahipTarifi(k, { cwd })}${k.bayat ? ' · BAYAT' : ''}`);
    break;
  }
  case 'ad': {
    oturumGerek();
    if (!args.length) hata('ad: oturum adı ver');
    oturumAdiYaz({ cwd, session, ad: args.join(' ') });
    console.log('oturum adı yazıldı.');
    break;
  }
  case 'kontrol': {
    oturumGerek();
    if (!args.length) hata('kontrol: en az bir yol ver');
    let cak = 0;
    for (const y of args) {
      const r = sorgula({ cwd, yol: mutlak(y), session, agent });
      if (r.durum === 'cakisma') { cak++; console.log(`ÇAKIŞMA ${y} — ${sahipTarifi(r.sahip, { cwd })}`); }
    }
    if (!cak) console.log('çakışma yok.');
    process.exit(cak ? 1 : 0);
    break;
  }
  case 'fotograf': {
    if (!args[0]) hata('fotograf: çıktı dosyası ver');
    writeFileSync(resolve(cwd, args[0]), JSON.stringify({ head: head(), t: Date.now(), dosyalar: agacDurumu() }, null, 2));
    console.log(`fotoğraf yazıldı: ${args[0]}`);
    break;
  }
  case 'karsilastir': {
    if (!args[0]) hata('karsilastir: fotoğraf dosyası ver');
    const f = resolve(cwd, args[0]);
    if (!existsSync(f)) hata(`fotoğraf yok: ${args[0]}`);
    const once = JSON.parse(readFileSync(f, 'utf8'));
    const simdi = agacDurumu();
    const kendi = relative(ctx.kok, f).split(sep).join('/'); // fotoğraf dosyasının kendisi fark sayılmaz
    delete simdi[kendi];
    delete once.dosyalar[kendi];
    const degisen = new Set();
    for (const y of new Set([...Object.keys(once.dosyalar), ...Object.keys(simdi)])) {
      const a = y in once.dosyalar ? once.dosyalar[y] : 'temiz', b = y in simdi ? simdi[y] : 'temiz';
      if (a !== b) degisen.add(y);
    }
    if (head() !== once.head) console.log('UYARI: HEAD koşu sırasında değişti (commit/checkout).');
    const desenler = typeof bayrak.yaz === 'string' ? bayrak.yaz.split(',').map(s => s.trim()).filter(Boolean) : null;
    const dis = [], cak = [];
    for (const y of [...degisen].sort()) {
      const tur = !(y in simdi) ? 'temizlendi' : simdi[y] === null ? 'silindi' : !(y in once.dosyalar) ? 'eklendi/değişti' : 'değişti';
      console.log(`${tur}: ${y}`);
      if (desenler && !beyanIcinde(y, desenler)) dis.push(y);
      if (session) {
        const r = sorgula({ cwd, yol: resolve(ctx.kok, y), session, agent });
        if (r.durum === 'cakisma') cak.push({ y, sahip: r.sahip });
      }
    }
    for (const y of dis) console.log(`BEYAN DIŞI: ${y}`);
    for (const c of cak) console.log(`ÇAKIŞMA: ${c.y} — ${sahipTarifi(c.sahip, { cwd })}`);
    if (!degisen.size) console.log('koşu sırasında değişen dosya yok.');
    process.exit(dis.length || cak.length ? 1 : 0);
    break;
  }
}
