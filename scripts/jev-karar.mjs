#!/usr/bin/env node
// jev-karar.mjs — OPSİYONEL dış karar yardımcısı (v0.29). Varsayılan KAPALI: anahtar yoksa hiçbir şey yapmaz.
//
// NE YAPAR: iş tarifini TypeSafe Jev'e (System One model — metin üretmez, tipli cevap + olasılık döner)
// sorar ve TEK SATIR ÖNERİ basar. Jev yalnız ÖZELLİK puanlar (kilitli alan mı, iş türü, zorluk, sürüm
// artışı mı…); ÖNERİYİ bu dosyadaki sabit KURAL TABLOSU verir. Jev hiçbir model adı seçmez.
//
// KİMLİK — KAPI DEĞİL, DANIŞMANDIR: hiçbir şeyi bloke etmez, her hatada SESSİZ düşer (fail-open,
// çıkış kodu daima 0). gates/, verify.mjs ve pre-commit'e BAĞLANMAZ — kapılar ağsız ve deterministik
// kalır. Gerekçe + ölçüm: `reference/external-integrations.md` §8 · karar defteri K80.
//
// Kullanım:
//   node scripts/jev-karar.mjs baslangic "<iş tarifi>"   → yönlendirme · süpervizöre-sor · hafif/tam
//   node scripts/jev-karar.mjs bitis "<hata/değişiklik özeti>" → hata sınıfı · karar defteri gerekir mi
//   node scripts/jev-karar.mjs --hook                     → UserPromptSubmit hook'u: stdin JSON {prompt}
//   ek bayrak: --json (ham cevap + karar)
//
// Ortam: JEV_KAPALI=1 (tamamen kapatır) · TYPESAFE_API_KEY (~/.claude/.env veya repo .env.local) · JEV_TIMEOUT_MS (vars. 3000) ·
//   JEV_ENGEL_YOLLARI (virgüllü; metinde geçerse Jev'e HİÇ gönderilmez, ör. özel pilot dizinleri) ·
//   JEV_DEFTER (kayıt dosyası; vars. ~/.claude/jev-defter/kararlar.jsonl, "0" = kayıt yok).
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

// ---------------------------------------------------------------- sorular (etiketlere bakılmadan, kuraldan yazıldı)
const noul = (instructions) => ({ type: 'noul', instructions });
export const SORULAR = {
  baslangic: {
    locked: noul('Does this task touch billing/payments, authentication, AI prompts, database migrations, or require an architectural decision?'),
    kind: { type: 'choice', instructions: 'What kind of work is this?', criteria: {
      explore: 'Read-only: find, list, summarize existing code.', write_code: 'Write or modify code files in the repo.',
      text: 'Produce text/ideas/drafts, no repo edits.', bulk: 'Mechanical transformation of many items.' } },
    difficulty: { type: 'score', instructions: 'How hard is the reasoning required?', criteria: ['trivial', 'routine', 'moderate', 'hard', 'very hard'] },
    bump: noul('Does this task bump the package version (SemVer) or cut a release?'),
    breaking: noul('Does it make a backward-INCOMPATIBLE change to the CLI/contract (arguments, exit codes)? Adding a new opt-in, backward-compatible check or flag is NOT incompatible.'),
    identity: noul('Does it widen the tool identity, e.g. make it a runtime engine/daemon that runs by itself?'),
    dep: noul('Does it add a new external package dependency (npm/pip install etc.)? Using built-in modules is NOT a new dependency.'),
    model: noul('Does it change which AI model or reasoning effort an agent uses?'),
    mode: { type: 'choice', instructions: 'Classify this task. Single file + behaviour unchanged → light; check/gate behaviour, CLI contract, runner, version/release, identity, packaging boundary, thresholds → full. If unsure → full.',
      criteria: { hafif: 'Light: one file, wording/typo/log line, no behaviour change.', tam: 'Full wave: behaviour, contract, runner, release, identity, packaging, thresholds.' } },
  },
  bitis: {
    hata: { type: 'choice', instructions: 'Classify this failure for the exit report.', criteria: {
      baseline: 'Already existed before my change (same failure on the unchanged tree).', benim: 'Caused by my own change.',
      ortam: 'Environment: machine, network, permissions, tool/runtime version.', flaky: 'Intermittent: passes on re-run, nondeterministic.',
      engel: 'Blocked: waiting on an external dependency or a human decision; cannot proceed.',
      'sistem-kurali': "Friction created by the system's OWN rule or gate (e.g. a gate blocked legitimate work)." } },
    defter: { type: 'noul', instructions: 'Is this change a STRUCTURAL decision that must be recorded in the decision log?', criteria: {
      true: 'Changes how the system works: new rule, gate behaviour, architecture, process, policy, choosing/rejecting an approach.',
      false: 'Routine: typo, wording, adding a test, refreshing a stale number, moving a file with no policy change.' } },
  },
};

// ---------------------------------------------------------------- kural tablosu (KARARI bu verir, Jev değil)
// Sınıf adları geneldir; hangi modele karşılık geldiğini kurulan ortamın rehberi söyler.
export const ESIK = { kilit: 0.5, bayrak: 0.5, zor: 2.5, istipiGuven: 0.3 };
const SOR_NEDEN = { bump: 'sürüm artışı', breaking: 'uyumsuz sözleşme', identity: 'kimlik genişlemesi', dep: 'yeni bağımlılık', model: 'model/effort değişimi' };

export function kararBaslangic(a) {
  // Dışa açık: biçimi bozuk girdide güvensiz öneri üretmek yerine PATLAR (çağıran fail-open yakalar).
  const bozuk = semaHatasi('baslangic', a); if (bozuk) throw new Error(`sema-sapmasi:${bozuk}`);
  // 🔴 Tek yönlü güvenlik: kilitli alan → DAİMA claude. "Kilitli değil" demesi dışarı verilebilir demek DEĞİL.
  const kilitli = a.locked.noul >= ESIK.kilit;
  const sinif = kilitli ? 'claude'
    : a.difficulty.score >= ESIK.zor ? 'guclu'
    : ({ explore: 'kesif', bulk: 'ucuz', write_code: 'kod', text: 'varsayilan' })[a.kind.choice] ?? 'varsayilan';
  const sor = Object.keys(SOR_NEDEN).filter(k => a[k].noul >= ESIK.bayrak).map(k => `${SOR_NEDEN[k]} ${a[k].noul.toFixed(2).replace('.', ',')}`);
  // emin değilse ya da süpervizör bayrağı varsa tam dalga (sürüm/kimlik/sözleşme işi tanım gereği tam dalgadır)
  const mod = (a.mode.confidence ?? 1) < ESIK.istipiGuven || sor.length ? 'tam' : a.mode.choice;
  return { sinif, mod, sor, kilit: a.locked.noul, zorluk: a.difficulty.score, tur: a.kind.choice };
}

export function kararBitis(a) {
  const bozuk = semaHatasi('bitis', a); if (bozuk) throw new Error(`sema-sapmasi:${bozuk}`);
  return { hata: a.hata.choice, hataGuven: a.hata.confidence, defter: a.defter.noul >= ESIK.bayrak, defterP: a.defter.noul };
}

export function satir(mod, k, surum) {
  const f = x => x.toFixed(2).replace('.', ',');
  if (mod === 'baslangic') {
    const sor = k.sor.length ? ` · ⚠ süpervizöre sor (${k.sor.join(', ')})` : '';
    return `Jev önerisi (${surum}): ${k.sinif} · ${k.mod === 'tam' ? 'tam dalga' : 'hafif mod'}${sor} [kilit ${f(k.kilit)} · tür ${k.tur} · zorluk ${f(k.zorluk)}] — öneridir, karar değil`;
  }
  return `Jev önerisi (${surum}): hata=${k.hata} (${f(k.hataGuven)}) · karar defteri: ${k.defter ? 'GEREKİR' : 'gerekmez'} (${f(k.defterP)}) — öneridir, karar değil`;
}

// ---------------------------------------------------------------- göndermeden önce süzgeç
// Genel desenler (kasıtlı olarak kaba): gizli değer atanmış satır, özel anahtar bloğu, uzun rastgele belirteç.
const GIZLI = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(pass(word)?|secret|token|api[_-]?key|access[_-]?key)\b\s*[=:]\s*\S{8,}/i,
  /\b[A-Za-z0-9_\-]{40,}\b/, // uzun belirteç (anahtar/sha/jwt) — yanlış-pozitif kabul: göndermemek güvenli taraf
];
export function engelNedeni(metin, engelYollari = []) {
  if (GIZLI.some(r => r.test(metin))) return 'gizli-deger-benzeri';
  const yol = engelYollari.find(y => y && metin.includes(y));
  return yol ? `engelli-yol:${yol}` : null;
}

// ---------------------------------------------------------------- çağrı (fail-open)
export async function sor(metin, mod, { key, fetchImpl = fetch, timeoutMs = 3000 } = {}) {
  if (!key) return { atla: 'anahtar-yok' };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetchImpl(ENDPOINT, {
      method: 'POST', signal: ac.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'jev-latest', state: metin, questions: SORULAR[mod] }),
    });
    if (!r.ok) return { atla: `http-${r.status}` };
    let j;
    try { j = await r.json(); } catch { return { atla: 'sema-sapmasi:json' }; }
    const bozuk = semaHatasi(mod, j?.answers);
    if (bozuk) return { atla: `sema-sapmasi:${bozuk}` };
    const karar = mod === 'baslangic' ? kararBaslangic(j.answers) : kararBitis(j.answers);
    return { karar, surum: j.model ?? '?', ham: j };
  } catch (e) {
    return { atla: e.name === 'AbortError' ? 'zaman-asimi' : 'ag-hatasi' };
  } finally { clearTimeout(t); }
}

// Cevap biçimi DOĞRULANMADAN karar verilmez. GERÇEK BULGU (hakem, 2026-10-01): `locked: {probability: 0.98}`
// gibi kaymış bir cevapta `undefined >= 0.5` yanlış → kilit sessizce AÇIK sayılıyordu (migration → "kod").
// Kural: her beklenen alan sayı/metin değilse öneri YOK — şema kayması güvensiz öneriye değil sessizliğe düşer.
export function semaHatasi(mod, answers) {
  const sayi = x => typeof x === 'number' && Number.isFinite(x);
  for (const [q, tanim] of Object.entries(SORULAR[mod])) {
    const a = answers?.[q];
    if (!a || typeof a !== 'object') return q;
    if (tanim.type === 'noul' && !sayi(a.noul)) return q;
    if (tanim.type === 'score' && !sayi(a.score)) return q;
    if (tanim.type === 'choice' && (typeof a.choice !== 'string' || !sayi(a.confidence))) return q;
  }
  return null;
}

// Hook girdisi: kısa mesaj ve slash-komutu sorulmaz (yönlendirilecek bir iş yok).
export function hookMetni(stdin) {
  let p = '';
  try { p = String(JSON.parse(stdin).prompt ?? ''); } catch { return null; }
  p = p.trim();
  return p.length < 40 || p.startsWith('/') ? null : p;
}

// Dışa açık giriş noktası da kendi başına fail-open'dır: içerideki HİÇBİR hata çıkış kodunu 0'dan saptırmaz.
export async function calistir(argv, o = {}) {
  try { return await calistirIc(argv, o); } catch { return 0; }
}

async function calistirIc(argv, { env = process.env, stdin = '', fetchImpl, yaz = s => process.stdout.write(s + '\n'), kaydet } = {}) {
  const hook = argv.includes('--hook');
  const json = argv.includes('--json');
  const poz = argv.filter(a => a !== '--hook' && a !== '--json'); // yalnız BİLİNEN bayraklar: "--doctor …" ile başlayan iş tarifi metindir
  const mod = hook ? 'baslangic' : poz[0];
  const metin = hook ? hookMetni(stdin) : poz.slice(1).join(' ').trim();
  if (env.JEV_KAPALI === '1') return 0; // toggle: tek değişkenle tamamen kapanır
  if (!SORULAR[mod] || !metin) {
    if (!hook) yaz('kullanım: jev-karar.mjs baslangic|bitis "<metin>"  |  --hook');
    return 0;
  }
  const engel = engelNedeni(metin, (env.JEV_ENGEL_YOLLARI ?? '').split(',').map(s => s.trim()));
  const s = engel ? { atla: engel } : await sor(metin, mod, { key: env.TYPESAFE_API_KEY, fetchImpl, timeoutMs: Number(env.JEV_TIMEOUT_MS || 3000) });
  // Çıktı satırı ÖNCE kurulur, kayıt SONRA yazılır: satır kurulamazsa kayda "başarılı karar" düşmez.
  let cikti = null;
  if (!s.atla) {
    try { cikti = json ? JSON.stringify({ karar: s.karar, surum: s.surum, cevaplar: s.ham.answers }) : satir(mod, s.karar, s.surum); }
    catch { s.atla = 'sema-sapmasi:satir'; }
  }
  // engelli metnin özeti yerel kayda da YAZILMAZ (gizli değer diske düşmesin)
  try { kaydet?.({ ts: new Date().toISOString(), mod, hook, uzunluk: metin.length, ...(engel ? {} : { ozet: metin.slice(0, 120) }), ...(s.atla ? { atla: s.atla } : { karar: s.karar, surum: s.surum }) }); } catch { /* kayıt fail-open */ }
  if (s.atla) { if (!hook && s.atla !== 'anahtar-yok') yaz(`Jev: öneri yok (${s.atla})`); return 0; }
  yaz(cikti);
  return 0;
}

// ---------------------------------------------------------------- CLI
function envYukle() {
  for (const p of [join(homedir(), '.claude', '.env'), resolve(process.cwd(), '.env.local')]) {
    let icerik;
    try { if (!existsSync(p)) continue; icerik = readFileSync(p, 'utf8'); } catch { continue; } // okunamayan env dosyası = yok
    for (const line of icerik.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
function defterYazici() {
  const yol = process.env.JEV_DEFTER || join(homedir(), '.claude', 'jev-defter', 'kararlar.jsonl');
  if (yol === '0') return undefined;
  return kayit => { try { mkdirSync(dirname(yol), { recursive: true }); appendFileSync(yol, JSON.stringify({ cwd: process.cwd(), ...kayit }) + '\n'); } catch { /* kayıt da fail-open */ } };
}

// GERÇEK BULGU (hakem, 2026-10-01): env dosyası okunamayınca (ör. dizin) CLI exit 1 ile ölüyordu ve
// JEV_KAPALI=1 bile kurtarmıyordu. Artık kapatma anahtarı her şeyden ÖNCE bakılır, tüm gövde try içindedir.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = 0;
  try {
    if (process.env.JEV_KAPALI !== '1') {
      envYukle();
      const argv = process.argv.slice(2);
      const stdin = argv.includes('--hook') ? await new Promise(res => { let d = ''; process.stdin.on('data', c => (d += c)); process.stdin.on('end', () => res(d)); process.stdin.on('error', () => res('')); }) : '';
      await calistir(argv, { stdin, kaydet: defterYazici() });
    }
  } catch { /* fail-open: çıkış 0 */ }
}
