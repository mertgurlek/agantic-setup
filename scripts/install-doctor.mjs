#!/usr/bin/env node
// install-doctor (v0.14 YENİ) — kurulum MAKBUZU mutabakatı: "kurulumdan aylar sonra kapılar
// hâlâ yerinde mi?" (ECC install-state/doctor deseninden uyarlandı — K23).
//
// SORU AYRIMI (install-exam'den farkı): install-exam KURULUM ANINDA "kapı ETKİ ediyor mu"yu
// ölçer; doctor SONRADAN "kurulum makbuza göre hâlâ bütün mü"yü ölçer. İki soru, iki araç —
// tek exit koduna ezilmez. Bu bir KURULUM-YAŞAM-DÖNGÜSÜ aracıdır: hedef repoda daemon/watcher
// KURMAZ, elle/CI'dan çağrılır (kimlik: kurulum süreci, runtime motoru değil).
//
// MAKBUZ = mevcut kurulum künyesi `.agentic-repo-setup.json` (K15) — AYRI dosya AÇILMAZ
// (ikinci envanter = bu paketin savaştığı çift-kaynak hatası). Künye geriye-uyumlu genişler:
// `generic_files` girdisi ya düz yol (eski, kimliksiz) ya `{path, sha256, ...}` (mühürlü).
//
// MÜHÜR (--seal): generic girdilere sha256 kimliğini MAKİNE yazar (self-report enforcement
// yasası: kapı kararını değiştiren alan ajan beyanı OLAMAZ — ya makinece türetilir ya
// bağımsız doğrulanır; bu yüzden hash'i kurulum ajanı değil bu script hesaplar).
//
// ⚠️ DÜRÜST SINIRLAR:
//   • Hash YALNIZ `generic_files` için — `repo_owned_files` YAŞAYAN dokümandır (CLAUDE.md,
//     STATE...), meşru olarak değişir; onu hash'lemek yanlış-alarm fabrikası olur. Owned
//     tarafta yalnız VARLIK denetlenir, içerik ASLA.
//   • Makbuz YOKSA verdict UYGULANAMAZ'dır (FAIL değil): makbuz-öncesi (≤v0.13) kurulumlar
//     suçlanmaz; mühür yolu gösterilir. Makbuz VAR ama BOZUKSA o FAIL'dir (yalan künye).
//   • Drift tespiti "generic dosya elle değişmiş" der; NEDENİNİ bilemez (bilinçli fork mu,
//     kaza mı) — karar insana: ya skill'den tazele ya girdiyi repo_owned'a taşı (fork beyanı).
//
// v0.30 EKLERİ (G4): (T1) toggle üç-durum (null=sorulmadı) UYARI/bilgi · (T5) üç yeni UYARI kontrolü
// (varsayılan dalda mı · STATE bayat mı · doküman toggle'ı açıkken doküman dokunuldu mu) — ESKİ
// kurulumlara yeni FAIL dayatılmaz (konsey ilkesi): bunlar çıkış kodunu DEĞİŞTİRMEZ · (B10a) `--fork`
// makine yazımlı fork beyanı · (B10b) eski künye şemaları OKURKEN normalize (dosya yeniden yazılmaz;
// `--json` çıktısındaki `kunye` alanı upgrade'in da tükettiği TEK normalize görünümdür).
// Kullanım: node scripts/install-doctor.mjs [--target=<dizin>] [--json] [--seal]
//           node scripts/install-doctor.mjs --fork=<generic-yol> --neden="..." [--target=<dizin>]
//   (dispatch: node verify.mjs --doctor [...] — install-exam kalıbının aynısı)
//   Çıkış: herhangi bir kontrol FAIL → 1; ÖLÇÜLEMEDİ/UYGULANAMAZ tek başına düşürmez
//   (install-exam sözleşmesinin aynısı — ölçüm altyapısı eksik ≠ kurulum bozuk).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { findStateFile, stateAdaylari } from '../gates/lib/state-yolu.mjs';
import { YASAM_DONGUSU_ARACLARI } from '../gates/lib/tazelenebilir.mjs';

const argv = process.argv.slice(2);
const TARGET = resolve((argv.find(a => a.startsWith('--target=')) || '--target=.').slice('--target='.length));
const JSON_OUT = argv.includes('--json');
const SEAL = argv.includes('--seal');
const FORK = (argv.find(a => a.startsWith('--fork=')) || '').slice('--fork='.length);
const NEDEN = (argv.find(a => a.startsWith('--neden=')) || '').slice('--neden='.length);
const FORK_MODU = argv.some(a => a.startsWith('--fork='));
const STATE_ESIK = 30;            // T5(b): son dokunuştan beri bu kadar commit'ten fazlası = bayat
const KOD_PENCERE = 30;           // T5(c): bakılan son kod-commit sayısı
const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(TARGET, '.agentic-repo-setup.json');

const results = [];   // { id, name, verdict: 'PASS'|'FAIL'|'ÖLÇÜLEMEDİ'|'UYGULANAMAZ', detail }
// EOL-NORMALİZE hash (v0.14 hakem bulgusu U1): autocrlf'li taze clone metin dosyalarını CRLF'e
// smudge eder — ham-bayt hash'i her satır sonunda SAHTE-drift üretirdi (v0.13.1 bundle-CRLF
// dersinin aynısı, çapraz-makine hâli). Bu yüzden \r\n → \n normalize edilerek hash'lenir.
// BELGELİ SINIR: generic dosyalar (kapı/runner/ci script'leri) METİNDİR varsayımı — ikili
// generic dosya bu şemada beklenmez; eklenirse bu helper genişletilmeli.
const sha256 = (p) => createHash('sha256').update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).digest('hex');

// generic_files hem kategorili obje ({gates:[],runner:[],ci:[]}) hem düz liste olabilir
// (geriye-uyum). Girdi: düz yol (kimliksiz) YA DA {path, sha256} (mühürlü).
function genericEntries(m) {
  const g = m.generic_files;
  const lists = Array.isArray(g) ? { genel: g } : (g && typeof g === 'object' ? g : {});
  const out = [];
  for (const [kat, list] of Object.entries(lists))
    if (Array.isArray(list)) for (const e of list)
      out.push({ kat, path: typeof e === 'string' ? e : e.path, entry: e });
  return out;
}

function loadManifest() {
  if (!existsSync(MANIFEST)) return { missing: true };
  try { return { manifest: JSON.parse(readFileSync(MANIFEST, 'utf8')) }; }
  catch (e) { return { broken: e.message }; }
}

// ── B10b: ESKİ KÜNYE ŞEMALARI — OKURKEN normalize (dosyaya DOKUNMAZ) ─────────────────────────
// Bilinen şemalar: (a) standart (`toggles.muhatap/...`, `generic_files`, `repo_owned_files` — saha-D,
// saha-C, bu şablon) · (b) audience (saha-B: `audience_toggles`, `canonical_gate_directory`;
// generic/owned listeleri YOK). Karşılığı olmayan alan UYDURULMAZ → `olculemeyen`e yazılır.
// Eşleme kaynağı: saha-B künyesi (audience_toggles anahtarları → muhatap toggle adları).
const AUDIENCE_ESLEME = { product_management: 'pm_urun', qa_scenarios: 'qa_senaryo',
  user_facing_docs: 'son_kullanici_dokumani', test_bridge: 'test_koprusu' };
const MUHATAP_ADLARI = ['pm_urun', 'qa_senaryo', 'son_kullanici_dokumani', 'test_koprusu'];
const TAKIP_ADLARI = ['state', 'yan_bug'];
const ucDurum = (v) => (v === true ? true : v === false ? false : null);   // null = sorulmadı/bilinmiyor
const semverOf = (s) => String(s || '').match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1, 4).map(Number) || null;
const surumKucuk = (a, b) => {   // a < b ? (ölçülemezse null)
  const x = semverOf(a), y = semverOf(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
};
function normalizeKunye(m) {
  const olculemeyen = [];
  const audience = !m.toggles && m.audience_toggles && typeof m.audience_toggles === 'object';
  const schema = audience ? 'audience (eski)' : 'standart';
  const muhatap = {};
  for (const k of MUHATAP_ADLARI) muhatap[k] = ucDurum(m.toggles?.muhatap?.[k]);
  if (audience) {
    for (const [eski, yeni] of Object.entries(AUDIENCE_ESLEME)) muhatap[yeni] = ucDurum(m.audience_toggles[eski]);
    for (const k of Object.keys(m.audience_toggles)) if (!AUDIENCE_ESLEME[k]) olculemeyen.push(`audience_toggles.${k} (standart şemada karşılığı yok)`);
  }
  const takip = {};
  for (const k of TAKIP_ADLARI) takip[k] = ucDurum(m.toggles?.takip?.[k]);
  if (audience) olculemeyen.push('toggles.takip.* (eski şemada takip sorusu yok)');
  let generic = null;
  if (m.generic_files !== undefined) generic = genericEntries(m);
  else olculemeyen.push(audience && m.canonical_gate_directory
    ? `generic_files (künyede liste yok; canonical_gate_directory=${m.canonical_gate_directory} yalnız dizin — hangi dosyaların skill kopyası olduğu ÖLÇÜLEMEZ)`
    : 'generic_files (künyede yok)');
  let owned = null;
  if (Array.isArray(m.repo_owned_files)) owned = m.repo_owned_files;
  else olculemeyen.push('repo_owned_files (künyede yok)');
  return { schema, skill_version: m.skill_version ?? null,
    gates_contract_version: m.gates_contract_version != null ? String(m.gates_contract_version) : null,
    toggles: { muhatap, takip }, generic, owned, olculemeyen };
}

// ── B10a: FORK BEYANI (makine yazar) ─────────────────────────────────────────────────────────
// Girdi → {path, sha256: <DİSKTEKİ mevcut>, fork: {neden, tarih, mühür_sha256: <önceki mühür | null>}}.
// `mühür_sha256` skill kopyasının mühürlü hash'idir (fork'un "neyden saptığı"); mühürsüzse null.
if (FORK_MODU) {
  const red = (msg) => { console.error(`Doctor --fork REDDEDİLDİ — ${msg}`); process.exit(1); };
  const { manifest: fm, missing: fMissing, broken: fBroken } = loadManifest();
  if (fMissing) red(`makbuz yok (${MANIFEST}).`);
  if (fBroken) red(`künye parse edilemedi: ${fBroken}`);
  if (!FORK) red('--fork=<yol> boş.');
  if (!NEDEN.trim()) red('--neden="..." zorunlu (boş neden = gerekçesiz fork; fork beyanı bilinçli karar olmalı).');
  const gg = fm.generic_files;
  if (gg === undefined) red('künyede generic_files yok (eski şema) — fork beyan edilecek girdi ölçülemez.');
  const norm = (x) => String(x).split('\\').join('/');
  let bulundu = false;
  const isle = (e) => {
    const p = typeof e === 'string' ? e : e.path;
    if (norm(p) !== norm(FORK)) return e;
    bulundu = true;
    if (typeof e === 'object' && e.fork) red(`${p} zaten fork beyanlı (neden: ${e.fork.neden}). Beyanı elle değiştirme; gerekirse sil + yeniden beyan et.`);
    const abs = join(TARGET, p);
    if (!existsSync(abs)) red(`${p} diskte yok — olmayan dosya fork edilemez.`);
    return { ...(typeof e === 'string' ? {} : e), path: p, sha256: sha256(abs),
      fork: { neden: NEDEN.trim(), tarih: new Date().toISOString().slice(0, 10),
              'mühür_sha256': (typeof e === 'object' && e.sha256) ? e.sha256 : null } };
  };
  if (Array.isArray(gg)) fm.generic_files = gg.map(isle);
  else if (gg && typeof gg === 'object') for (const k of Object.keys(gg)) if (Array.isArray(gg[k])) gg[k] = gg[k].map(isle);
  if (!bulundu) {
    // v0.30.4: künyede KAYITSIZ ama hedefte DURAN dosya (ör. yerelde yamalanmış gates/lib/*) — fork beyanı girdiyi
    // generic'e fork'lu olarak EKLER (mühür_sha256 = null: skill kopyasının mühürlü hash'i yok). Dosya diskte yoksa RED.
    const rel = norm(FORK).replace(/^\.\//, '');
    if (rel.startsWith('..') || /^([a-zA-Z]:|\/)/.test(rel)) red(`${FORK} hedef dizinin dışında.`);
    const abs = join(TARGET, rel);
    if (!existsSync(abs)) red(`${FORK} künyedeki generic girdiler arasında yok VE diskte de yok — olmayan dosya fork edilemez.`);
    const yeni = { path: rel, sha256: sha256(abs),
      fork: { neden: NEDEN.trim(), tarih: new Date().toISOString().slice(0, 10), 'mühür_sha256': null, 'kayıtsızdı': true } };
    if (Array.isArray(fm.generic_files)) fm.generic_files.push(yeni);
    else {
      const anahtar = Array.isArray(fm.generic_files.gates) ? 'gates' : Object.keys(fm.generic_files).find(k => Array.isArray(fm.generic_files[k]));
      if (!anahtar) red('künyede generic_files altında liste yok — girdi eklenecek yer bulunamadı.');
      fm.generic_files[anahtar].push(yeni);
    }
  }
  writeFileSync(MANIFEST, JSON.stringify(fm, null, 2) + '\n');
  console.log(`Doctor --fork OK — ${FORK} fork olarak beyan edildi (drift artık FAIL değil BİLGİ; upgrade bu dosyayı ATLAR).`);
  process.exit(0);
}

// ── MÜHÜR MODU ────────────────────────────────────────────────────────────────
if (SEAL) {
  const { manifest, missing, broken } = loadManifest();
  if (missing) { console.error(`Doctor --seal: makbuz yok (${MANIFEST}). Önce kurulum künyesini yaz (SKILL FAZ 2/5).`); process.exit(1); }
  if (broken) { console.error(`Doctor --seal: künye parse edilemedi: ${broken}`); process.exit(1); }
  const eksik = [];
  let sealed = 0;
  const sealEntry = (e) => {
    const p = typeof e === 'string' ? e : e.path;
    const abs = join(TARGET, p);
    if (!existsSync(abs)) { eksik.push(p); return e; }
    sealed++;
    return { ...(typeof e === 'string' ? {} : e), path: p, sha256: sha256(abs),
             sealed_at: new Date().toISOString().slice(0, 10), skill_version: manifest.skill_version };
  };
  const g = manifest.generic_files;
  // 🔴 WRITE-BACK dikkat (v0.14 hakem bulgusu B1): düz-liste formunda `{genel: g}` sarmalayıcısına
  // yazmak manifest'i GÜNCELLEMEZ — seal "OK" der, künyeye mühür yazılmaz (yalan başarı; ampirik
  // yakalandı). Array ise doğrudan manifest alanına atanır; obje ise g referansı manifest'inkidir.
  if (Array.isArray(g)) manifest.generic_files = g.map(sealEntry);
  else if (g && typeof g === 'object')
    for (const kat of Object.keys(g)) if (Array.isArray(g[kat])) g[kat] = g[kat].map(sealEntry);
  if (eksik.length) {
    console.error(`Doctor --seal FAIL — künyede kayıtlı ${eksik.length} generic dosya diskte YOK:\n`
      + eksik.map(p => `  ${p}`).join('\n') + '\n  Künye yalan söylüyor ya da dosya silinmiş — önce mutabakat sağla.');
    process.exit(1);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Doctor --seal OK — ${sealed} generic girdiye sha256 mührü yazıldı (repo_owned dokunulmadı — yaşayan doküman).`);
  process.exit(0);
}

// ── MUTABAKAT MODU ────────────────────────────────────────────────────────────
let kunyeNorm = null;
const { manifest, missing, broken } = loadManifest();
if (missing) {
  results.push({ id: '①', name: 'makbuz-varlık', verdict: 'UYGULANAMAZ',
    detail: `Makbuz yok (${MANIFEST}) — makbuz-öncesi kurulum olabilir (≤v0.13). Mühürle: node verify.mjs --doctor --seal --target=.` });
} else if (broken) {
  results.push({ id: '①', name: 'makbuz-varlık', verdict: 'FAIL',
    detail: `Künye VAR ama parse edilemiyor: ${broken} — yalan/bozuk künye, elle onar.` });
} else {
  results.push({ id: '①', name: 'makbuz-varlık', verdict: 'PASS', detail: 'künye okundu' });

  // v0.15: bulgular YAPISAL da verilir (`paths[]`). Gerekçe: `upgrade.mjs` bu listeyi TÜKETİR;
  // `detail` metnini parse ettirmek kırılgan olurdu (nesir değişince tüketici sessizce bozulur).
  // JSON'a alan EKLEMEK geriye-uyumludur (mevcut tüketiciler `verdict` okur) → sürüm ARTMAZ.
  const kn = normalizeKunye(manifest);
  kunyeNorm = kn;
  const entries = kn.generic || [];
  const forkEntries = entries.filter(e => typeof e.entry === 'object' && e.entry.fork);
  const forkSet = new Set(forkEntries.map(e => e.path));
  const eksik = entries.filter(e => !existsSync(join(TARGET, e.path)));
  if (kn.generic === null) {
    results.push({ id: '②', name: 'generic-varlık', verdict: 'ÖLÇÜLEMEDİ', paths: [],
      detail: `künyede generic_files listesi yok (şema: ${kn.schema}) — hangi dosyaların skill kopyası olduğu ÖLÇÜLEMEZ. ${kn.olculemeyen.filter(o => o.startsWith('generic_files')).join('; ')}` });
  } else results.push(eksik.length
    ? { id: '②', name: 'generic-varlık', verdict: 'FAIL', paths: eksik.map(e => e.path),
        detail: `${eksik.length} kayıtlı generic dosya diskte YOK: ${eksik.map(e => e.path).join(', ')} — kurulum aşınmış (silinen kapı sessizce korumasızlık demektir).` }
    : { id: '②', name: 'generic-varlık', verdict: 'PASS', paths: [], detail: `${entries.length} generic dosya yerinde` });

  // B10a: fork beyanlı girdi drift/mühür ölçümünün DIŞINDA (bilinçli sapma — ayrı BİLGİ satırı ⑦).
  // v0.30.2: kapı dizini (`gates/`) DIŞINDAKİ generic girdi paketten birebir kopya DEĞİLDİR (şablondan üretilmiş / yerel
  // reçete) → drift ölçümü dışı, ayrı BİLGİ ⑪ (drift FAIL'i meşru değişimi suçlardı). Çözüm: upgrade --sahiplen.
  const kapiAdlari = new Set();   // paketin gates/ ağacındaki dosya adları (hedef kapıyı scripts/ altına kopyalamış olabilir)
  const gezKapi = (dir, d = 0) => { let g; try { g = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const x of g) { if (x.isFile()) kapiAdlari.add(x.name); else if (x.isDirectory() && d < 3) gezKapi(join(dir, x.name), d + 1); } };
  gezKapi(join(PKG_ROOT, 'gates'));
  const kapiDisi = entries.filter(e => { const y = e.path.split('\\').join('/');
    return !forkSet.has(e.path) && !/(^|\/)gates\//.test(y) && !kapiAdlari.has(y.split('/').pop()) && !YASAM_DONGUSU_ARACLARI.includes(y); });
  const kapiDisiSet = new Set(kapiDisi.map(e => e.path));
  const olculen = entries.filter(e => !forkSet.has(e.path) && !kapiDisiSet.has(e.path));
  const hashed = olculen.filter(e => typeof e.entry === 'object' && e.entry.sha256 && existsSync(join(TARGET, e.path)));
  const unsealed = olculen.filter(e => !(typeof e.entry === 'object' && e.entry.sha256)).map(e => e.path);
  if (kn.generic === null) {
    results.push({ id: '③', name: 'generic-drift', verdict: 'ÖLÇÜLEMEDİ', paths: [], unsealed: [], detail: 'generic liste yok — drift ölçülemez' });
  } else if (!hashed.length) {
    results.push({ id: '③', name: 'generic-drift', verdict: 'ÖLÇÜLEMEDİ', paths: [], unsealed,
      detail: forkEntries.length && !unsealed.length ? `ölçülecek mühürlü girdi yok (${forkEntries.length} girdi fork beyanlı — ⑦)`
        : 'künyede sha256 mührü yok (kimliksiz/eski künye) — drift ölçülemez; mühürle: --seal' });
  } else {
    const drift = hashed.filter(e => sha256(join(TARGET, e.path)) !== e.entry.sha256);
    const unhashedN = olculen.length - hashed.length;
    results.push(drift.length
      ? { id: '③', name: 'generic-drift', verdict: 'FAIL', paths: drift.map(e => e.path), unsealed,
          detail: `${drift.length} generic dosya mühürden SAPMIŞ: ${drift.map(e => e.path).join(', ')} — ya skill'den tazele ya da bilinçli fork ise beyan et (node verify.mjs --doctor --fork=<yol> --neden="...") ya da girdiyi repo_owned'a taşı (drift ile yaşayan-doküman aynı şey değildir).` }
      : { id: '③', name: 'generic-drift', verdict: 'PASS', paths: [], unsealed,
          detail: `${hashed.length} mühürlü dosya birebir${unhashedN ? ` (${unhashedN} girdi mühürsüz — ölçüm dışı)` : ''}` });
  }

  const owned = kn.owned;
  const ownedEksik = (owned || []).filter(p => !existsSync(join(TARGET, p)));
  results.push(owned === null
    ? { id: '④', name: 'owned-varlık', verdict: 'ÖLÇÜLEMEDİ', detail: 'künyede repo_owned_files listesi yok — varlık ölçülemez' }
    : ownedEksik.length
    ? { id: '④', name: 'owned-varlık', verdict: 'FAIL',
        detail: `${ownedEksik.length} repo-özgü dosya diskte YOK: ${ownedEksik.join(', ')} (içerik ASLA denetlenmez — yaşayan doküman; yalnız varlık).` }
    : { id: '④', name: 'owned-varlık', verdict: 'PASS', detail: `${owned.length} repo-özgü dosya yerinde (içerik denetlenmez)` });

  let pkgVer = null;
  try { pkgVer = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).version; } catch { /* yok */ }
  results.push(!pkgVer || !manifest.skill_version
    ? { id: '⑤', name: 'sürüm-notu', verdict: 'ÖLÇÜLEMEDİ', detail: 'paket ya da künye sürümü okunamadı' }
    : { id: '⑤', name: 'sürüm-notu', verdict: 'PASS',
        detail: manifest.skill_version === pkgVer ? `kurulum = paket (${pkgVer})`
          : `kurulum ${manifest.skill_version}, paket ${pkgVer} — yükseltme değerlendir (bilgi, hata değil)` });

  // ── v0.30 (G4): YENİ KONTROLLER — hiçbiri FAIL üretmez (eski kurulumlara sessiz FAIL dayatılmaz) ──
  // ⑥ toggle üç-durum: null = SORULMADI (UYARI); eski künyede false = sorulmadan yazılmış OLABİLİR (bilgi).
  const tumToggle = [...MUHATAP_ADLARI.map(k => ['muhatap.' + k, kn.toggles.muhatap[k]]),
                     ...TAKIP_ADLARI.map(k => ['takip.' + k, kn.toggles.takip[k]])];
  const nullAd = tumToggle.filter(([, v]) => v === null).map(([k]) => k);
  const eskiKunye = surumKucuk(manifest.skill_version, '0.30.0') === true;
  const falseMuhatap = tumToggle.filter(([k, v]) => k.startsWith('muhatap.') && v === false).map(([k]) => k);
  const notFalse = eskiKunye && falseMuhatap.length
    ? ` Ayrıca ${falseMuhatap.join(', ')} = false: sorulmadan yazılmış olabilir (v0.30 öncesi şablon false taşıyordu).` : '';
  results.push(nullAd.length
    ? { id: '⑥', name: 'toggle-soruları', verdict: 'UYARI', paths: nullAd,
        detail: `${nullAd.length} toggle SORULMAMIŞ (null): ${nullAd.join(', ')} — "sorulmadı" ≠ "hayır". Ele al: node verify.mjs --upgrade --toggle=<ad>=<true|false>.${notFalse}` }
    : notFalse
    ? { id: '⑥', name: 'toggle-soruları', verdict: 'BİLGİ', paths: falseMuhatap,
        detail: notFalse.trim() }
    : { id: '⑥', name: 'toggle-soruları', verdict: 'PASS', paths: [], detail: 'muhatap/takip toggle\'ları cevaplı (true/false)' });
  if (kn.olculemeyen.length) results.push({ id: '⑥b', name: 'künye-şeması', verdict: 'ÖLÇÜLEMEDİ',
    detail: `şema: ${kn.schema}; ölçülemeyen alanlar: ${kn.olculemeyen.join(' · ')}` });

  if (kapiDisi.length) results.push({ id: '⑪', name: 'generic-sahiplik', verdict: 'BİLGİ', paths: kapiDisi.map(e => e.path),
    detail: `${kapiDisi.length} generic girdi kapı dizini dışında (${kapiDisi.map(e => e.path).join(', ')}) — şablon-üretimi/yerel dosya olabilir (paketten birebir kopya değil); drift ölçülmez, upgrade tazelemez. repo_owned'a taşı: node verify.mjs --upgrade --sahiplen=<yol>[,<yol>]` });

  // ⑦ fork beyanları (BİLGİ)
  if (forkEntries.length) results.push({ id: '⑦', name: 'fork-beyanı', verdict: 'BİLGİ', paths: forkEntries.map(e => e.path),
    detail: forkEntries.map(e => {
      const f = e.entry.fork;
      const sonra = existsSync(join(TARGET, e.path)) && e.entry.sha256 && sha256(join(TARGET, e.path)) !== e.entry.sha256
        ? ' [fork beyanından SONRA da değişmiş]' : '';
      return `${e.path} — fork (${f.tarih}): ${f.neden}${sonra}`;
    }).join(' | ') + ' — drift sayılmaz; upgrade bu dosyayı ATLAR (skill\'deki güncel sürümle elle karşılaştır).' });

  // ── git tabanlı T5 kontrolleri ──
  const git = (a) => spawnSync('git', ['-C', TARGET, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const gitVar = git(['rev-parse', '--git-dir']).status === 0;
  const gitYok = (id, name) => results.push({ id, name, verdict: 'ÖLÇÜLEMEDİ', detail: 'hedef bir git reposu değil — ölçülemez' });

  // ⑧ kurulum varsayılan dalda mı (pilot-web/backend vakası: kurulum yalnız bir feature dalında kaldı)
  if (!gitVar) gitYok('⑧', 'varsayılan-dalda');
  else {
    let dal = null;
    const sr = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
    const adaylar = [];
    if (sr.status === 0 && sr.stdout.trim()) adaylar.push(sr.stdout.trim());
    for (const b of ['main', 'master', 'dev']) adaylar.push(`origin/${b}`, b);
    for (const ref of adaylar) if (git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status === 0) { dal = ref; break; }
    if (!dal) results.push({ id: '⑧', name: 'varsayılan-dalda', verdict: 'ÖLÇÜLEMEDİ',
      detail: 'varsayılan dal çözülemedi (origin/HEAD yok; main/master/dev yok) — remote/dal yok' });
    else {
      const bakilacak = ['.agentic-repo-setup.json', ...entries.map(e => e.path.split('\\').join('/'))];
      const yok = bakilacak.filter(p => git(['cat-file', '-e', `${dal}:${p}`]).status !== 0);
      results.push(yok.length
        ? { id: '⑧', name: 'varsayılan-dalda', verdict: 'UYARI', paths: yok,
            detail: `kurulum yalnız bu dalda — ekip ana dalda görmüyor: ${yok.length}/${bakilacak.length} kurulum dosyası ${dal} içinde YOK (${yok.slice(0, 5).join(', ')}${yok.length > 5 ? ', …' : ''}).` }
        : { id: '⑧', name: 'varsayılan-dalda', verdict: 'PASS', paths: [], detail: `${bakilacak.length} kurulum dosyası ${dal} içinde var` });
    }
  }

  // ⑨ STATE bayat mı
  const stateYol = findStateFile(TARGET);   // kök → docs/ → docs/<alt>/ (v0.30.4)
  const stateEtkin = kn.toggles.takip.state === true || !!stateYol;
  if (!stateEtkin) results.push({ id: '⑨', name: 'STATE-tazelik', verdict: 'UYGULANAMAZ', detail: 'STATE etkin değil (takip.state ≠ true ve STATE.md yok)' });
  else if (!stateYol) results.push({ id: '⑨', name: 'STATE-tazelik', verdict: 'UYARI', detail: 'takip.state = true ama STATE.md (kök, docs/, docs/<alt>/) diskte YOK' });
  else if (!gitVar) gitYok('⑨', 'STATE-tazelik');
  else {
    const son = git(['log', '-1', '--format=%H', '--', stateYol]).stdout.trim();
    if (!son) results.push({ id: '⑨', name: 'STATE-tazelik', verdict: 'ÖLÇÜLEMEDİ', detail: `${stateYol} git geçmişinde yok (izlenmiyor) — son dokunuş ölçülemez` });
    else {
      const n = Number(git(['rev-list', '--count', `${son}..HEAD`]).stdout.trim());
      results.push(n > STATE_ESIK
        ? { id: '⑨', name: 'STATE-tazelik', verdict: 'UYARI', detail: `STATE bayat (${n} commit) — ${stateYol} son dokunuştan beri ${n} commit (eşik ${STATE_ESIK}).` }
        : { id: '⑨', name: 'STATE-tazelik', verdict: 'PASS', detail: `${stateYol} son dokunuştan beri ${n} commit (eşik ${STATE_ESIK})` });
    }
  }

  {
    const adaylar = stateAdaylari(TARGET), son9 = results[results.length - 1];
    if (adaylar.length > 1 && son9 && son9.id === '⑨') son9.detail += ' [birden çok STATE adayı: ' + adaylar.join(', ') + ' — seçilen (kök öncelikli): ' + stateYol + ']';
  }

  // ⑩ doküman toggle'ı açıkken son kod commit'lerinde doküman dokunuldu mu
  if (kn.toggles.muhatap.son_kullanici_dokumani !== true)
    results.push({ id: '⑩', name: 'doküman-dokunuşu', verdict: 'UYGULANAMAZ', detail: 'muhatap.son_kullanici_dokumani true değil' });
  else if (!gitVar) gitYok('⑩', 'doküman-dokunuşu');
  else {
    const KOD = /\.(m?[jt]sx?|cjs|py|cs|go|rs|java|kt|rb|php|dart|swift|vue|svelte)$/i;
    const TEST = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z]+$/i;
    const DOK = /(^|\/)docs\/(tech|user)\/|\[(T|L0)\]/;
    const lg = git(['log', '--no-merges', '--max-count=3000', '--name-only', '--format=@@%H']);
    const kodCommit = [];
    for (const blok of lg.stdout.split('@@').slice(1)) {
      const dosyalar = blok.split('\n').slice(1).map(x => x.trim()).filter(Boolean);
      const kod = dosyalar.filter(f => KOD.test(f) && !/^docs\//.test(f) && !TEST.test(f));
      if (kod.length) kodCommit.push({ dokunuldu: dosyalar.some(f => DOK.test(f)) });
      if (kodCommit.length >= KOD_PENCERE) break;
    }
    const k = kodCommit.filter(c => c.dokunuldu).length;
    results.push(!kodCommit.length
      ? { id: '⑩', name: 'doküman-dokunuşu', verdict: 'ÖLÇÜLEMEDİ', detail: 'geçmişte kod-uzantılı commit bulunamadı' }
      : k === 0
      ? { id: '⑩', name: 'doküman-dokunuşu', verdict: 'UYARI',
          detail: `son ${kodCommit.length} kod commit'inin 0'ında docs/tech|docs/user|[T]/[L0] dokunulmuş — doküman toggle'ı AÇIK ama doküman kodla birlikte hareket etmiyor.` }
      : { id: '⑩', name: 'doküman-dokunuşu', verdict: 'PASS', detail: `son ${kodCommit.length} kod commit'inin ${k}'inde doküman dokunulmuş` });
  }
}

const hardFails = results.filter(r => r.verdict === 'FAIL');
const uyarilar = results.filter(r => r.verdict === 'UYARI');
if (JSON_OUT) {
  const kunye = kunyeNorm && { schema: kunyeNorm.schema, skill_version: kunyeNorm.skill_version,
    gates_contract_version: kunyeNorm.gates_contract_version, toggles: kunyeNorm.toggles,
    generic: kunyeNorm.generic && kunyeNorm.generic.map(e => ({ kat: e.kat, path: e.path, fork: !!(typeof e.entry === 'object' && e.entry.fork) })),
    owned: kunyeNorm.owned, olculemeyen: kunyeNorm.olculemeyen };
  console.log(JSON.stringify({ target: TARGET, results, kunye }, null, 2));
} else {
  console.log(`install-doctor — kurulum makbuzu mutabakatı (${TARGET})\n`);
  for (const r of results) console.log(`  ${r.verdict.padEnd(11)} ${r.id} ${r.name}\n              ${r.detail}`);
  console.log(hardFails.length
    ? `\nDOCTOR FAIL — ${hardFails.length} kontrol düştü. Kurulum makbuzla MUTABIK DEĞİL.`
    : `\nDOCTOR OK — makbuzla mutabakat tam (ölçülemeyenler varsa dürüstçe yukarıda).${uyarilar.length ? ` ${uyarilar.length} UYARI var (çıkış kodunu etkilemez).` : ''}`);
}
process.exit(hardFails.length ? 1 : 0);
