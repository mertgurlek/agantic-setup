// Künye-sürümüne bağlı sıkılık (v0.30, K81): yeni sıkı --strict bulguları yalnız künyesi >= eşik olan
// repoda FAIL olur; eski künyede aynı bulgu UYARI + yükseltme notu. Kapı DEĞİL — gates/lib/ paylaşılan modül.
// Karar: künye YOK → true (paketin kendisi / künyesiz repo, sıkı davranış) · künye VAR ama skill_version
// okunamıyor/bozuk → false (eski kurulum sayılır; sessiz yeni FAIL dayatılmaz) · aksi hâlde semver >= eşik.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function kunyeSurumuEnAz(target = '.', min = '0.30.0') {
  let k;
  try { k = JSON.parse(readFileSync(join(target, '.agentic-repo-setup.json'), 'utf8')); }
  catch (e) { return e && e.code === 'ENOENT'; }          // dosya yok → true; parse hatası → false
  const t = s => { const m = String(s || '').match(/(\d+)\.(\d+)\.(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
  const cur = t(k && k.skill_version), lim = t(min);
  if (!cur || !lim) return false;
  for (let i = 0; i < 3; i++) if (cur[i] !== lim[i]) return cur[i] > lim[i];
  return true;
}

export const ESKI_KUNYE_NOTU = 'v0.30+ künyede FAIL olur — yükseltince göreceksin (künye skill_version < 0.30.0).';
