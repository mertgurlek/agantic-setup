// STATE.md konumu — TEK yardımcı (v0.30.4; kapı DEĞİL, gates/lib paylaşılan modül). Saha: pilot repoları
// STATE'i docs/agentic/STATE.md'de tutuyor; doctor ⑨ ve process-discipline mode-escalation yalnız kök ile
// docs/ altına bakıyordu. Arama sırası: kök → docs/ → docs/<alt-dizin>/ (bir seviye, alfabetik).
// `archive`, `arsiv` ve `.` ile başlayan dizinler ATLANIR (eski/arşiv STATE güncel durum sayılmaz).
// Birden çok aday varsa KÖK ÖNCELİKLİDİR; çağıran hangisinin seçildiğini raporlamalıdır.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ATLANAN_DIZIN = /^(archive|arsiv|\..*)$/i;

// Var olan tüm STATE.md adaylarını öncelik sırasıyla döndürür (göreli, `/` ayraçlı).
export function stateAdaylari(root = '.') {
  const out = [];
  for (const p of ['STATE.md', 'docs/STATE.md']) if (existsSync(join(root, p))) out.push(p);
  let alt = [];
  try {
    alt = readdirSync(join(root, 'docs')).sort()
      .filter(n => !ATLANAN_DIZIN.test(n))
      .filter(n => { try { return statSync(join(root, 'docs', n)).isDirectory(); } catch { return false; } });
  } catch { /* docs/ yok */ }
  for (const n of alt) { const p = `docs/${n}/STATE.md`; if (existsSync(join(root, p))) out.push(p); }
  return out;
}

// Tek yol gerektiğinde: en öncelikli aday (yoksa null).
export function findStateFile(root = '.') {
  return stateAdaylari(root)[0] ?? null;
}
