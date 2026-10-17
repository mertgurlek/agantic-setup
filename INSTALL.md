# `agentic-repo-setup` skill'ini kurma

Bu bir **360° repo zekâsı skill'idir**: çağrıldığı repoyu çok-ajanlı (vibe-coding) geliştirmeye
hazırlar ve kurduğu yapıyı YAŞATIR (kur · kanıtla · güncel tut · yükselt · iyileştir).
Tek dosya değil, bir pakettir (`SKILL.md` + `gates/` + `templates/` + `reference/` + ...).

## Dağıtım biçimleri (kural: her sürüm, iki biçim, sürümlü ad)

`npm run pack:skill` her sürümü **iki biçimde** üretir:
- **`agentic-repo-setup-v<sürüm>.skill`** → Claude.ai / masaüstü app "Upload skill" akışı için.
- **`agentic-repo-setup-v<sürüm>.zip`** → elle açma / Claude Code için (byte-aynı zip, açık uzantı).

(Aşağıdaki örnekler `<sürüm>`; indirdiğin dosyanın sürümüyle değiştir.)

## Kurulum — beş yol (biri yeter)

**★ ÖNERİLEN (Claude Code) — plugin marketplace: kur ve GÜNCEL KAL**

Diğer yollar tek seferlik kopyadır; skill güncellendiğinde elle tekrar kurman gerekir. Plugin yolu
tek komutla güncellenir:

```
/plugin marketplace add mertgurlek/agantic-setup
/plugin install agentic-repo-setup@mertgurlek-tools
```

Güncelleme (yeni sürüm çıktığında):
```
/plugin marketplace update mertgurlek-tools
```

Bu paket **commit-SHA sürümleme** kullanır (`.claude-plugin/plugin.json`'da `version` alanı bilinçle
YOKTUR) → depoya her push, güncelleme olarak akar; ayrı sürüm bump'ı beklemeden en güncel hâli alırsın.
Sürümlü `.skill`/`.zip` bundle'ları **GitHub Releases** sayfasında durur — onlar Claude.ai app'i ve
sabit-sürüm ihtiyacı içindir: https://github.com/mertgurlek/agantic-setup/releases

Ekipçe otomatik yüklemek için (`.claude/settings.json`):
```json
{
  "extraKnownMarketplaces": {
    "mertgurlek-tools": { "source": { "source": "github", "repo": "mertgurlek/agantic-setup" } }
  },
  "enabledPlugins": { "agentic-repo-setup@mertgurlek-tools": true }
}
```

### Erişim

Depo **public**'tir: marketplace'i herkes ekleyip kurabilir, ayrı bir yetki ya da token gerekmez.
Ana depoya değişiklik ise yalnızca pull request ile girer (`CONTRIBUTING.md`).

**0) Claude.ai / masaüstü app:** Releases sayfasından `.skill` dosyasını indir → Settings → Capabilities →
Skills → **Upload skill** → dosyayı seç. Yüklenince "repoyu çok-ajanlı geliştirmeye hazırla" / "set up agentic repo" gibi isteklerde otomatik tetiklenir.

**1) git clone (Claude Code, birincil/çapraz-platform):**
```bash
git clone <bu-repo> ~/.claude/skills/agentic-repo-setup       # kişisel (tüm projeler)
# veya proje-bazlı: git clone <bu-repo> <proje>/.claude/skills/agentic-repo-setup
```

**2) bundle — bash/macOS/Linux:**
```bash
unzip agentic-repo-setup-v<sürüm>.zip -d ~/.claude/skills/      # .skill de aynı zip; ikisi de olur
# → ~/.claude/skills/agentic-repo-setup/SKILL.md oluşturur
```

**3) bundle — Windows PowerShell** (`.zip` biçimi doğrudan açılır):
```powershell
Expand-Archive agentic-repo-setup-v<sürüm>.zip "$HOME\.claude\skills\"
# (yalnız .skill aldıysan önce: Copy-Item x.skill x.zip)
```

Gördüğünü doğrula: `~/.claude/skills/agentic-repo-setup/SKILL.md` var mı?
Paketin kendi kapılarından temiz geçtiğini doğrula: `node verify.mjs` (Node varsa).
> Not: `verify` çıktısındaki tek `ACCEPTANCE UYARI` (`examples/acceptance.json` AC-3) **kasıtlı bir örnektir** —
> `check-provenance --rule=acceptance` kapısının "tamamlanmamış kabul ölçütü → uyarı" davranışını gösterir, hata DEĞİL (exit 0).

## Kullanım

Hazırlamak istediğin repoda Claude Code'u aç:

> `/agentic-repo-setup`   (veya: "bu repoyu çok-ajanlı geliştirmeye hazırla")

Skill önce mini-denetim yapar (ölçer, varsaymaz), boyut/muhatap/dış-entegrasyon toggle'larını
sorar, sonra 5 fazı yürütür: mini-denetim → kapılar → bilgi katmanı → roller/süreç → pilot dalga.

## Dürüstlük sınırı (önce oku)

Bu **olgun bir betadır** — kutudan kusursuz çıkmaz, ilk gerçek repoda kalibre edilerek oturur:

- **Bir AI ajanı gerekir.** Otomatik installer-scripti DEĞİL; ajan ölçer, sana sorular sorar
  (toggle/secret/baseline) ve repoya-ÖZGÜ üretir. Sabit bir script bunu yapamaz.
- **`git` şart** (hook/CI/rollback ona dayanır). **`node`** ise ARAÇTIR, hedef reponun bağımlılığı
  DEĞİL — kapılar Node'suz repoya da kurulur (repoda `package.json` gerekmez) ve makinedeki `node`
  ile koşar. Makinede node yoksa da kurulum yapılır; commit başlatıcısı kapıların koşusunu atlar ve
  bunu her commit'te söyler (D-34, `SKILL.md` ADIM 0).
- **Pilot zorunlu:** FAZ 5 küçük gerçek bir işle kurulumu sınar; "ilk 5-10 dalganı ölç, değer
  üretmeyen parçayı sil" (README).
- **Ne KOD / ne TASARIM (bilinçle):** rol-taslakçısı + model-truth kapısı, DEAK'in Azure/GitLab
  üreteci ve Fibery senkron uzlaştırma kapısı henüz KOD değil, TASARIMdır — kuran ajan bunları
  "kuruldu" diye satmaz, dürüstçe STATE'e yazar. Ayrıntı: `reference/external-integrations.md` §4.
- **Dil:** çekirdek Türkçe. İngilizce-öncelik ayrı bir pass (v1.0 yol haritası).

## Paketi yeniden üretme (bakımcı için)

```
npm run release    # pack:skill (temiz ağaç + öz-doğrulama + testleri koşar) + sağlık taraması
```
`public/` altına sürümlü adla **iki dosya** üretir: `.skill` (app) + `.zip` (elle). Bunlar commit'lenmez;
GitHub Releases'a eklenir (`gh release create v<sürüm> public/*.skill public/*.zip`). Pakete
girmeyen alanların tek kaynağı `.gitattributes`teki `export-ignore` listesidir — bundle kendini içermez.

## Güncelleme

git clone'ladıysan `git pull`; bundle ile kurduysan üstüne yeniden aç. Klasör adını
`agentic-repo-setup` tut ki kurulum yolu sabit kalsın.
