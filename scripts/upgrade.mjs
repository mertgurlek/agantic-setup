#!/usr/bin/env node
// upgrade (v0.15 YENİ — K24) — kurulu bir hedef reponun GENERIC dosyalarını kurulu skill
// paketinden tazeler. ECC üçlüsünün (makbuz + doctor + repair) eksik ayağı: v0.14'te doctor
// "kurulum makbuza göre bütün mü" sorusunu ölçüyordu ama ONARMIYORDU; kullanıcının reçetesi
// elle kopyalamaktı. Bu araç o boşluğu kapatır — K15'in (v0.11) bilinçle ERTELEDİĞİ komut.
//
// KİMLİK SINIRI (kırmızı çizgi): hedef repoda daemon/watcher/cron/hook KURMAZ. Elle (ya da
// istenirse CI'dan) çağrılan tek-koşu bir araçtır. Paketin KENDİ aracıdır — hedef repoya
// kopyalanan bir `gates/` kapısı DEĞİL (CLI sözleşmesi kapsamı dışı; CONTRACT.md'de belgeli).
//
// 🔴 UYGULAYAN ≠ DOĞRULAYAN (araç düzeyinde): doctor SALT-OKUR ölçer (hakem), upgrade YAZAR
// (uygulayıcı). Bu yüzden `install-doctor --repair` DEĞİL, ayrı script. Drift/eksik bilgisini
// doctor'dan `--json` ile ALIR. Yazmadan önceki kendi bayatlık kontrolü için doctor'daki
// EOL-normalize hash kuralının AYNISINI taşır (aşağıda `sha256`; doctor üst düzeyde yan etkili bir
// CLI olduğu için import edilemez — iki kopya, kural değişirse İKİSİ birlikte güncellenir).
//
// ⚠️ EN KRİTİK KURAL — KULLANICININ İŞİNİ SESSİZCE SİLME:
//   • DRIFT'Lİ dosya (mühürlü ama mühre uymuyor = kullanıcı elle değiştirmiş) ATLANIR.
//     Hiçbir bayrak onu ezmez (v0.15'te `--force-drifted` BİLİNÇLE YOK — kalibre edilmemiş
//     kaçış yolu yazma yasağı; drift'in sahadaki sıklığı/nedeni ölçülmedi → pilota ertelendi).
//   • MÜHÜRSÜZ dosya ATLANIR: orada "drift yok" bilgisi değil, BİLGİ YOKLUĞU var; bilgisizliği
//     "temiz" saymak self-report yasasının ihlalidir. Önce `--doctor --seal`.
//   • EKSİK dosya OLUŞTURULMAZ: "kullanıcı sildi mi, kaza mı" sorusu ölçülmeden cevaplanmaz.
//   • repo_owned_files'a ASLA dokunulmaz (ALTIN KURAL: içerik kopyalanmaz, üretilir).
//   • YENİ generic dosya (pakette var, künyede yok) yalnız RAPORLANIR — kapı kurmak bir
//     KALİBRASYON işidir (GUARDS satırı, negatif kontrol, CONTRACT kaydı), dosya kopyalamak değil.
//
// v0.30 EKLERİ (G4): (B10a) fork beyanlı dosya ATLANIR (ATLANDI-FORK) · (B10b) eski künye şemaları doctor'ın
// normalize görünümüyle okunur (dosya yeniden yazılmaz) · (B10c) gates_contract_version uyuşmazlığında
// dry-run GÖÇ RAPORU basar (yalnız tespit; --apply yine REDDEDİLİR) · (T6) `--toggle=<ad>=<true|false>`
// künyeyi günceller + katman dosya listesini basar (`--dry-run` yazmaz; dosya ÜRETMEZ).
// Kullanım: node scripts/upgrade.mjs [--target=<dizin>] [--source=<dizin>] [--json]
//                                    [--apply] [--strict] [--allow-downgrade] [--allow-dirty]
//   (dispatch: node verify.mjs --upgrade [...] — install-exam/doctor kalıbının aynısı)
//   VARSAYILAN: DRY-RUN (yalnız rapor, exit 0). Yazan araç varsayılan SUSAR — `--seal` emsali;
//   K15 sözleşmesi de "fark raporu + ONAY isteyen komut" diyor, `--apply` o onayın makine hâli.
//   --strict : dry-run'da bayat dosya varsa exit 1 (CI alarmı; varsayılan değil — yanlış-alarm öldürür).
//   --apply  : fiilen yaz. Kirli git ağacında REDDEDER (`--allow-dirty` ile geçilir): kullanıcının
//              geri-alma yolu (git checkout) belirsizleşmesin (pack-skill temiz-ağaç guard'ının kardeşi).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname, basename, posix } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { YASAM_DONGUSU_ARACLARI } from '../gates/lib/tazelenebilir.mjs';

const argv = process.argv.slice(2);
const arg = (ad, varsayilan) => {
  const a = argv.find(x => x.startsWith(`--${ad}=`));
  return a ? a.slice(ad.length + 3) : varsayilan;
};
const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..');
const TARGET = resolve(arg('target', '.'));
const SOURCE = resolve(arg('source', PKG_ROOT));
const JSON_OUT = argv.includes('--json');
const APPLY = argv.includes('--apply');
const STRICT = argv.includes('--strict');
const ALLOW_DOWN = argv.includes('--allow-downgrade');
const ALLOW_DIRTY = argv.includes('--allow-dirty');
const DRY_RUN = argv.includes('--dry-run');      // açık dry-run: varsayılan zaten dry-run; `--toggle` ile birlikte künyeyi YAZMAZ
const MANIFEST = join(TARGET, '.agentic-repo-setup.json');

// EOL-normalize hash — doctor'daki kuralın AYNISI (v0.14 U1: autocrlf'li clone CRLF'e smudge
// eder; ham-bayt karşılaştırma Windows'ta HER dosyayı "bayat" gösterirdi).
const sha256 = (p) => createHash('sha256').update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const die = (msg, kod = 1) => { console.error(`\nUPGRADE REDDEDİLDİ — ${msg}\n`); process.exit(kod); };
const semver = (s) => String(s || '').match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1, 4).map(Number) || null;
const cmpVer = (a, b) => {                     // -1: a<b · 0: eşit · 1: a>b · null: ölçülemez
  const x = semver(a), y = semver(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
};

// ── Kaynak eşleme (süpervizör kararı 2026-07-27: ad-ile-arama, TEK eşleşmede kabul) ──────────
// Hedef repolar kapıları kendi düzenlerine kopyalar (CONTRACT: hedefte `scripts/` altına;
// pakette `gates/`), bu yüzden birebir yol eşlemesi tek başına kırılgandır. Sıra:
//   ① künyedeki göreli yol kaynakta var mı → kullan
//   ② yoksa DOSYA ADIYLA kaynakta ara → TEK eşleşme varsa kabul, 0 veya 2+ ise ÖLÇÜLEMEDİ.
// Belirsizlikte UYDURMA YOK (yanlış dosyayı tazelemek, tazelememekten kötüdür).
// v0.30.2 (SB-28/saha): TAZELENEBİLİR KAYNAK KÜMESİ = açık İZİN LİSTESİ: yalnız paketin `gates/**` ağacı.
// Paketin "hedefe BİREBİR kopyalanır" diye tanımladığı tek küme kapı dizinidir (SKILL FAZ 2 madde 3);
// hedef künyesindeki `runner`/`ci` kategorileri paketten kopya DEĞİL, hedefte ÜRETİLMİŞ dosyalardır
// (templates/*'dan doğar, repoya özgü). Paketin kendi repo-dosyaları (docs/, .github/, kök defterler,
// tests/…) ASLA kaynak olamaz — aynı göreli yolda bulunsalar bile (skill'in KENDİ SIDE-BUGS-LOG'u
// ve verify.yml'i sahada hedefe yazılmaya çalışıldı).
const IZIN_DIZINLERI = ['gates'];   // + gates/lib/tazelenebilir.mjs içindeki açık yaşam-döngüsü listesi (doctor ⑪ ile ortak)
function kaynakBul(relPath) {
  const rel = String(relPath).split('\\').join('/');
  const ad = basename(rel);
  const izinli = [];
  const tara = (dir, derinlik = 0) => {
    let girisler; try { girisler = readdirSync(join(SOURCE, dir), { withFileTypes: true }); } catch { return; }
    for (const g of girisler) {
      const r = `${dir}/${g.name}`;
      if (g.isFile() && g.name === ad) izinli.push(r);
      else if (g.isDirectory() && derinlik < 2) tara(r, derinlik + 1);
    }
  };
  for (const d of IZIN_DIZINLERI) tara(d);
  if (YASAM_DONGUSU_ARACLARI.includes(rel)) {      // açık liste: yol eşleşmesi, paketten birebir kopya
    const a = join(SOURCE, rel);
    return existsSync(a) && statSync(a).isFile() ? { abs: a, nasil: 'birebir (yaşam-döngüsü aracı)' } : { abs: null, nasil: 'kaynakta yok' };
  }
  const birebir = izinli.find(r => r === rel);
  if (birebir) return { abs: join(SOURCE, birebir), nasil: 'birebir' };
  if (izinli.length === 1) return { abs: join(SOURCE, izinli[0]), nasil: `ad-eşleşmesi (${izinli[0]})` };
  if (izinli.length > 1) return { abs: null, nasil: `belirsiz (${izinli.length} eşleşme: ${izinli.join(', ')})` };
  // İzin dışı: pakette (gates/ dışında) aynı yol/ad var mı? → şablon-üretimi imzası; yoksa kaynaksız.
  const disarida = existsSync(join(SOURCE, rel)) && statSync(join(SOURCE, rel)).isFile();
  return { abs: null, izinDisi: true, sablonUretimi: disarida || /(^|\/)(docs|\.github)\//.test(rel), nasil: 'kaynakta yok' };
}

// ── Künye + doctor girdisi ────────────────────────────────────────────────────────────────────
if (!existsSync(MANIFEST)) {
  const m = `Makbuz yok (${MANIFEST}) — bu repo bu skill'le kurulmamış görünüyor ya da künye yazılmamış.\n`
    + '  Kurulum künyesi yükseltmenin ÖN KOŞULUDUR (K15): SKILL FAZ 2/5 künye adımını koş, sonra\n'
    + '  node verify.mjs --doctor --seal --target=. ile mühürle.';
  if (JSON_OUT) console.log(JSON.stringify({ target: TARGET, verdict: 'UYGULANAMAZ', detail: m, plan: [] }, null, 2));
  else console.log(`\nUPGRADE UYGULANAMAZ — ${m}\n`);
  process.exit(0);       // makbuz-öncesi kurulum SUÇLANMAZ (doctor ① ile aynı dürüst sınır)
}
let manifest;
try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); }
catch (e) { die(`künye parse edilemedi: ${e.message} — yalan/bozuk künye elle onarılmalı (doctor ① FAIL der).`); }

let pkgVer = null;
try { pkgVer = JSON.parse(readFileSync(join(SOURCE, 'package.json'), 'utf8')).version; } catch { /* yok */ }
const kunyeVer = manifest.skill_version;

// ── Doctor'dan yapısal drift/eksik + NORMALİZE künye görünümü al (kendi hash'ini/normalizasyonunu
// hesaplamaz — çift-kaynak yasağı; v0.30: B10b eski-şema normalizasyonu TEK yerde = doctor `kunye`) ──
const dr = spawnSync(process.execPath, [join(HERE, 'install-doctor.mjs'), `--target=${TARGET}`, '--json'],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
let doctorJson = null;
try { doctorJson = JSON.parse(dr.stdout || '{}'); } catch { /* parse edilemedi */ }
const doctorSonuc = doctorJson?.results || null;
if (!doctorSonuc) die('doctor mutabakatı okunamadı (install-doctor --json). Önce: node verify.mjs --doctor');
const kunyeNorm = doctorJson.kunye || null;
const bul = (id) => doctorSonuc.find(r => r.id === id) || {};
const driftli = new Set(bul('③').paths || []);
const muhursuz = new Set(bul('③').unsealed || []);
const eksik = new Set(bul('②').paths || []);
const forkluYollar = new Set(bul('⑦').paths || []);

// ── T6 (v0.30): `--toggle=<ad>=<true|false>` — künyede toggle'ı günceller + o katmanın dosya listesini
// basar. YALNIZ künye yazılır; katman dosyalarını ÜRETMEZ (kurulumu AJAN yapar). Skill sürümü/
// sözleşme/downgrade ön-kapılarından ÖNCE çalışır: toggle işi sürüm geçişi değil künye düzeltmesidir.
// Dosya listesinin KAYNAĞI (kodda TEK tablo; reference/ değişirse bu tablo birlikte güncellenir):
//   reference/adim0-toggle-ve-mod.md §1-2 (toggle tanımları) · reference/multi-team.md §1a/§1b/§2a-c/§4 ·
//   reference/faz2-dokuman-katmani.md §1/§8 · reference/faz3-bilgi-katmani.md madde 3/3c/3d.
const TOGGLE_KATMAN = {
  'muhatap.pm_urun': [
    { yol: 'docs/PRODUCT_LOG.md', kaynak: 'reference/multi-team.md §1a (append-only → APPEND_ONLY_EXTRA\'ya tanıt)' },
    { yol: '.claude/agents/pm-sorgu.md', kaynak: 'reference/multi-team.md §1b · templates/roles.template.md' },
    { yol: 'CLAUDE.md (süpervizör matrisine ürün-karar tetikleyicileri)', kaynak: 'reference/multi-team.md §1c', dosyaDegil: true },
  ],
  'muhatap.qa_senaryo': [
    { yol: 'docs/scenarios/<akış>.md | <akış>.scenario.json', kaynak: 'reference/multi-team.md §2a', dosyaDegil: true },
    { yol: 'co-update kapısı bağlantısı: gates/check-history.mjs --rule=co-update', kaynak: 'reference/multi-team.md §2b', dosyaDegil: true },
    { yol: 'qa rolü çıkış-kapısı eki', kaynak: 'reference/multi-team.md §2c · templates/roles.template.md', dosyaDegil: true },
  ],
  'muhatap.son_kullanici_dokumani': [
    { yol: 'docs/registry.yaml', kaynak: 'reference/faz3-bilgi-katmani.md 3c · templates/registry.template.yaml' },
    { yol: 'docs/user/ (dizin; ilk makale ŞİMDİ üretilmez)', kaynak: 'reference/faz3-bilgi-katmani.md 3c · templates/L0-son-kullanici.template.md', dosyaDegil: true },
    { yol: 'docs/tech/ ([T] teknik doküman, kodla senkron)', kaynak: 'reference/faz2-dokuman-katmani.md §1 · templates/T-teknik-dokuman.template.md', dosyaDegil: true },
    { yol: 'kapılar: check-provenance coverage-gate/registry-join + check-doc-integrity doc-recency', kaynak: 'reference/faz2-dokuman-katmani.md', dosyaDegil: true },
  ],
  'muhatap.test_koprusu': [
    { yol: 'test-brief.yaml (şema: templates/test-brief.template.yaml; hedef yol faz2 §8\'de)', kaynak: 'reference/faz2-dokuman-katmani.md §8', dosyaDegil: true },
    { yol: 'kapı: check-provenance --rule=brief-provenance', kaynak: 'reference/faz2-dokuman-katmani.md §8', dosyaDegil: true },
  ],
  'takip.state': [
    { yol: 'docs/STATE.md', kaynak: 'reference/faz3-bilgi-katmani.md madde 3 · templates/trackers.template.md' },
  ],
  'takip.yan_bug': [
    { yol: 'docs/SIDE-BUGS-LOG.md', kaynak: 'reference/faz3-bilgi-katmani.md madde 3 · templates/side-bugs-log.template.md (APPEND_ONLY_EXTRA\'ya tanıt)' },
  ],
  'dis_entegrasyon.is_takip': [
    { yol: 'docs/integrations/tracker.md', kaynak: 'reference/faz3-bilgi-katmani.md madde 3 [DEAK] · templates/fibery-adapter.template.md (yalnız MCP bağlıysa)' },
  ],
  'dis_entegrasyon.ast_indeks': [
    { yol: 'docs/integrations/ast-index.md', kaynak: 'reference/faz3-bilgi-katmani.md madde 3 [DEAK] · templates/ast-index-adapter.template.md (üç-kapılı envanter yeşilse)' },
  ],
};
const TOGGLE_ARG = arg('toggle', null);
if (TOGGLE_ARG !== null) {
  const m = TOGGLE_ARG.match(/^([a-z_.]+)=(true|false)$/);
  if (!m) die(`--toggle biçimi: --toggle=<ad>=<true|false> (verilen: "${TOGGLE_ARG}")`);
  const deger = m[2] === 'true';
  const adaylar = Object.keys(TOGGLE_KATMAN).filter(k => k === m[1] || k.endsWith('.' + m[1]));
  if (adaylar.length !== 1) die(`bilinmeyen/belirsiz toggle "${m[1]}". Geçerli: ${Object.keys(TOGGLE_KATMAN).join(', ')}`);
  const anahtar = adaylar[0];
  const [grup, ad] = anahtar.split('.');
  if (kunyeNorm?.schema && kunyeNorm.schema !== 'standart')
    die(`künye şeması "${kunyeNorm.schema}" — toggle yazılamaz (standart toggles.* alanları yok; dosyayı yeniden yazmak künyeyi ÇEVİRİR). Önce künyeyi standart şemaya elle taşı.`);
  const onceki = manifest.toggles?.[grup]?.[ad];
  const liste = TOGGLE_KATMAN[anahtar].map(x => ({ ...x,
    durum: x.dosyaDegil ? '-' : (existsSync(join(TARGET, x.yol)) ? 'VAR' : 'YOK') }));
  if (!DRY_RUN) {
    manifest.toggles = manifest.toggles && typeof manifest.toggles === 'object' ? manifest.toggles : {};
    manifest.toggles[grup] = manifest.toggles[grup] && typeof manifest.toggles[grup] === 'object' ? manifest.toggles[grup] : {};
    manifest.toggles[grup][ad] = deger;
    const mTmp = `${MANIFEST}.ars-tmp`;
    writeFileSync(mTmp, JSON.stringify(manifest, null, 2) + '\n');
    renameSync(mTmp, MANIFEST);
  }
  if (JSON_OUT) console.log(JSON.stringify({ target: TARGET, mod: DRY_RUN ? 'toggle-dry-run' : 'toggle', toggle: anahtar,
    onceki: onceki ?? null, yeni: deger, kunye_yazildi: !DRY_RUN, katman: liste }, null, 2));
  else {
    console.log(`\nupgrade --toggle — ${anahtar}: ${onceki === undefined ? '(yok)' : String(onceki)} → ${deger}${DRY_RUN ? '  (DRY-RUN — künye YAZILMADI)' : '  (künye güncellendi)'}\n`);
    console.log(deger
      ? '  Bu toggle\'ın kurduğu katman (KURULUMU AJAN YAPAR — bu komut dosya üretmez):'
      : '  Toggle KAPALI: aşağıdaki katman KURULMAZ (var olan dosyalar silinmez — kullanıcı kararı):');
    for (const x of liste) console.log(`    ${x.durum.padEnd(4)} ${x.yol}\n         kaynak: ${x.kaynak}`);
    console.log();
  }
  process.exit(0);
}

// v0.30.2: `--sahiplen=<yol>[,<yol>]` — girdiyi generic_files'tan repo_owned_files'a MAKİNE yazımıyla taşır (fork beyanı
// deseni: yalnız künye, atomik). Şablon-üretimi/yerel dosyalar (docs/SIDE-BUGS-LOG.md, .github/workflows/verify.yml…)
// generic sayıldığı için drift FAIL/yanlış-tazeleme üretir; doğru sahip repo'dur. Dosyaya DOKUNMAZ; sha256 düşer
// (owned asla hash'lenmez). `--dry-run` yazmaz. Sürüm/sözleşme ön-kapılarından ÖNCE (künye düzeltmesidir).
const SAHIPLEN_ARG = arg('sahiplen', null);
if (SAHIPLEN_ARG !== null) {
  const istenen = SAHIPLEN_ARG.split(',').map(x => x.trim().split('\\').join('/')).filter(Boolean);
  if (!istenen.length) die('--sahiplen=<yol>[,<yol>] boş.');
  if (kunyeNorm?.schema && kunyeNorm.schema !== 'standart')
    die(`künye şeması "${kunyeNorm.schema}" — generic/owned listeleri standart değil; elle taşı (dosyayı yeniden yazmak künyeyi ÇEVİRİR).`);
  const gg = manifest.generic_files;
  const bulunan = new Set(), tasinan = [];
  const ayikla = (liste) => liste.filter(e => {
    const p = typeof e === 'string' ? e : e?.path;
    const k = String(p).split('\\').join('/');
    if (!istenen.includes(k)) return true;
    bulunan.add(k); tasinan.push(p); return false;
  });
  if (Array.isArray(gg)) manifest.generic_files = ayikla(gg);
  else if (gg && typeof gg === 'object') for (const k of Object.keys(gg)) if (Array.isArray(gg[k])) gg[k] = ayikla(gg[k]);
  const yok = istenen.filter(x => !bulunan.has(x));
  if (yok.length) die(`künyedeki generic_files içinde YOK: ${yok.join(', ')} — hiçbir şey yazılmadı.`);
  manifest.repo_owned_files = Array.isArray(manifest.repo_owned_files) ? manifest.repo_owned_files : [];
  const zaten = new Set(manifest.repo_owned_files.map(x => String(typeof x === 'string' ? x : x?.path).split('\\').join('/')));
  for (const p of tasinan) if (!zaten.has(String(p).split('\\').join('/'))) manifest.repo_owned_files.push(p);
  if (!DRY_RUN) {
    const mTmp = `${MANIFEST}.ars-tmp`;
    writeFileSync(mTmp, JSON.stringify(manifest, null, 2) + '\n');
    renameSync(mTmp, MANIFEST);
  }
  if (JSON_OUT) console.log(JSON.stringify({ target: TARGET, mod: DRY_RUN ? 'sahiplen-dry-run' : 'sahiplen', tasinan, kunye_yazildi: !DRY_RUN }, null, 2));
  else console.log(`\nupgrade --sahiplen — ${tasinan.length} girdi generic_files → repo_owned_files${DRY_RUN ? '  (DRY-RUN — künye YAZILMADI)' : '  (künye güncellendi)'}\n`
    + tasinan.map(p => `    ${p}`).join('\n')
    + '\n  Dosyalara dokunulmadı; artık tazelenmez/drift ölçülmez. Sonra: node verify.mjs --doctor --seal --target=.\n');
  process.exit(0);
}

// ÖN-KAPI 1: kapı sözleşmesi uyuşmazlığı → BLOKE (kaçış yolu YOK, bilinçle).
// Gerekçe: `gates_contract_version` artışı TANIMI GEREĞİ argüman/çıkış-kodu/JSON şeması
// kırılmasıdır (CONTRACT.md sürümleme kuralı). Kırık arayüzlü kapıyı sessizce yerine koymak
// hedef reponun pre-commit'ini/CI'ını sessizce bozar — "kurulu ama çalışmıyor"un en kötü hâli,
// üstelik BİZİM ürettiğimiz. Migrasyon yolu HENÜZ ÖLÇÜLMEDİ (1→2 hiç yaşanmadı) → --force yok.
// v0.30 (B10c): dry-run'da (varsayılan) bu durum artık GÖÇ RAPORU basar — yalnız TESPİT; otomatik
// uygulama YOK (--apply yine REDDEDİLİR).
let kaynakContract = null;
try { kaynakContract = (readFileSync(join(SOURCE, 'CONTRACT.md'), 'utf8').match(/gates_contract_version:\s*(\d+)/) || [])[1]; } catch { /* yok */ }
const kunyeContract = manifest.gates_contract_version != null ? String(manifest.gates_contract_version) : null;

// MADDE 14 (CONTRACT.md, v0.16 K27): 20 eski tekil kapı → 6 kategori. Eşleme KAYNAĞI: CONTRACT.md
// "Alt-kural sınıf beyanı" tablosu (`check-<kategori>:<alt-kural>`) + archive/v0.16-KARAR-DEFTERI.md K27;
// eski kapı adı = alt-kural adı (K27: "--rule=<eski-kapı-adı>"). tests/upgrade.test.mjs bu tabloyu
// CONTRACT.md'ye karşı doğrular (uydurma değil, ölçülmüş).
const ESKI_KAPI = {
  utf8: 'hygiene', secrets: 'hygiene', placeholders: 'hygiene', 'file-size': 'hygiene',
  'doc-truth': 'doc-integrity', 'doc-recency': 'doc-integrity', integrity: 'doc-integrity',
  acceptance: 'provenance', 'brief-provenance': 'provenance', 'coverage-gate': 'provenance', 'registry-join': 'provenance',
  'hakem-verdict': 'process-discipline', 'plan-exists': 'process-discipline', 'mode-escalation': 'process-discipline',
  'append-only': 'history', 'co-update': 'history', 'stale-constants': 'history',
  'rule-contracts': 'self-registry', 'orphan-gates': 'self-registry', 'design-tokens': 'self-registry',
};
const yeniCagri = (eski) => `node gates/check-${ESKI_KAPI[eski]}.mjs --rule=${eski}`;
const ATLA_DIZIN = new Set(['node_modules', '.git', '.next', 'coverage', 'arsiv', 'dist', 'build', '.vercel']);

function gocRaporuUret() {
  // (1) hedefteki eski tekil kapı dosyaları: künye listesi ∪ disk taraması (künyesiz/eski şemada tek kaynak tarama)
  const bulunan = new Map();                       // yol → { kaynak }
  const kunyeGeneric = (kunyeNorm?.generic || []).map(e => e.path);
  const kunyeOwned = kunyeNorm?.owned || [];
  for (const p of kunyeGeneric) bulunan.set(p.split('\\').join('/'), { kaynak: 'künye generic' });
  const tara = (dir, rel, derinlik) => {
    let girisler; try { girisler = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const g of girisler) {
      const r = rel ? `${rel}/${g.name}` : g.name;
      if (g.isDirectory()) { if (derinlik < 4 && !ATLA_DIZIN.has(g.name)) tara(join(dir, g.name), r, derinlik + 1); }
      else if (/^check-.+\.mjs$/.test(g.name) && !bulunan.has(r)) bulunan.set(r, { kaynak: kunyeOwned.map(x => x.split('\\').join('/')).includes(r) ? 'künye repo_owned' : 'künyede yok (taramada bulundu)' });
    }
  };
  tara(TARGET, '', 0);
  for (const p of kunyeOwned) {
    const k = p.split('\\').join('/');
    if (/(^|\/)check-.+\.mjs$/.test(k) && bulunan.has(k)) bulunan.get(k).kaynak = 'künye repo_owned';
  }
  const kapilar = [];
  for (const [yol, { kaynak }] of [...bulunan.entries()].sort()) {
    const ad = (yol.match(/(?:^|\/)check-(.+)\.mjs$/) || [])[1];
    if (!ad) continue;
    const diskte = existsSync(join(TARGET, yol));
    const eslesme = ESKI_KAPI[ad] ? yeniCagri(ad) : null;
    let yerel;
    if (kaynak === 'künye repo_owned') yerel = 'repo_owned: yerel kalibrasyon taşıyor olabilir — yeni kategoriye göçte elle taşı (tazeleme ezerse kalibrasyon KAYBOLUR)';
    else if (driftli.has(yol)) yerel = 'YEREL YAMALI (mühürden sapmış)';
    else if (kaynak === 'künye generic' && muhursuz.has(yol)) yerel = 'yerel değişiklik bilinmiyor (mühürsüz; eski paketle karşılaştırılamıyor)';
    else if (kaynak === 'künye generic' && diskte) yerel = 'mühürle birebir (yerel yama yok)';
    else yerel = 'yerel değişiklik bilinmiyor (künyede mühür yok; eski paketle karşılaştırılamıyor)';
    kapilar.push({ yol, ad, kaynak, diskte, yeni_cagri: eslesme, yerel_durum: yerel });
  }
  // (2) hook/CI/package.json satırları (YALNIZ tespit)
  const adayDosyalar = ['package.json', '.git/hooks/pre-commit', '.pre-commit-config.yaml'];
  for (const d of ['.githooks', '.husky', '.github/workflows', '.claude', 'scripts'])
    try { for (const f of readdirSync(join(TARGET, d), { withFileTypes: true }))
      if (f.isFile() && /\.(m?js|cjs|sh|ya?ml|json)$|^pre-commit$|^pre-push$/.test(f.name)) adayDosyalar.push(`${d}/${f.name}`); } catch { /* yok */ }
  const komutlar = [];
  for (const rel of adayDosyalar) {
    let txt; try { const a = join(TARGET, rel); if (!statSync(a).isFile() || statSync(a).size > 1_000_000) continue; txt = readFileSync(a, 'utf8'); } catch { continue; }
    txt.split('\n').forEach((satir, i) => {
      for (const mm of satir.matchAll(/check-([a-z][a-z0-9-]*)\.mjs/g))
        if (ESKI_KAPI[mm[1]] && komutlar.length < 200)
          komutlar.push({ dosya: rel, satir: i + 1, eski: `check-${mm[1]}.mjs`, yeni: yeniCagri(mm[1]), metin: satir.trim().slice(0, 160) });
    });
  }
  const eslesmeyen = kapilar.filter(k => !k.yeni_cagri).map(k => k.yol);
  return { aciklama: 'GÖÇ RAPORU — yalnız TESPİT; otomatik uygulama YOK (CONTRACT.md MADDE 14: eski adla çağıran script/CI/hook kırılır). Yeni kapı dosyaları paketten ELLE kurulur.',
    kapilar, komutlar, eslesmeyen,
    kisit: 'Yerel yama tespiti yalnız mühürlü girdilerde ölçülebilir; eski paket sürümü (v0.12) burada olmadığından karşılaştırma YAPILAMAZ.' };
}

if (kunyeContract && kaynakContract && kunyeContract !== kaynakContract) {
  if (APPLY)
    die(`kapı sözleşmesi ${kunyeContract} → ${kaynakContract} DEĞİŞTİ. Otomatik tazeleme GÜVENLİ DEĞİL:\n`
      + '  sürüm artışı tanımı gereği argüman/çıkış-kodu/JSON şeması kırılmasıdır ve hedef reponun\n'
      + '  pre-commit/CI koşucusu eski arayüze bağlı olabilir. Bu bir MİGRASYON işidir:\n'
      + '  paketin CONTRACT.md sürümleme notunu + karar defterini oku, elle geçir. (Kaçış yolu YOK.)\n'
      + '  Göç raporu için --apply OLMADAN koş (dry-run).');
  const goc = gocRaporuUret();
  if (JSON_OUT) console.log(JSON.stringify({ target: TARGET, source: SOURCE, mod: 'goc-raporu', verdict: 'MİGRASYON-GEREKLİ',
    gates_contract: { kunye: kunyeContract, kaynak: kaynakContract }, kunye_olculemeyen: kunyeNorm?.olculemeyen || [], goc_raporu: goc }, null, 2));
  else {
    console.log(`\nupgrade — GÖÇ RAPORU (kapı sözleşmesi ${kunyeContract} → ${kaynakContract}; --apply REDDEDİLİR, otomatik uygulama YOK)\n`);
    console.log(`  hedef: ${TARGET}`);
    console.log(`  künye şeması: ${kunyeNorm?.schema || '?'}${kunyeNorm?.olculemeyen?.length ? `  ·  ÖLÇÜLEMEYEN: ${kunyeNorm.olculemeyen.join(' · ')}` : ''}\n`);
    console.log(`  ① ESKİ TEKİL KAPI DOSYALARI (${goc.kapilar.filter(x => x.yeni_cagri).length} eşleşen / ${goc.kapilar.length} check-*.mjs) → yeni kategori + --rule= eşlemesi`);
    for (const k of goc.kapilar.filter(x => x.yeni_cagri)) {
      console.log(`    ${k.yol}${k.diskte ? '' : '  [diskte YOK]'}  <${k.kaynak}>`);
      console.log(`       → ${k.yeni_cagri}`);
      console.log(`       yerel: ${k.yerel_durum}`);
    }
    if (goc.eslesmeyen.length)
      console.log(`    EŞLEME YOK (${goc.eslesmeyen.length}; yerel/özel kapı — paketin 6 kategorisinde karşılığı yok, göçte dokunulmaz): ${goc.eslesmeyen.join(', ')}`);
    console.log(`\n  ② DEĞİŞECEK KOMUT SATIRLARI (${goc.komutlar.length}) — hook/CI/package.json/scripts (yalnız tespit)`);
    for (const c of goc.komutlar.slice(0, 40)) console.log(`    ${c.dosya}:${c.satir}  ${c.eski} → ${c.yeni}\n       ${c.metin}`);
    if (goc.komutlar.length > 40) console.log(`    … +${goc.komutlar.length - 40} satır daha (--json ile tam liste)`);
    console.log(`\n  ③ ${goc.kisit}`);
    console.log('  Sonraki adım: paketin CONTRACT.md MADDE 14 + archive/v0.16-KARAR-DEFTERI.md K27 notunu oku; geçişi elle yap.\n');
  }
  process.exit(1);   // CLI sözleşmesi geriye-uyumlu: uyuşmazlıkta çıkış kodu eskisi gibi 1 (rapor yine basılır; --strict burada anlamsız)
}

// ÖN-KAPI 2: downgrade → varsayılan RED. Sessiz downgrade yeni kapıları eskilerle EZER.
const vCmp = cmpVer(pkgVer, kunyeVer);
if (vCmp === -1 && !ALLOW_DOWN)
  die(`paket sürümü (${pkgVer}) kurulumdan (${kunyeVer}) ESKİ — bu bir DOWNGRADE.\n`
    + '  Yeni kapıları eskileriyle ezmek sessiz gerileme üretir. Bilinçliyse: --allow-downgrade');

// ── PLAN ÜRET (her girdi TEK durum alır) ──────────────────────────────────────────────────────
const g = manifest.generic_files;
const kategoriler = Array.isArray(g) ? { genel: g } : (g && typeof g === 'object' ? g : {});
const plan = [];
for (const [kat, liste] of Object.entries(kategoriler)) {
  if (!Array.isArray(liste)) continue;
  for (const e of liste) {
    const p = typeof e === 'string' ? e : e.path;
    if (!p) continue;
    const kayit = { kat, path: p };
    // v0.30.2: izin listesi dışı girdi (gates/** değil) TAZELENMEZ; BİLGİ, kısmi/bump-bloke DEĞİL. Eksik/drift/mühür
    // sınıflarından ÖNCE: yaşayan şablon-üretimi dosya meşru olarak değişir → "drift" değil "sahiplik" sorunu.
    const kb0 = forkluYollar.has(p) ? null : kaynakBul(p);
    if (kb0 && kb0.izinDisi) {
      const kb = kb0;
      plan.push({ ...kayit, durum: kb.sablonUretimi ? 'BİLGİ-ŞABLON' : 'BİLGİ-KAYNAKSIZ',
        not: (kb.sablonUretimi ? 'ŞABLON-ÜRETİMİ / repo-owned olmalı' : 'kaynakta karşılığı yok (yerel reçete)')
          + ` — künyede repo_owned_files'a taşı: node verify.mjs --upgrade --sahiplen=${p}  (tazelenmez; yükseltmeyi KISMİ yapmaz)` });
      continue;
    }
    if (eksik.has(p)) { plan.push({ ...kayit, durum: 'ATLANDI-EKSİK', not: 'hedefte dosya YOK — silinen kapıyı sessizce geri koymak "kullanıcı sildi mi, kaza mı" sorusunu ölçmeden cevaplamaktır. Önce: node verify.mjs --doctor' }); continue; }
    if (forkluYollar.has(p)) { plan.push({ ...kayit, durum: 'ATLANDI-FORK', not: 'bilinçli fork beyanı var (--fork) — skill\'deki güncel sürümle ELLE karşılaştır; upgrade bu dosyaya dokunmaz.' }); continue; }
    if (muhursuz.has(p)) { plan.push({ ...kayit, durum: 'ATLANDI-MÜHÜRSÜZ', not: 'künyede sha256 yok → drift ÖLÇÜLEMEZ; bilgisizliği "temiz" saymak yasak. Önce: node verify.mjs --doctor --seal --target=.' }); continue; }
    if (driftli.has(p)) { plan.push({ ...kayit, durum: 'ATLANDI-DRIFT', not: 'dosya mühürden SAPMIŞ (kullanıcı elle değiştirmiş) — ya skill\'den tazele ya da bilinçli fork ise girdiyi repo_owned\'a taşı. Hiçbir bayrak bunu EZMEZ (v0.15).' }); continue; }
    const { abs, nasil } = kaynakBul(p);
    if (!abs) { plan.push({ ...kayit, durum: 'ÖLÇÜLEMEDİ', not: `kaynakta karşılığı bulunamadı (${nasil}) — sessizce silinmez, dokunulmaz.` }); continue; }
    const hedefAbs = join(TARGET, p);
    plan.push(sha256(hedefAbs) === sha256(abs)
      ? { ...kayit, durum: 'GÜNCEL', kaynak: nasil }
      : { ...kayit, durum: 'BAYAT', kaynak: nasil, kaynakAbs: abs, not: 'mühürlü + drift YOK + kaynaktan farklı → güvenle tazelenebilir' });
  }
}

if (kunyeNorm && kunyeNorm.generic === null)
  plan.push({ kat: '-', path: '(generic_files)', durum: 'ÖLÇÜLEMEDİ', not: `künyede generic_files listesi yok (şema: ${kunyeNorm.schema}) — hangi dosyaların skill kopyası olduğu bilinmiyor; hiçbir dosya tazelenmez.` });

// Künyede OLMAYAN ama kaynakta bulunan generic-benzeri dosyalar: yalnız ÖNERİ (kurulmaz).
const kunyedekiAdlar = new Set(plan.map(x => basename(x.path)));
const yeniAdaylar = [];
try {
  for (const f of readdirSync(join(SOURCE, 'gates')))
    if (/^check-.*\.mjs$/.test(f) && !kunyedekiAdlar.has(f)) yeniAdaylar.push(`gates/${f}`);
} catch { /* kaynakta gates yok */ }

// ── BAĞIMLILIK KAPANIŞI (v0.30 hakem 2. tur) — SINIF hata: tazelenen dosya YENİ bir göreli modülü import
// ediyorsa ama hedefte o modül yoksa (EKSİK dosya OLUŞTURULMAZ kuralı) kapı ERR_MODULE_NOT_FOUND ile çöker.
// Çözüm: tazelenecek her BAYAT dosyanın paket-kaynağındaki göreli import/export-from zincirini (statik, `export…from`,
// sabit-string dinamik) özyinelemeli çöz. Hedefte EKSİK bağımlılık → BAĞIMLILIK-YENİ (apply'da oluşturulur + künyeye
// mühürlü girdi). Hedefte VAR ama künyeden bağımsız/fork/drift/farklı → ÜSTÜNE YAZILMAZ, importer da ATLANIR
// (yarım tazeleme = kırık kapı). Hedef yolu = importer'ın hedef dizini + aynı göreli spec (kaynakBul ile aynı eşleme mantığı).
const normYol = (p) => posix.normalize(String(p).split('\\').join('/'));
function gorelilImportlar(abs) {
  let t; try { t = readFileSync(abs, 'utf8'); } catch { return []; }
  if (!/\.(m?js|cjs)$/.test(abs)) return [];
  t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const bul = new Set();
  const re = [
    /\bimport\s+(?:[^'";()]*?\s+from\s+)?['"](\.{1,2}\/[^'"\n]+)['"]/g,
    /\bexport\s+(?:\*|\{[^}]*\})(?:\s+as\s+\w+)?\s+from\s+['"](\.{1,2}\/[^'"\n]+)['"]/g,
    /\bimport\(\s*['"](\.{1,2}\/[^'"\n]+)['"]\s*\)/g,
  ];
  for (const r of re) for (const m of t.matchAll(r)) bul.add(m[1]);
  return [...bul];
}
function kapanisCoz(adim) {
  const dugumler = new Map();                 // hedefRel → { srcAbs, hedefRel }
  const kaynakYok = [];
  const gez = (srcAbs, hedefRel) => {
    for (const spec of gorelilImportlar(srcAbs)) {
      const dSrc = join(dirname(srcAbs), spec);
      const dHedef = posix.join(posix.dirname(normYol(hedefRel)), spec);
      if (dugumler.has(dHedef)) continue;
      if (!existsSync(dSrc) || !statSync(dSrc).isFile()) { kaynakYok.push(spec); continue; }
      dugumler.set(dHedef, { srcAbs: dSrc, hedefRel: dHedef });
      gez(dSrc, dHedef);
    }
  };
  gez(adim.kaynakAbs, adim.path);
  return { dugumler: [...dugumler.values()], kaynakYok };
}
const planAnahtar = new Map(plan.map(x => [normYol(x.path), x]));
const kapanislar = new Map();                 // BAYAT adım → { yeni: [dugum], bayatBagimli: [yol], engel: str|null }
for (const adim of plan.filter(x => x.durum === 'BAYAT')) {
  const { dugumler } = kapanisCoz(adim);
  const k = { yeni: [], bayatBagimli: [], engel: null };
  for (const d of dugumler) {
    if (d.hedefRel.startsWith('..')) { k.engel = `bağımlılık ${d.hedefRel} hedef dizininin DIŞINA çıkıyor`; break; }
    const hedefAbs = join(TARGET, d.hedefRel);
    const var_ = existsSync(hedefAbs) && statSync(hedefAbs).isFile();
    const pe = planAnahtar.get(d.hedefRel);
    if (pe && pe.durum === 'BAYAT') { k.bayatBagimli.push(pe.path); continue; }
    if (pe && pe.durum === 'GÜNCEL') continue;
    if (var_) {
      if (sha256(hedefAbs) === sha256(d.srcAbs)) continue;
      k.engel = `bağımlılık ${d.hedefRel} hedefte VAR ama paketten FARKLI` + (pe ? ` (künyede ${pe.durum}: fork/drift/mühürsüz — üzerine YAZILMAZ)` : ' — KAYITSIZ-FARKLI: künyede kayıtlı değil, yerel yama olabilir; üzerine YAZILMAZ. `node verify.mjs --doctor --fork=' + d.hedefRel + ' --neden="..."` ile fork beyan et (kayıt dışı yama = drift ölçülemez)');
      break;
    }
    if (pe) { k.engel = `bağımlılık ${d.hedefRel} künyede kayıtlı ama hedefte EKSİK (${pe.durum}) — geri koymak "sildi mi, kaza mı" sorusunu ölçmeden cevaplar`; break; }
    k.yeni.push(d);
  }
  kapanislar.set(adim, k);
}
// Engel yayılımı: bağımlı olduğu BAYAT dosya atlandıysa importer da atlanır (yarım tazeleme yok).
for (let degisti = true; degisti;) {
  degisti = false;
  for (const [adim, k] of kapanislar) {
    if (k.engel) continue;
    const bloke = k.bayatBagimli.find(y => kapanislar.get(planAnahtar.get(normYol(y)))?.engel);
    if (bloke) { k.engel = `bağımlılık ${bloke} atlandı (yukarıdaki sebep) — onsuz bu dosyayı tazelemek kapıyı kırar`; degisti = true; }
  }
}
const yeniBag = new Map();                    // hedefRel → plan girdisi
for (const [adim, k] of kapanislar) {
  if (k.engel) { adim.durum = 'ATLANDI-BAĞIMLILIK'; adim.not = `${k.engel}. Tazeleme YARIM kalmasın diye bu dosya atlandı; bağımlılığı elle çöz.`; continue; }
  for (const d of k.yeni) {
    const e = yeniBag.get(d.hedefRel) || { kat: adim.kat, path: d.hedefRel, durum: 'BAĞIMLILIK-YENİ', kaynak: 'bağımlılık-kapanışı',
      kaynakAbs: d.srcAbs, gerekenler: [], not: '' };
    e.gerekenler.push(adim.path);
    e.not = `tazelenen ${e.gerekenler.join(', ')} bunu import ediyor; hedefte YOK → --apply oluşturur + künyeye mühürlü girdi ekler`;
    yeniBag.set(d.hedefRel, e);
  }
}
for (const e of yeniBag.values()) plan.push(e);
const yeniBagGerekenler = new Map([...yeniBag.values()].map(e => [e.path, e.gerekenler]));

// ── ÖN-KAPI 3 (plan HAZIR olduktan sonra): --apply + kirli git ağacı → RED ───────────────────
// Geri-alınabilirlik guard'ı (pack-skill temiz-ağaç guard'ının kardeşi).
// 🔴 KAPSAM DARALTMASI (v0.15 e2e dogfood bulgusu): "ağaçta HERHANGİ bir değişiklik" ölçütü
// KENDİ akışımızı bloke ediyordu — `--doctor --seal` künyeyi yazar, kullanıcı hemen ardından
// `--upgrade --apply` koşar ve mühür commit'lenmediği için REDDEDİLİRDİ (kısır döngü: seal'i
// commit'lemeden yükseltemezsin). Guard'ın KORUDUĞU şey ÜSTÜNE YAZILACAK dosyaların geri
// alınabilirliğidir → yalnız TAZELENECEK dosyaların kirliliği bakılır (künye hariç: o zaten
// bu araçların kendi çıktısı).
if (APPLY && !ALLOW_DIRTY) {
  const g = spawnSync('git', ['-C', TARGET, 'status', '--porcelain'], { encoding: 'utf8' });
  if (g.status === 0) {
    const hedefler = new Set(plan.filter(x => x.durum === 'BAYAT').map(x => x.path));
    const carpisan = (g.stdout || '').split('\n').filter(Boolean)
      .map(l => l.slice(3).replace(/^"|"$/g, '').replace(/\\/g, '/'))
      .filter(p => hedefler.has(p));
    if (carpisan.length)
      die(`tazelenecek ${carpisan.length} dosya commit'lenmemiş değişiklik taşıyor:\n`
        + carpisan.map(p => `    ${p}`).join('\n')
        + '\n  Üstüne yazarsak geri alma yolun (git checkout) belirsizleşir.'
        + '\n  Önce commit/stash et, ya da --allow-dirty.');
  }
}

// ── UYGULA (yalnız --apply + yalnız BAYAT) ────────────────────────────────────────────────────
const yazilan = [];
const yazilamayan = [];
const eskiIcerik = new Map();                 // yol → Buffer | null (geri alma için bellekte yedek)
// Gerçek modül yüklemesi (v0.30 güvenlik ağı): `node --check`/`--help` ERR_MODULE_NOT_FOUND'u yakalamaz. Yalnız
// YÜKLEME-sınıfı hata (ERR_* / SyntaxError) başarısızlıktır; kapının kendi çalışma-zamanı çıkışı (exit 1) DEĞİL.
function yuklemeDene(abs) {
  const kod = "import('node:url').then(u=>import(u.pathToFileURL(process.env.ARS_YUKLE).href)).catch(e=>{"
    + "const k=(e&&e.code)||(e&&e.name)||'';if(/^ERR_/.test(k)||k==='SyntaxError')console.error('ARS_YUKLEME_HATASI '+k+': '+String((e&&e.message)||e).split(String.fromCharCode(10))[0])})";
  const r = spawnSync(process.execPath, ['-e', kod], { cwd: TARGET, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, ARS_YUKLE: abs }, stdio: ['ignore', 'pipe', 'pipe'] });
  const m = (r.stderr || '').match(/ARS_YUKLEME_HATASI (.*)/);
  return m ? m[1] : null;
}
if (APPLY) {
  for (const adim of plan.filter(x => x.durum === 'BAYAT' || x.durum === 'BAĞIMLILIK-YENİ')) {
    const hedefAbs = join(TARGET, adim.path);
    const tmp = `${hedefAbs}.ars-tmp`;
    try {
      eskiIcerik.set(adim.path, existsSync(hedefAbs) ? readFileSync(hedefAbs) : null);
      mkdirSync(dirname(hedefAbs), { recursive: true });
      writeFileSync(tmp, readFileSync(adim.kaynakAbs));   // byte-birebir kopya (EOL'e karışılmaz)
      renameSync(tmp, hedefAbs);                          // atomik yer değiştirme
      yazilan.push(adim.path);
    } catch (e) { yazilamayan.push({ path: adim.path, hata: e.message }); }
  }
  // GÜVENLİK AĞI: yazılan her .mjs/.js GERÇEKTEN yüklenir; başarısızsa yedekten geri alınır (yeni dosya silinir).
  for (let tur = 0; tur <= yazilan.length; tur++) {
    const basarisiz = [];
    for (const p of yazilan) if (/\.(m?js|cjs)$/.test(p)) { const h = yuklemeDene(join(TARGET, p)); if (h) basarisiz.push({ path: p, hata: h }); }
    if (!basarisiz.length) break;
    for (const { path: p, hata } of basarisiz) {
      const eski = eskiIcerik.get(p), abs = join(TARGET, p);
      try { if (eski === null) unlinkSync(abs); else writeFileSync(abs, eski); } catch { /* geri alma hatası aşağıda raporlanır */ }
      yazilan.splice(yazilan.indexOf(p), 1);
      yazilamayan.push({ path: p, hata: `YÜKLEME FAIL (${hata}) — GERİ ALINDI` });
    }
  }
  // Tüm importer'ları geri alınmış YENİ bağımlılık yetim kalmasın (künyeye de girmez).
  const geriAlinan = new Set(yazilamayan.map(y => y.path));
  for (const [yol, gerekenler] of yeniBagGerekenler) {
    if (!yazilan.includes(yol) || !gerekenler.every(x => geriAlinan.has(x))) continue;
    try { unlinkSync(join(TARGET, yol)); yazilan.splice(yazilan.indexOf(yol), 1); } catch { /* yetim kalırsa künyede mühürlü girer; zararsız */ }
  }
  // v0.30.2: tüm girdiler GÜNCEL/BİLGİ ise (yazılacak dosya yok) kök sürüm yine bump edilmeli (portal 0.23.1'de takılmıştı).
  const bumpYalniz = yazilan.length === 0 && yazilamayan.length === 0 && vCmp === 1 && !!pkgVer
    && plan.every(x => x.durum === 'GÜNCEL' || x.durum === 'ATLANDI-FORK' || x.durum.startsWith('BİLGİ'));
  if (yazilan.length || bumpYalniz) {
    // MÜHÜR YENİLE — hash DİSKTEN okunur (kopyaladığın kaynağın hash'i DEĞİL): self-report yasası,
    // "yazdığını varsayma, ölç" (K23-a/B1 yalan-başarı dersinin doğrudan uygulaması).
    const yazilanSet = new Set(yazilan);
    const yenile = (e) => {
      const p = typeof e === 'string' ? e : e.path;
      if (!yazilanSet.has(p)) return e;
      return { ...(typeof e === 'string' ? {} : e), path: p, sha256: sha256(join(TARGET, p)),
               sealed_at: new Date().toISOString().slice(0, 10), skill_version: pkgVer };
    };
    const yeniGirdiler = plan.filter(x => x.durum === 'BAĞIMLILIK-YENİ' && yazilanSet.has(x.path));
    if (Array.isArray(g)) manifest.generic_files = g.map(yenile);
    else for (const kat of Object.keys(kategoriler)) if (Array.isArray(g[kat])) g[kat] = g[kat].map(yenile);
    for (const y of yeniGirdiler) {                       // mevcut mühür/kategori şeması; kategori = importer'ınki
      const girdi = yenile({ path: y.path });
      if (Array.isArray(manifest.generic_files)) manifest.generic_files.push(girdi);
      else { if (!Array.isArray(manifest.generic_files[y.kat])) manifest.generic_files[y.kat] = []; manifest.generic_files[y.kat].push(girdi); }
    }
    manifest.last_upgraded_at = new Date().toISOString();
    // Kök `skill_version` YALNIZ tam yükseltmede bump edilir. Kısmi yükseltmede bump etmek YALAN
    // künye üretirdi (doctor ⑤ "kurulum = paket" derken 3 dosya eski sürümde kalırdı).
    // v0.30.3: ATLANDI-FORK kısmi SAYILMAZ — fork künyede makine yazımıyla BEYAN edilmiş bilinçli sahipliktir
    // (sahada portal'ın repoya-özgü check-hygiene fork'u sürümü 0.23.1'de kilitledi). Fork'a BAĞIMLI olduğu
    // için atlanan dosya (ATLANDI-BAĞIMLILIK) ise gerçekten eski kalır → kısmi sayılmaya devam eder.
    const atlanan = plan.filter(x => (x.durum.startsWith('ATLANDI') && x.durum !== 'ATLANDI-FORK') || x.durum === 'ÖLÇÜLEMEDİ').length;
    const tamYukseltme = atlanan === 0 && yazilamayan.length === 0;
    if (tamYukseltme && pkgVer) manifest.skill_version = pkgVer;
    const mTmp = `${MANIFEST}.ars-tmp`;                    // künye ATOMİK yazılır
    writeFileSync(mTmp, JSON.stringify(manifest, null, 2) + '\n');
    renameSync(mTmp, MANIFEST);
  }
}

// ── RAPOR ─────────────────────────────────────────────────────────────────────────────────────
const say = (d) => plan.filter(x => x.durum === d).length;
const bayat = say('BAYAT');
const bilgiN = plan.filter(x => x.durum.startsWith('BİLGİ')).length;
const ozet = { target: TARGET, source: SOURCE, kurulum_surumu: kunyeVer, paket_surumu: pkgVer,
  gates_contract: { kunye: kunyeContract, kaynak: kaynakContract },
  mod: APPLY ? 'apply' : 'dry-run', plan, bilgi: bilgiN, yeni_adaylar: yeniAdaylar,
  yazilan, yazilamayan, kismi: APPLY && yazilan.length > 0 && (say('ATLANDI-DRIFT') + say('ATLANDI-MÜHÜRSÜZ') + say('ATLANDI-EKSİK') + say('ATLANDI-FORK') + say('ATLANDI-BAĞIMLILIK') + say('ÖLÇÜLEMEDİ') + yazilamayan.length) > 0 };

if (JSON_OUT) console.log(JSON.stringify(ozet, null, 2));
else {
  console.log(`\nupgrade — kurulum yükseltme ${APPLY ? '(UYGULANDI)' : '(DRY-RUN — yazma için --apply)'}\n`);
  console.log(`  hedef : ${TARGET}`);
  console.log(`  kaynak: ${SOURCE}`);
  console.log(`  sürüm : kurulum ${kunyeVer || '?'} → paket ${pkgVer || '?'}` +
    (kunyeContract || kaynakContract ? `  ·  kapı sözleşmesi ${kunyeContract || '?'} → ${kaynakContract || '?'}` : '') + '\n');
  for (const x of plan) {
    console.log(`  ${x.durum.padEnd(17)} ${x.path}${x.kaynak && x.durum !== 'GÜNCEL' ? `   [${x.kaynak}]` : ''}`);
    if (x.not) console.log(`                    ${x.not}`);
  }
  if (yeniAdaylar.length) {
    console.log(`\n  ÖNERİ-YENİ (${yeniAdaylar.length}) — pakette VAR, künyende YOK:`);
    for (const y of yeniAdaylar) console.log(`    ${y}`);
    console.log('    Kurmak KALİBRASYON işidir (GUARDS satırı + negatif kontrol + CONTRACT kaydı),');
    console.log('    dosya kopyalamak değil → SKILL FAZ 2\'yi koş, künyeye ekle, sonra --doctor --seal.');
  }
  if (APPLY) {
    console.log(`\n  ${yazilan.length} dosya tazelendi${yazilamayan.length ? ` · ${yazilamayan.length} YAZILAMADI` : ''}` +
      `${ozet.kismi ? ' (KISMİ yükseltme — kök skill_version künyede BUMP EDİLMEDİ)' : ''}`);
    for (const y of yazilamayan) console.log(`  FAIL ${y.path}: ${y.hata}`);
    if (yazilan.length) console.log('  Doğrula: node verify.mjs --doctor --target=.');
  } else if (bayat) {
    console.log(`\n  ${bayat} dosya BAYAT. Tazelemek için: node verify.mjs --upgrade --apply --target=.`);
  } else {
    console.log('\n  Tazelenecek dosya yok (bayat girdi bulunmadı).');
  }
  console.log();
}

if (yazilamayan.length) process.exit(1);
if (STRICT && !APPLY && bayat) process.exit(1);
process.exit(0);
