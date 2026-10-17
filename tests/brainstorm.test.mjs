// Beyin fırtınası orkestratörü testleri (v0.19).
// SÖZLEŞME (protokolün iki pilot koşusundan türedi — `reference/coklu-model-beyin-firtinasi.md`):
//   • Aile çeşitliliği KODLA zorlanır: aynı aileden iki panelist = tek panelist (kör noktalar ortak).
//   • DUR kararı ETİKET MATRİSİNİN diff'idir — moderatör yargısı DEĞİL. Matris iki tur aynıysa dur.
//   • Erken tam yakınsama = BRIEF_BOZUK (exit 2) — hata değil BULGU; panel yeniden koşulmaz.
//   • Alıntı kapısı: her iddia ham cevabın substring'i olmalı ("içi boş sentez"i mekanik eler).
// Testler SAF fonksiyonları hedefler; dış model çağrısı test edilmez (ağ + para).
import { test } from 'node:test';
import assert from 'node:assert';
import {
  aileAyikla, ceshitlilikDenetle, etiketleriAyikla,
  matrisAyni, tamYakinsama, eksenleriCikar, alintiDogrula, anonimAd, cevapGecerli,
} from '../scripts/brainstorm.mjs';

// ---------------------------------------------------------------- sessiz düşme avcısı
// GERÇEK VAKA (ilk canlı koşu, 2026-08-06): iki panelist boş döndü, script "(boş yanıt)" yazıp
// devam etti; diğerleri o BOŞ cevaba "tamamen ayrı" etiketi verdi → haritada SAHTE eksen.
// Script "7 panelist" derken gerçekte 5 koşmuştu. Bu testler o regresyonu kilitler.
test('cevapGecerli: dolu cevap GEÇER', () => {
  assert.equal(cevapGecerli('x'.repeat(250)), true);
});

test('cevapGecerli: boş yanıt DÜŞER (sahte eksen üretirdi)', () => {
  assert.equal(cevapGecerli('(boş yanıt)'), false);
  assert.equal(cevapGecerli(''), false);
  assert.equal(cevapGecerli('   \n  '), false);
});

test('cevapGecerli: hata damgası DÜŞER', () => {
  assert.equal(cevapGecerli(`[HATA] model: timeout${'x'.repeat(300)}`), false);
});

test('cevapGecerli: eşik altı kısa cevap DÜŞER (gürültü, cevap değil)', () => {
  assert.equal(cevapGecerli('Katılıyorum.'), false);
});

// ---------------------------------------------------------------- aile çeşitliliği
test('aileAyikla: sağlayıcı önekini alır', () => {
  assert.equal(aileAyikla('z-ai/glm-5.2'), 'z-ai');
  assert.equal(aileAyikla('openai/gpt-5.6-sol-pro'), 'openai');
});

test('çeşitlilik: farklı ailelerden panel TEMİZ', () => {
  const r = ceshitlilikDenetle(['z-ai/glm-5.2', 'google/gemini-3.1-pro-preview', 'x-ai/grok-4.5']);
  assert.equal(r.temiz, true);
  assert.equal(r.aileSayisi, 3);
});

// NEGATİF DENEY — kuralın gerçekten zorlandığını kanıtlar (kapı kayıt şartı).
test('çeşitlilik: aynı aileden iki model ÇAKIŞMA verir', () => {
  const r = ceshitlilikDenetle(['z-ai/glm-5.2', 'z-ai/glm-4.7-flash', 'openai/gpt-5.6-sol-pro']);
  assert.equal(r.temiz, false);
  assert.equal(r.cakisma.length, 1);
  assert.equal(r.cakisma[0].aile, 'z-ai');
});

// ---------------------------------------------------------------- etiket ayıklama
test('etiketleriAyikla: üç etiket türünü de okur', () => {
  const e = etiketleriAyikla(`**POZİSYON** korudum
@ONERI-A: aynıyım
@ONERI-B: kısmen ayrı
@ONERI-C: tamamen ayrı`);
  assert.deepEqual(e, { 'ONERI-A': 'aynıyım', 'ONERI-B': 'kısmen ayrı', 'ONERI-C': 'tamamen ayrı' });
});

test('etiketleriAyikla: etiket yoksa boş döner (cevap geçersiz sinyali)', () => {
  assert.deepEqual(etiketleriAyikla('Hiç etiket yazmadım, uzun uzun anlattım.'), {});
});

// ---------------------------------------------------------------- DUR kararı
test('matrisAyni: özdeş matris → DUR (yeni argüman yok)', () => {
  const a = { X: { Y: 'tamamen ayrı' } };
  const b = { X: { Y: 'tamamen ayrı' } };
  assert.equal(matrisAyni(a, b), true);
});

test('matrisAyni: etiket değiştiyse → DEVAM', () => {
  const a = { X: { Y: 'tamamen ayrı' } };
  const b = { X: { Y: 'kısmen ayrı' } };
  assert.equal(matrisAyni(a, b), false);
});

test('matrisAyni: ilk turda önceki matris yok → DEVAM', () => {
  assert.equal(matrisAyni({ X: { Y: 'aynıyım' } }, null), false);
});

// ---------------------------------------------------------------- BRIEF_BOZUK
test('tamYakinsama: herkes "aynıyım" → brief bozuk sinyali', () => {
  assert.equal(tamYakinsama({ A: { B: 'aynıyım' }, B: { A: 'aynıyım' } }), true);
});

test('tamYakinsama: tek ayrışma varsa yakınsama YOK', () => {
  assert.equal(tamYakinsama({ A: { B: 'aynıyım' }, B: { A: 'kısmen ayrı' } }), false);
});

test('tamYakinsama: boş matris yakınsama SAYILMAZ (etiket gelmemiş)', () => {
  assert.equal(tamYakinsama({}), false);
});

// ---------------------------------------------------------------- eksen çıkarımı
test('eksenleriCikar: "tamamen ayrı" çiftleri oy sırasına dizer', () => {
  const eks = eksenleriCikar({
    A: { B: 'tamamen ayrı', C: 'aynıyım' },
    B: { A: 'tamamen ayrı', C: 'kısmen ayrı' },
    C: { A: 'aynıyım', B: 'kısmen ayrı' },
  });
  assert.equal(eks.length, 1);
  assert.equal(eks[0].cift, 'A ↔ B');
  assert.equal(eks[0].oy, 2); // karşılıklı işaretleme
});

test('eksenleriCikar: sıfır ayrışma → boş liste (danışma boşa gitti)', () => {
  assert.deepEqual(eksenleriCikar({ A: { B: 'aynıyım' }, B: { A: 'aynıyım' } }), []);
});

// ---------------------------------------------------------------- alıntı kapısı
test('alıntı kapısı: ham cevapta geçen alıntı GEÇER', () => {
  const ham = { A: 'Moderatör elemesi bias üretir çünkü eksen tanımını tek ajana verir.' };
  const r = alintiDogrula(['Moderatör elemesi bias üretir'], ham);
  assert.equal(r.temiz, true);
});

// NEGATİF DENEY — "içi boş sentez" senaryosu.
test('alıntı kapısı: uydurulmuş alıntı KALIR (rapora giremez)', () => {
  const ham = { A: 'Moderatör elemesi bias üretir.' };
  const r = alintiDogrula(['Panel oybirliğiyle onayladı'], ham);
  assert.equal(r.temiz, false);
  assert.equal(r.kirik.length, 1);
});

test('alıntı kapısı: satır sonu/boşluk farkı alıntıyı BOZMAZ', () => {
  const ham = { A: 'Moderatör   elemesi\nbias üretir.' };
  assert.equal(alintiDogrula(['Moderatör elemesi bias üretir'], ham).temiz, true);
});

// ---------------------------------------------------------------- anonimleştirme
test('anonimAd: sıra bağımsız sabit etiket üretir (yazar gizli)', () => {
  assert.equal(anonimAd(0), 'ONERI-A');
  assert.equal(anonimAd(2), 'ONERI-C');
});
