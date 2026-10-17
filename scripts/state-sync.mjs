#!/usr/bin/env node
// state-sync.mjs — proje durumunu KAYNAKTAN TÜRETİR, elle yazılmaz.
//
// NEDEN VAR (ölçüm, 2026-08-12): `docs/STATE.md` 31 dalgada 9 kez güncellendi (%29) ve son
// güncellemeden sonra 5 commit + 4 sürüm geldi. "Aktif iş" tablosu v0.18.1/v0.18.5'i
// "commit+release bekliyor" diye gösteriyordu — ikisi de commit'lenmişti. Yani dosya, gerçeği
// yansıtmayı BIRAKMIŞTI ve kimse fark etmedi.
//
// TEŞHİS (3 dış-model paneli, 2026-08-12 — Codex + GLM-5.2 + Claude/hakem, 3/3 mutabık):
// "Bir kural, ihlal edildiğinde bir sonraki zorunlu geçişi bozmuyorsa kural değildir."
// Elle yazılan HESAPLANABİLİR dosya tanım gereği bayatlar; disiplin sorunu DEĞİL, tasarım hatası.
// Yazılmayan şey bayatlayamaz → dosya değil KOMUT olmalı.
//
// 🔴 SINIR — bu script yalnız TÜRETİLEBİLİR kısmı üretir. İnsan/model YARGISI taşıyan defterler
// (karar defteri · FRICTION_LOG · SIDE-BUGS-LOG) BUNUN KAPSAMINDA DEĞİLDİR ve silinmemelidir:
// onlar git'ten hesaplanamaz. Panelin ayrımı: türetilebilir → komut · türetilemez → append-only + kapı.
//
// KİMLİK: kapı DEĞİL, orkestratör de değil — saf RAPORLAYICI. İnsan çağırır (`npm run state`),
// kendi kendine koşmaz, hiçbir dosyayı DEĞİŞTİRMEZ. `--check` sürümü kapıya bağlanabilir.
//
// Kullanım:
//   node scripts/state-sync.mjs            # durumu stdout'a bas
//   node scripts/state-sync.mjs --check    # docs/STATE.md gerçekle çelişiyor mu (exit 1 = bayat)
//   node scripts/state-sync.mjs --json

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');
const CHECK = argv.includes('--check');

const sh = (c) => { try { return execSync(c, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim(); } catch { return ''; } };

// ---------------------------------------------------------------- saf fonksiyonlar (test edilir)
export function surumUcluAyikla(pkg, skill, bundleAdlari) {
  const p = (JSON.parse(pkg).version || '').trim();
  const s = (skill.match(/^#\s.*\(v([0-9]+\.[0-9]+\.[0-9]+)\)/m) || [])[1] || '';
  const b = bundleAdlari
    .map((n) => (n.match(/v([0-9]+\.[0-9]+\.[0-9]+)\./) || [])[1])
    .filter(Boolean)
    .sort((a, b2) => a.localeCompare(b2, undefined, { numeric: true }))
    .pop() || '';
  return { paket: p, skill: s, bundle: b, senkron: p === s && p === b };
}

// STATE.md'nin bayat olup olmadığı: son güncellemesinden SONRA kaç commit geldi?
// Eşik değil ORAN mantığı: 0 commit = taze. ≥1 = gerçekle arasında fark VAR (bilgi), ≥3 = bayat (uyarı).
export function bayatlikSinifla(sonrakiCommit) {
  if (sonrakiCommit === 0) return 'taze';
  if (sonrakiCommit < 3) return 'gecikmis';
  return 'bayat';
}

// ---------------------------------------------------------------- türetim
function durumTuret() {
  const bundleler = sh('git ls-files public/').split('\n').filter(Boolean);
  const surum = surumUcluAyikla(
    readFileSync('package.json', 'utf8'),
    existsSync('SKILL.md') ? readFileSync('SKILL.md', 'utf8') : '',
    sh('ls public/ 2>/dev/null').split('\n').filter(Boolean),
  );
  const stateSon = sh('git log -1 --format=%ad --date=short -- docs/STATE.md');
  const sonrakiCommit = stateSon ? Number(sh(`git rev-list --count HEAD --since="${stateSon}"`)) || 0 : -1;

  return {
    surum,
    head: sh('git log -1 --format="%h %s"'),
    dal: sh('git rev-parse --abbrev-ref HEAD'),
    itilmemis: Number(sh('git rev-list --count @{u}..HEAD 2>/dev/null')) || 0,
    calismaAgaci: sh('git status --porcelain').split('\n').filter(Boolean).length,
    sonDalgalar: sh('git log --oneline -5 --grep="^feat\\|^fix"').split('\n').filter(Boolean),
    aktifDefter: sh('ls v*-KARAR-DEFTERI.md 2>/dev/null').split('\n').filter(Boolean).pop() || '(yok)',
    bundleIzlenen: bundleler.length,
    state: { sonGuncelleme: stateSon || '(hiç)', sonrakiCommit, sinif: bayatlikSinifla(sonrakiCommit) },
  };
}

// ---------------------------------------------------------------- ana akış
if (process.argv[1] && process.argv[1].endsWith('state-sync.mjs')) {
  const d = durumTuret();
  if (JSON_OUT) { console.log(JSON.stringify(d, null, 2)); process.exit(0); }

  console.log(`\nPROJE DURUMU — git'ten TÜRETİLDİ (elle yazılmadı)\n`);
  console.log(`  dal        : ${d.dal}${d.itilmemis ? ` (${d.itilmemis} itilmemiş commit)` : ''}`);
  console.log(`  HEAD       : ${d.head}`);
  console.log(`  çalışma ağacı: ${d.calismaAgaci === 0 ? 'temiz' : d.calismaAgaci + ' değişiklik'}`);
  console.log(`  sürüm üçlüsü: paket=${d.surum.paket} · SKILL=${d.surum.skill} · bundle=${d.surum.bundle}  ${d.surum.senkron ? '✅ senkron' : '🔴 SENKRON DEĞİL'}`);
  console.log(`  aktif defter : ${d.aktifDefter}`);
  console.log(`\n  son dalgalar:`);
  for (const s of d.sonDalgalar) console.log(`    ${s}`);
  console.log(`\n  docs/STATE.md tazeliği: ${d.state.sinif.toUpperCase()} (son ${d.state.sonGuncelleme}, sonrasında ${d.state.sonrakiCommit} commit)`);

  if (CHECK && d.state.sinif === 'bayat') {
    console.error(`\n🔴 STATE-BAYAT: docs/STATE.md son güncellemesinden sonra ${d.state.sonrakiCommit} commit geldi.`);
    console.error(`   Elle yazılan durum dosyası gerçeği yansıtmıyor. Bu çıktı onun yerine geçer.`);
    process.exit(1);
  }
  if (CHECK && !d.surum.senkron) {
    console.error(`\n🔴 SÜRÜM ÜÇLÜSÜ SENKRON DEĞİL — D-A boru hattı adım ② ihlali.`);
    process.exit(1);
  }
}
