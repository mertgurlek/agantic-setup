// jev-karar.mjs testleri (v0.29).
// SÖZLEŞME:
//   • Karar KURAL TABLOSUNDA verilir: Jev yalnız özellik puanlar, model adı seçmez.
//   • Kilitli alan tek yönlüdür: kilit puanı eşiği geçerse sınıf DAİMA claude (zorluk ne olursa olsun).
//   • Fail-open: anahtar yok / ağ hatası / zaman aşımı / şema kayması → öneri yok, çıkış 0, hiçbir şey bloke edilmez.
//   • Süzgeç: gizli değer benzeri ya da engelli yol içeren metin Jev'e HİÇ gönderilmez (kirli girdi → çağrı 0).
// Testler SAF fonksiyonları ve sahte fetch'i hedefler; gerçek ağ çağrısı yapılmaz (ağ + para).
import { test } from 'node:test';
import assert from 'node:assert';
import { kararBaslangic, kararBitis, engelNedeni, hookMetni, calistir, satir, SORULAR } from '../scripts/jev-karar.mjs';

const cevap = (o = {}) => ({
  locked: { noul: 0.05 }, kind: { choice: 'write_code', confidence: 0.9 }, difficulty: { score: 1.1 },
  bump: { noul: 0.1 }, breaking: { noul: 0.1 }, identity: { noul: 0.1 }, dep: { noul: 0.1 }, model: { noul: 0.1 },
  mode: { choice: 'hafif', confidence: 0.9 }, ...o,
});
const sahteFetch = (answers, sayac = { n: 0 }) => async () => { sayac.n++; return { ok: true, json: async () => ({ model: 'jev-test', answers }) }; };
// Varsayılan fetch KASITLI olarak patlar: fetchImpl'siz yazılan bir test gerçek API'ye GİDEMEZ (hakem U3).
const agYasak = async () => { throw new Error('testte gerçek ağ yasak'); };
const kos = async (argv, { env, ...o } = {}) => { const cikti = []; const kod = await calistir(argv, { env: { TYPESAFE_API_KEY: 'k', ...env }, yaz: s => cikti.push(s), fetchImpl: agYasak, ...o }); return { kod, cikti }; };

// ---------------------------------------------------------------- kural tablosu
test('kilitli alan: zorluk yüksek olsa bile sınıf claude', () => {
  assert.equal(kararBaslangic(cevap({ locked: { noul: 0.97 }, difficulty: { score: 3.8 } })).sinif, 'claude');
});

test('zorluk eşiği (2,5) geçilirse guclu; altında iş türü belirler', () => {
  assert.equal(kararBaslangic(cevap({ difficulty: { score: 2.87 } })).sinif, 'guclu');
  assert.equal(kararBaslangic(cevap({ difficulty: { score: 2.4 } })).sinif, 'kod');
});

test('iş türü eşlemesi: explore→kesif · bulk→ucuz · text→varsayilan · bilinmeyen→varsayilan', () => {
  assert.equal(kararBaslangic(cevap({ kind: { choice: 'explore', confidence: 0.9 } })).sinif, 'kesif');
  assert.equal(kararBaslangic(cevap({ kind: { choice: 'bulk', confidence: 0.9 } })).sinif, 'ucuz');
  assert.equal(kararBaslangic(cevap({ kind: { choice: 'text', confidence: 0.9 } })).sinif, 'varsayilan');
  assert.equal(kararBaslangic(cevap({ kind: { choice: 'bilinmeyen', confidence: 0.9 } })).sinif, 'varsayilan');
});

test('süpervizöre sor: bayrak eşiği geçen her neden listelenir', () => {
  const k = kararBaslangic(cevap({ bump: { noul: 0.93 }, dep: { noul: 0.6 } }));
  assert.deepEqual(k.sor.map(s => s.split(' ').slice(0, -1).join(' ')), ['sürüm artışı', 'yeni bağımlılık']);
  assert.deepEqual(kararBaslangic(cevap()).sor, []);
});

test('hafif/tam: emin değilse (güven < 0,3) tam dalga', () => {
  assert.equal(kararBaslangic(cevap({ mode: { choice: 'hafif', confidence: 0.2 } })).mod, 'tam');
  assert.equal(kararBaslangic(cevap({ mode: { choice: 'hafif', confidence: 0.9 } })).mod, 'hafif');
});

test('hafif/tam: süpervizör bayrağı varsa Jev "hafif" dese bile tam dalga', () => {
  // GERÇEK VAKA (doğrulama koşusu 2026-10-01): "SKILL.md'ye otomatik bakım ekle" → mode=hafif, identity bayrağı açık.
  assert.equal(kararBaslangic(cevap({ identity: { noul: 0.7 }, mode: { choice: 'hafif', confidence: 0.8 } })).mod, 'tam');
});

test('argüman: "--" ile başlayan iş tarifi bayrak sanılıp YUTULMAZ', async () => {
  // GERÇEK VAKA (doğrulama koşusu 2026-10-01): "--doctor komutunu … cron ile koşalım" → kullanım mesajı basıldı.
  const sayac = { n: 0 };
  await kos(['baslangic', '--doctor komutunu her gün cron ile koşalım'], { fetchImpl: sahteFetch(cevap(), sayac) });
  assert.equal(sayac.n, 1);
});

test('bitis: hata sınıfı + defter eşiği', () => {
  const k = kararBitis({ hata: { choice: 'baseline', confidence: 0.88 }, defter: { noul: 0.7 } });
  assert.equal(k.hata, 'baseline'); assert.equal(k.defter, true);
  assert.match(satir('bitis', k, 'jev-x'), /hata=baseline .* GEREKİR/);
});

test('çıktı satırı model sürümünü taşır ve "öneridir" der (atıf kuralı)', () => {
  const s = satir('baslangic', kararBaslangic(cevap({ bump: { noul: 0.9 } })), 'jev-1.13.0');
  assert.match(s, /jev-1\.13\.0/); assert.match(s, /süpervizöre sor/); assert.match(s, /öneridir, karar değil/);
});

// ---------------------------------------------------------------- süzgeç (kirli girdi → hiç gönderilmez)
test('süzgeç: gizli değer benzeri metin engellenir ve fetch ÇAĞRILMAZ', async () => {
  const sayac = { n: 0 };
  const gizli = 'api_key = ' + 'Q'.repeat(12); // kaynakta düz secret yok: kapı kaynağı tarar, değer çalışma anında kurulur
  assert.equal(engelNedeni(gizli), 'gizli-deger-benzeri');
  assert.equal(engelNedeni('şu belirteci kullan ' + 'a1B2'.repeat(12)), 'gizli-deger-benzeri');
  const { kod, cikti } = await kos(['baslangic', gizli], { fetchImpl: sahteFetch(cevap(), sayac) });
  assert.equal(kod, 0); assert.equal(sayac.n, 0); assert.match(cikti[0], /öneri yok \(gizli-deger-benzeri\)/);
});

test('süzgeç: JEV_ENGEL_YOLLARI içindeki yol geçen metin gönderilmez', async () => {
  const sayac = { n: 0 };
  const { cikti } = await kos(['baslangic', 'ozel-pilot/plan.md dosyasını özetle'], { env: { JEV_ENGEL_YOLLARI: 'ozel-pilot, baska' }, fetchImpl: sahteFetch(cevap(), sayac) });
  assert.equal(sayac.n, 0); assert.match(cikti[0], /engelli-yol:ozel-pilot/);
});

test('süzgeç: engelli metnin özeti yerel kayda da yazılmaz', async () => {
  const kayitlar = [];
  await kos(['baslangic', 'token: ' + 'Z'.repeat(20)], { fetchImpl: sahteFetch(cevap()), kaydet: k => kayitlar.push(k) });
  assert.equal(kayitlar.length, 1); assert.equal('ozet' in kayitlar[0], false);
});

test('süzgeç: sıradan iş tarifi geçer', () => {
  assert.equal(engelNedeni('README içindeki yazım hatasını düzelt', ['ozel-pilot']), null);
});

// ---------------------------------------------------------------- fail-open
test('fail-open: anahtar yoksa sessiz, çağrı yok, çıkış 0', async () => {
  const sayac = { n: 0 };
  const { kod, cikti } = await kos(['baslangic', 'bir iş'], { env: { TYPESAFE_API_KEY: '' }, fetchImpl: sahteFetch(cevap(), sayac) });
  assert.equal(kod, 0); assert.equal(sayac.n, 0); assert.deepEqual(cikti, []);
});

test('toggle: JEV_KAPALI=1 anahtar olsa bile hiçbir şey yapmaz', async () => {
  const sayac = { n: 0 };
  const { kod, cikti } = await kos(['baslangic', 'bir iş'], { env: { JEV_KAPALI: '1' }, fetchImpl: sahteFetch(cevap(), sayac) });
  assert.equal(kod, 0); assert.equal(sayac.n, 0); assert.deepEqual(cikti, []);
});

test('fail-open: ağ hatası / HTTP hatası / şema kayması → öneri yok, çıkış 0', async () => {
  const hatalar = [
    [async () => { throw new TypeError('fetch failed'); }, /ag-hatasi/],
    [async () => ({ ok: false, status: 503, json: async () => ({}) }), /http-503/],
    [sahteFetch({ locked: { noul: 0.1 } }), /sema-sapmasi:kind/],
  ];
  for (const [f, re] of hatalar) {
    const { kod, cikti } = await kos(['baslangic', 'bir iş'], { fetchImpl: f });
    assert.equal(kod, 0); assert.match(cikti[0], re);
  }
});

test('fail-open: zaman aşımı istek iptal edilir', async () => {
  const yavas = (_u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))));
  const { kod, cikti } = await kos(['baslangic', 'bir iş'], { env: { JEV_TIMEOUT_MS: '20' }, fetchImpl: yavas });
  assert.equal(kod, 0); assert.match(cikti[0], /zaman-asimi/);
});

// ---------------------------------------------------------------- hook modu
test('hook: kısa mesaj, slash-komutu ve bozuk JSON sorulmaz', () => {
  assert.equal(hookMetni(JSON.stringify({ prompt: 'tamam' })), null);
  assert.equal(hookMetni(JSON.stringify({ prompt: '/code-review high ' + 'x'.repeat(50) })), null);
  assert.equal(hookMetni('{bozuk'), null);
  assert.ok(hookMetni(JSON.stringify({ prompt: 'check-hygiene kapısına .env dosyalarını tarayan yeni bir alt-kural ekle' })));
});

test('hook: hata olursa HİÇBİR ŞEY basmaz (bağlama gürültü düşmez), çıkış 0', async () => {
  const stdin = JSON.stringify({ prompt: 'check-hygiene kapısına .env dosyalarını tarayan yeni bir alt-kural ekle' });
  const { kod, cikti } = await kos(['--hook'], { stdin, fetchImpl: async () => { throw new Error('x'); } });
  assert.equal(kod, 0); assert.deepEqual(cikti, []);
});

test('hook: başarıda tek satır öneri basar', async () => {
  const stdin = JSON.stringify({ prompt: 'Sürümü 0.30.0a yükselt ve paketi yayınla, sonra push et lütfen' });
  const { cikti } = await kos(['--hook'], { stdin, fetchImpl: sahteFetch(cevap({ bump: { noul: 0.95 }, mode: { choice: 'tam', confidence: 0.9 } })) });
  assert.equal(cikti.length, 1); assert.match(cikti[0], /tam dalga · ⚠ süpervizöre sor \(sürüm artışı/);
});

test('her mod için gönderilen soru kümesi sabit (sözleşme)', () => {
  assert.deepEqual(Object.keys(SORULAR.baslangic), ['locked', 'kind', 'difficulty', 'bump', 'breaking', 'identity', 'dep', 'model', 'mode']);
  assert.deepEqual(Object.keys(SORULAR.bitis), ['hata', 'defter']);
});

// ---------------------------------------------------------------- şema kayması (hakem B1/U1, 2026-10-01)
test('şema kayması: kilit alanı sayı değilse öneri YOK (kilit sessizce açık sayılmaz)', async () => {
  const kayitlar = [];
  const { kod, cikti } = await kos(['baslangic', 'ödeme modülüne migration yaz'], {
    fetchImpl: sahteFetch(cevap({ locked: { probability: 0.98 } })), kaydet: k => kayitlar.push(k),
  });
  assert.equal(kod, 0); assert.match(cikti[0], /sema-sapmasi:locked/);
  assert.equal(kayitlar[0].atla, 'sema-sapmasi:locked'); assert.equal('karar' in kayitlar[0], false);
});

test('şema kayması: güven alanı yoksa "emin" sayılmaz, öneri YOK', async () => {
  const { cikti } = await kos(['baslangic', 'bir iş'], { fetchImpl: sahteFetch(cevap({ mode: {} })) });
  assert.match(cikti[0], /sema-sapmasi:mode/);
});

test('şema kayması: JSON olmayan gövde → öneri yok, çıkış 0', async () => {
  const { kod, cikti } = await kos(['bitis', 'bir hata'], { fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }) });
  assert.equal(kod, 0); assert.match(cikti[0], /sema-sapmasi:json/);
});

test('fail-open: yaz() bile patlasa calistir 0 döner', async () => {
  const kod = await calistir(['baslangic', 'bir iş'], { env: { TYPESAFE_API_KEY: 'k' }, fetchImpl: sahteFetch(cevap()), yaz: () => { throw new Error('x'); } });
  assert.equal(kod, 0);
});

// ---------------------------------------------------------------- CLI sarmalayıcısı (hakem B2) — çocuk süreç, ağsız
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const SCRIPT = fileURLToPath(new URL('../scripts/jev-karar.mjs', import.meta.url));
const cli = (args, extraEnv, input) => {
  const ev = mkdtempSync(join(tmpdir(), 'jev-'));
  mkdirSync(join(ev, '.claude', '.env'), { recursive: true }); // .env bir DİZİN → okunamaz
  const env = { ...process.env, HOME: ev, USERPROFILE: ev, TYPESAFE_API_KEY: '', JEV_DEFTER: '0', ...extraEnv };
  try { return spawnSync(process.execPath, [SCRIPT, ...args], { env, input, encoding: 'utf8', cwd: ev }); }
  finally { rmSync(ev, { recursive: true, force: true }); }
};

test('CLI: env dosyası okunamasa bile exit 0 ve hook stdout boş', () => {
  const r = cli(['--hook'], {}, JSON.stringify({ prompt: 'check-hygiene kapısına yeni bir alt-kural ekleyelim mi acaba' }));
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
});

test('CLI: JEV_KAPALI=1 → exit 0, çıktı yok (anahtar olsa da)', () => {
  const r = cli(['baslangic', 'bir iş'], { JEV_KAPALI: '1', TYPESAFE_API_KEY: 'k', JEV_TIMEOUT_MS: '10' });
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
});

test('kararBaslangic doğrudan çağrılsa da bozuk girdide öneri üretmez (patlar)', () => {
  assert.throws(() => kararBaslangic(cevap({ locked: { probability: 0.98 } })), /sema-sapmasi:locked/);
});
