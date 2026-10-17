// state-sync testleri — durum RAPORLAYICISI (kapı değil, orkestratör değil).
// SÖZLEŞME:
//   • Durum git'ten TÜRETİLİR, elle yazılmaz. Yazılmayan şey bayatlayamaz.
//   • Kapsam yalnız TÜRETİLEBİLİR kısım. İnsan yargısı taşıyan defterler (karar defteri ·
//     FRICTION_LOG · SIDE-BUGS-LOG) kapsam DIŞI ve silinmez — git'ten hesaplanamazlar.
//   • `--check` kapıya bağlanabilir: bayat durum ya da senkron olmayan sürüm üçlüsü exit 1.
// Testler SAF fonksiyonları hedefler; git çağrısı test edilmez (ortam bağımlı).
import { test } from 'node:test';
import assert from 'node:assert';
import { surumUcluAyikla, bayatlikSinifla } from '../scripts/state-sync.mjs';

// ---------------------------------------------------------------- sürüm üçlüsü (D-A adım ②)
test('surumUcluAyikla: üç kaynak da aynıysa senkron', () => {
  const r = surumUcluAyikla(
    '{"version":"0.20.2"}',
    '# Agentic Repo Setup — 360° Repo Zekâsı (v0.20.2)\nGövde',
    ['agentic-repo-setup-v0.20.1.zip', 'agentic-repo-setup-v0.20.2.zip'],
  );
  assert.deepEqual(r, { paket: '0.20.2', skill: '0.20.2', bundle: '0.20.2', senkron: true });
});

// GERÇEK VAKA: repo bir kez kaynak 0.10.0-alpha iken bundle v0.9.0'da dondu (CLAUDE.md D-A notu).
// Bu test o regresyonu kilitler.
test('surumUcluAyikla: bundle geride kalırsa SENKRON DEĞİL', () => {
  const r = surumUcluAyikla(
    '{"version":"0.20.2"}',
    '# Başlık (v0.20.2)',
    ['agentic-repo-setup-v0.18.5.zip'],
  );
  assert.equal(r.senkron, false);
  assert.equal(r.bundle, '0.18.5');
});

test('surumUcluAyikla: SKILL.md başlığı bump edilmediyse yakalanır', () => {
  const r = surumUcluAyikla('{"version":"0.21.0"}', '# Başlık (v0.20.2)', ['x-v0.21.0.zip']);
  assert.equal(r.senkron, false);
  assert.equal(r.skill, '0.20.2');
});

test('surumUcluAyikla: bundle yoksa boş döner, çökmez', () => {
  const r = surumUcluAyikla('{"version":"0.1.0"}', '# Başlık (v0.1.0)', []);
  assert.equal(r.bundle, '');
  assert.equal(r.senkron, false);
});

test('surumUcluAyikla: bundle sıralaması SAYISAL (0.9 > 0.10 hatası olmamalı)', () => {
  const r = surumUcluAyikla('{"version":"0.10.0"}', '# B (v0.10.0)', ['a-v0.9.0.zip', 'a-v0.10.0.zip']);
  assert.equal(r.bundle, '0.10.0', 'leksikografik sıralama 0.9.0 seçerdi — sayısal olmalı');
});

// ---------------------------------------------------------------- bayatlık sınıfı
// ÖLÇÜLEN VAKA (2026-08-12): docs/STATE.md son güncellemesinden sonra 5 commit geldi ve
// "aktif iş" tablosu commit'lenmiş işleri "bekliyor" diye gösteriyordu. Eşik buradan.
test('bayatlikSinifla: 0 commit = taze, 1-2 = gecikmiş, 3+ = bayat', () => {
  assert.equal(bayatlikSinifla(0), 'taze');
  assert.equal(bayatlikSinifla(1), 'gecikmis');
  assert.equal(bayatlikSinifla(2), 'gecikmis');
  assert.equal(bayatlikSinifla(3), 'bayat');
  assert.equal(bayatlikSinifla(5), 'bayat', 'ölçülen gerçek vaka: 5 commit');
});

// 🔴 KAPI SÖZLEŞMESİ: yalnız 'bayat' commit'i bloke eder. 'gecikmis' bilgi taşır ama bloke ETMEZ —
// aksi halde her commit STATE güncellemesi ister ve model kapıyı geçmek için içeriksiz satır yazar
// (Goodhart tuzağı, panel teşhisinde açıkça uyarıldı).
test('bayatlikSinifla: gecikmiş bloke ETMEZ — Goodhart tuzağı savunması', () => {
  assert.notEqual(bayatlikSinifla(1), 'bayat');
  assert.notEqual(bayatlikSinifla(2), 'bayat');
});
