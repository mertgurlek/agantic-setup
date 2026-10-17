#!/bin/sh
# agentic-repo-setup — git pre-commit başlatıcısı (v0.28)
#
# ÜRETİM TALİMATI: hedefte .git/hooks/pre-commit olarak yazılır (core.hooksPath ayarlıysa oraya).
#   İki yer tutucu, iki blok:
#   (1) YEREL_KOMUTLAR — Node'dan BAĞIMSIZ adımlar (ör. `dotnet format --verify-no-changes`,
#       staged tip kontrolü). Node olsun olmasın HER ZAMAN koşar. Yoksa satırı `:` yap.
#   (2) KAPI_KOMUTLARI — seçilen kapı dizinindeki kapılar, satır başına bir komut. Örnek:
#       node "$ROOT/scripts/gates/check-hygiene.mjs" --rule=secrets
#   ÖNERİLEN KAPI LİSTESİ (v0.30 — kapı dizinine göre yolu uyarla; satır başına bir komut):
#       node "$ROOT/gates/check-self-registry.mjs" --rule=install-version   # warn-only, çıkış DAİMA 0 (skill sürüm hatırlatıcısı)
#       node "$ROOT/gates/check-doc-integrity.mjs" --rule=doc-recency --cascade
#         ^ YALNIZ ADIM 0'da toggles.muhatap.son_kullanici_dokumani = true ise EKLE (kod → [T] → [L0] kademesi).
#           Toggle kapalıysa bu satırı YAZMA (kullanmayan ödemez); açıkken eksikse doküman bayatlığı hook'ta görünmez.
#
# Node PROJENİN değil ARACIN bağımlılığıdır: repoda package.json gerekmez, makinedeki `node` kullanılır
# (.NET/Flutter/Python repoları da kapı alır). Makinede node YOKSA kapılar atlanır, commit ENGELLENMEZ —
# ama atlandığı her commit'te açıkça söylenir (sessiz atlama yok). Gerekçe: reference/doctrine.md D-34.
#
# `set -e`: herhangi bir komut FAIL verirse hook orada durur ve commit engellenir — satır sonuna
# `|| exit 1` yazmayı unutmak kapıyı sessizce yutamaz.
set -e
# git, hook'u çalışma ağacı kökünde koşar → `pwd` yedeği aynı yeri verir.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
# Halka işareti (zararsız): file-size varsayılanı zaten STAGED; elle geniş tarama için `--worktree` (ya da GATES_RING=elle).
export GATES_RING=pre-commit

{{YEREL_KOMUTLAR}}

if ! command -v node >/dev/null 2>&1; then
  echo "[kapı] UYARI: bu makinede 'node' bulunamadı — yerel kapılar ATLANDI, commit engellenmedi." >&2
  echo "       Kapıların koşması için Node.js kur (projeye eklemen gerekmez): https://nodejs.org" >&2
  exit 0
fi

{{KAPI_KOMUTLARI}}
