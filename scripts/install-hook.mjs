#!/usr/bin/env node
// Paketin kendi pre-commit shim'ini kurar (v0.8 dogfood). İdempotent: tekrar koşulabilir.
// Mutlak yol GÖMMEZ — shim repo köküne göre çözer (doctrine: "taşınmış repoda mutlak yol =
// sessiz ölüm"). core.hooksPath'e dokunmaz; klasik .git/hooks/pre-commit yazar.
import { writeFileSync, chmodSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

let gitDir;
try { gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf8' }).trim(); }
catch { console.error('git reposu değil — hook kurulamadı.'); process.exit(1); }

const hooksDir = join(gitDir, 'hooks');
if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });
const hookPath = join(hooksDir, 'pre-commit');

// POSIX sh shim: repo köküne cd eder, versiyonlu script'i koşar. Windows'ta Git Bash bunu koşar.
// v0.28 (D-34): hedef repolara verilen başlatıcıyla (templates/pre-commit-shim.template.sh) AYNI
// düşüş davranışı — makinede node yoksa commit engellenmez ama atlandığı açıkça söylenir.
const shim = `#!/bin/sh
# agentic-repo-setup öz-pre-commit (scripts/install-hook.mjs tarafından kuruldu)
if ! command -v node >/dev/null 2>&1; then
  echo "[kapı] UYARI: bu makinede 'node' bulunamadı — yerel kapılar ATLANDI, commit engellenmedi." >&2
  exit 0
fi
exec node "$(git rev-parse --show-toplevel)/scripts/self-pre-commit.mjs"
`;
writeFileSync(hookPath, shim, 'utf8');
try { chmodSync(hookPath, 0o755); } catch { /* Windows: chmod no-op, sorun değil */ }
console.log(`Pre-commit hook kuruldu: ${hookPath}`);
console.log('Artık her commit\'te paketin kendi kapıları (append-only + secrets + utf8) koşar.');
