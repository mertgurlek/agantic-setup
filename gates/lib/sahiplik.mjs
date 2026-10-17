// Dosya sahipliği kaydı — TEK yardımcı (v0.31.0; kapı DEĞİL, gates/lib paylaşılan modül).
// Kullananlar: check-process-discipline --rule=dosya-sahipligi (hook), scripts/sahiplik.mjs (CLI),
// global dış-model sarmalayıcıları (openrouter-run / codex-run, CLI üzerinden).
//
// NEDEN dosya başına AYRI kayıt: tek bir JSON kayıt dosyası paralel yazımda kendisi kayıp-güncelleme
// odağı olur — 2026-10-06 testinde iki ajan aynı sayacı 0'dan okuyup yazdı [ÖLÇÜLDÜ]. Burada her dosyanın
// kaydı ayrı ve `wx` (yoksa oluştur) bayrağıyla açılır: aynı anda iki süreçten YALNIZ biri kazanır.
//
// Konum: <git-common-dir>/ajan-sahiplik/ — commit'e girmez, aynı reponun worktree'leri ortak görür.
// Kimlik: (session_id, agent_id). Ölçüm (2026-10-06, izole `claude -p` probu): alt ajanın PreToolUse
// stdin'i agent_id taşır, session_id ebeveynle aynıdır; Bash çocuklarında yalnız CLAUDE_CODE_SESSION_ID var.
//
// Oturum-içi kural: ana ajan (agent=null) oturumun yöneticisidir — alt ajanının dosyasına yazabilir,
// alt ajan da ana ajanın sahiplendiği dosyaya yazabilir (delegasyon). Çakışma yalnız iki FARKLI alt
// ajan ya da iki FARKLI oturum arasındadır.
//
// DÜRÜST SINIR: TTL devralması en-iyi-çaba'dır (bayat kaydı iki süreç aynı milisaniyede devralmaya
// kalkarsa pencere vardır); taze sahiplik yarışında `wx` garantisi tamdır.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export const VARSAYILAN_TTL_DK = 10; // v0.31: Stop tur sonunda bırakır → TTL yalnız çöküş + uzun turda dosyayla işi bitmiş sahiplik
const DIZIN_ADI = 'ajan-sahiplik';

function git(cwd, ...args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

export function ttlMs() {
  const dk = Number(process.env.SAHIPLIK_TTL_DK);
  return (Number.isFinite(dk) && dk > 0 ? dk : VARSAYILAN_TTL_DK) * 60_000;
}

// cwd'den repo kökü + kayıt dizini. Git reposu değilse null (çağıran no-op yapar).
export function repoBaglami(cwd = process.cwd()) {
  const kok = git(cwd, 'rev-parse', '--show-toplevel');
  const ortak = git(cwd, 'rev-parse', '--git-common-dir');
  if (!kok || !ortak) return null;
  return { kok: resolve(kok), dizin: join(resolve(cwd, ortak), DIZIN_ADI) };
}

// Repo-göreli, `/` ayraçlı yol; repo DIŞI ise null. Anahtar Windows'ta büyük-küçük harf duyarsızdır.
export function normYol(kok, yol) {
  if (!yol) return null;
  const rel = relative(kok, resolve(kok, String(yol)));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
  return rel.split(sep).join('/');
}

function anahtar(rel) {
  const k = process.platform === 'win32' ? rel.toLowerCase() : rel;
  return createHash('sha1').update(k).digest('hex').slice(0, 20) + '.json';
}

function bekle(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// `wx` ile oluşturulan dosya içerik yazılmadan bir an boş görünebilir → kısa yeniden deneme.
function oku(p) {
  for (let i = 0; i < 5; i++) {
    try {
      const raw = readFileSync(p, 'utf8');
      if (raw.trim()) return JSON.parse(raw);
    } catch (e) { if (e.code === 'ENOENT') return null; }
    bekle(10);
  }
  return { bozuk: true };
}

function yazAtomik(p, veri) {
  const gecici = `${p}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(gecici, JSON.stringify(veri));
  renameSync(gecici, p);
}

function ayniSahip(k, session, agent) {
  return k.session === session && (k.agent ?? null) === (agent ?? null);
}

// Bozuk (boş/yarım JSON) kayıt: `wx` oluşturması ile içerik yazımı arasında süreç ölürse kalır. Sahibi
// bilinemez → kalıcı kilit olmasın diye dosya 5 sn'den eskiyse ÇÖP sayılır (hakem bulgusu, 2026-10-08).
// Saat olarak gerçek zaman (mtime) kullanılır, `simdi` değil — bozuk kayıtta yenilendi alanı yoktur.
const BOZUK_SURE_MS = 5000;
function bozukCopMu(p) {
  try { return Date.now() - statSync(p).mtimeMs > BOZUK_SURE_MS; } catch { return true; }
}

export function bayatMi(k, simdi = Date.now()) {
  return !k || k.bozuk || simdi - (k.yenilendi ?? 0) > ttlMs();
}

// Sahipliği al ya da yenile. Dönüş: { durum, kayit, sahip? }
//   alindi · yenilendi · devralindi (bayat kayıt) · oturum-ici (aynı oturum, izinli) · cakisma · kapsam-disi
export function al({ cwd = process.cwd(), yol, session, agent = null, kaynak = 'claude', simdi = Date.now() }) {
  const ctx = repoBaglami(cwd);
  const rel = ctx && normYol(ctx.kok, yol);
  if (!ctx || !rel || !session) return { durum: 'kapsam-disi' };
  mkdirSync(ctx.dizin, { recursive: true });
  const p = join(ctx.dizin, anahtar(rel));
  const yeni = { yol: rel, session, agent: agent ?? null, kaynak, dal: null, alindi: simdi, yenilendi: simdi };

  for (let deneme = 0; deneme < 3; deneme++) {
    try {
      yeni.dal = yeni.dal ?? git(ctx.kok, 'rev-parse', '--abbrev-ref', 'HEAD');
      writeFileSync(p, JSON.stringify(yeni), { flag: 'wx' });
      return { durum: 'alindi', kayit: yeni };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const mevcut = oku(p);
    if (mevcut === null) continue; // arada silindi → yeniden dene
    if (mevcut.bozuk) {
      if (bozukCopMu(p)) { try { unlinkSync(p); } catch { /* başkası sildi */ } continue; }
      return { durum: 'cakisma', kayit: null, sahip: { yol: rel, bozuk: true } }; // şu an yazılıyor olabilir
    }
    if (!mevcut.bozuk && ayniSahip(mevcut, session, agent)) {
      const tazelenmis = { ...mevcut, yenilendi: simdi };
      yazAtomik(p, tazelenmis);
      return { durum: 'yenilendi', kayit: tazelenmis };
    }
    if (!mevcut.bozuk && mevcut.session === session && (mevcut.agent == null || agent == null)) {
      return { durum: 'oturum-ici', kayit: mevcut, sahip: mevcut };
    }
    if (bayatMi(mevcut, simdi) && !mevcut.bozuk) {
      // Bayat kaydı mezara taşı; taşınan gerçekten gördüğümüz bayat kayıt mı, doğrula.
      const mezar = `${p}.mezar-${process.pid}-${randomBytes(4).toString('hex')}`;
      try { renameSync(p, mezar); } catch { continue; }
      const tasinan = oku(mezar);
      if (tasinan && !tasinan.bozuk && tasinan.yenilendi !== mevcut.yenilendi) {
        try { renameSync(mezar, p); } catch { /* başkası yazdı; döngü yeniden değerlendirir */ }
        continue;
      }
      try { unlinkSync(mezar); } catch { /* yoksay */ }
      try {
        writeFileSync(p, JSON.stringify(yeni), { flag: 'wx' });
        return { durum: 'devralindi', kayit: yeni, sahip: mevcut };
      } catch (e) { if (e.code !== 'EEXIST') throw e; continue; }
    }
    return { durum: 'cakisma', kayit: null, sahip: mevcut.bozuk ? { yol: rel, bozuk: true } : mevcut };
  }
  const son = oku(p);
  return { durum: 'cakisma', kayit: null, sahip: son ?? { yol: rel } };
}

// Sahipliği yazmadan sorgula (CLI `kontrol`, dış-model ön kontrolü).
export function sorgula({ cwd = process.cwd(), yol, session, agent = null, simdi = Date.now() }) {
  const ctx = repoBaglami(cwd);
  const rel = ctx && normYol(ctx.kok, yol);
  if (!ctx || !rel) return { durum: 'kapsam-disi' };
  const k = oku(join(ctx.dizin, anahtar(rel)));
  if (!k) return { durum: 'serbest', yol: rel };
  if (k.bozuk) return bozukCopMu(join(ctx.dizin, anahtar(rel)))
    ? { durum: 'bayat', yol: rel, sahip: { yol: rel, bozuk: true } }
    : { durum: 'cakisma', yol: rel, sahip: { yol: rel, bozuk: true } };
  if (ayniSahip(k, session, agent)) return { durum: 'benim', yol: rel, sahip: k };
  if (k.session === session && (k.agent == null || agent == null)) return { durum: 'oturum-ici', yol: rel, sahip: k };
  if (bayatMi(k, simdi)) return { durum: 'bayat', yol: rel, sahip: k };
  return { durum: 'cakisma', yol: rel, sahip: k };
}

// Kayıtları listele (`_` ile başlayan oturum-adı dosyaları hariç).
export function liste({ cwd = process.cwd(), simdi = Date.now() } = {}) {
  const ctx = repoBaglami(cwd);
  if (!ctx || !existsSync(ctx.dizin)) return [];
  return readdirSync(ctx.dizin)
    .filter(n => n.endsWith('.json') && !n.startsWith('_'))
    .map(n => oku(join(ctx.dizin, n)))
    .filter(k => k && !k.bozuk)
    .map(k => ({ ...k, bayat: bayatMi(k, simdi), ad: oturumAdi({ cwd, session: k.session }) }));
}

// Bırak: agent verilirse yalnız o alt ajanın, agent===undefined ise oturumun TÜM kayıtları.
// yollar verilirse yalnız o yollar. Dönüş: silinen kayıt sayısı.
export function birak({ cwd = process.cwd(), session, agent, yollar } = {}) {
  const ctx = repoBaglami(cwd);
  if (!ctx || !session || !existsSync(ctx.dizin)) return 0;
  const hedef = yollar && new Set(yollar.map(y => normYol(ctx.kok, y)).filter(Boolean).map(anahtar));
  let n = 0;
  for (const ad of readdirSync(ctx.dizin)) {
    if (!ad.endsWith('.json') || ad.startsWith('_')) continue;
    if (hedef && !hedef.has(ad)) continue;
    const p = join(ctx.dizin, ad);
    const k = oku(p);
    if (!k || k.bozuk || k.session !== session) continue;
    if (agent !== undefined && (k.agent ?? null) !== (agent ?? null)) continue;
    try { unlinkSync(p); n++; } catch { /* başkası sildi */ }
  }
  if (agent === undefined && !yollar) {
    try { unlinkSync(join(ctx.dizin, `_oturum-${session}.json`)); } catch { /* yok */ }
  }
  return n;
}

// Oturum adı (ListAgents adresi): hook bunu bilemez — session_id mesaj adresi DEĞİL [ÖLÇÜLDÜ];
// etkileşimli ana oturum kendi adını bir kez beyan eder.
export function oturumAdiYaz({ cwd = process.cwd(), session, ad }) {
  const ctx = repoBaglami(cwd);
  if (!ctx || !session || !ad) return false;
  mkdirSync(ctx.dizin, { recursive: true });
  yazAtomik(join(ctx.dizin, `_oturum-${session}.json`), { session, ad: String(ad), t: Date.now() });
  return true;
}

export function oturumAdi({ cwd = process.cwd(), session }) {
  const ctx = repoBaglami(cwd);
  if (!ctx || !session) return null;
  const k = oku(join(ctx.dizin, `_oturum-${session}.json`));
  return k && !k.bozuk ? k.ad : null;
}

// İnsan/ajan okunur sahip tarifi — çakışma mesajlarında tek biçim.
export function sahipTarifi(k, { cwd = process.cwd(), simdi = Date.now() } = {}) {
  if (!k || k.bozuk) return 'sahibi okunamadı (kayıt yazılıyor ya da bozuk)';
  const ad = oturumAdi({ cwd, session: k.session });
  const kim = ad ? `"${ad}" oturumu` : `oturum ${String(k.session).slice(0, 8)} (adı beyan edilmemiş)`;
  const ajan = k.agent ? `, alt ajan ${String(k.agent).slice(0, 28)}` : '';
  const dk = Math.max(0, Math.round((simdi - (k.yenilendi ?? simdi)) / 60_000));
  return `${kim}${ajan} · kaynak ${k.kaynak || 'claude'} · dal ${k.dal || '?'} · son yazma ${dk} dk önce`;
}
