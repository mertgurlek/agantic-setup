# Model & Effort Tiering — Rol Maliyet Eksenleri (v0.11)

> SKILL.md FAZ 4'ün ağır gerekçesi buraya taşındı (SKILL.md tavanı ~300 satır; ağır içerik reference'a).
> SKILL.md'deki kısa işaretçi bu dosyaya bakar. Kaynak kararlar: v0.5 K5 (model-tiering) + v0.11 K12 (effort ekseni).

## Mekanizma: rol frontmatter'ı (API gateway DEĞİL)

Tiering, Claude Code'un kendi subagent özelliğidir — rol dosyasının (`.claude/agents/*.md`) YAML
frontmatter'ındaki iki alan. Ayrı bir yönlendirme motoru, gateway veya runtime KURULMAZ.

## İKİ BAĞIMSIZ EKSEN — biri diğerini ikame etmez

| Eksen | Alan | Değerler | Varsayılan | Ne kontrol eder |
|-------|------|----------|------------|-----------------|
| Model | `model:` | `sonnet\|opus\|haiku\|fable\|<tam-id>\|inherit` | `inherit` | HANGİ model |
| Effort | `effort:` | `low\|medium\|high\|xhigh\|max` | oturumdan miras | NE KADAR düşünme |

**Neden iki eksen:** Ölçüm (2026-07-22 telemetrisi) çıktı token'larının **%91,5'inin reasoning**
olduğunu gösterdi. Yani ucuz modele düşmek tek başına yetmez — düşünme derinliği ayrıca ayarlanmalı.
`model:` maliyetin birim fiyatını, `effort:` tüketilen miktarı belirler.
⚠ **YENİDEN ÖLÇÜLMELİ (2026-08-28):** aynı eksen OpenRouter yolunda **%73,4** çıktı
(455 çağrı, `.openrouter-usage.jsonl`). Farklı popülasyon olabilir (o ölçüm Claude yolunu da
içeriyordu) — sayı YANLIŞ demiyoruz, **kalibre edilmemiş** diyoruz. Karar vermeden önce ölç.

## İş-tipine göre rubrik

| İş sınıfı | model | effort | Örnek roller |
|-----------|-------|--------|--------------|
| keşif / sınıflandırma / sorgulama | en ucuz tier | `low` | kasif, pm-sorgu, seed-kasif |
| uygulama / QA / doküman üretimi | orta tier | `medium` | uygulayici(×3), qa-gezgini, dokuman-uretici |
| hakem / mimari-karar / güvenlik-inceleme | pahalı tier | `high` | hakem, seed-hakem, dokuman-hakem, guvenlik-tarama |
| **tamamlanma-beyanı denetimi — MEKANİK yarısı** (`TB-2` assert-gevşetme · `TB-3` mock erken-return · `TB-9` ölçülmemiş kapsam · `TB-10` gösterilmemiş çıktı) | **en ucuz tier** | `low` | — (hakemin ÖNÜNDE koşar) |
| tamamlanma-beyanı denetimi — YARGI yarısı (`TB-4` mod · `TB-5` yokluk · `TB-6` türetilmiş · `TB-7` tek seviye) | pahalı tier | `high` | hakem (bölünmez) |

🔴 **Opus 5 ailesi düzeltmesi (v0.25, ölçüm 2026-08-28):** tablodaki `high`, ortamın
VARSAYILANININ ALTINDA olabilir — `xhigh` Claude Code varsayılanıdır ve kodlama/ajans işleri
için önerilen ayardır. Yani "pahalı tier = high" artık tepeyi göstermiyor: hakem/mimari-karar
için `xhigh`, yalnız doğruluğun maliyetten önemli olduğu dar vakada `max` seç.

Değerler ADIM 0'da ölçülen **ERİŞİLEBİLİR** envanterden gelir — erişilemeyen modele işaret etmek
ölü-referanstır (sessiz kırılma). Öznel "stratejik mi?" tetikleyicileri OTOMATİK ateşlenemez;
onları yazma, eskalasyonu insana bırak.

## "Emin değilsen AT" ARTIK YANLIŞ (v0.11 düzeltme)

Eski talimat "emin değilsen `model:` satırını sil, varsayılan devralınır" diyordu. Bu bir **maliyet
hatası**: satırı atmak "oturum varsayılanını devral" demektir ve varsayılan genelde en PAHALI ayardır
(`opus` + yüksek effort). Telemetri bunu doğruladı: **opus %84 / haiku %0,2** — tiering pratikte
tersine dönmüştü, çünkü 11 rolden 6'sı satırı hiç taşımıyordu.

**Kural:** satır ya GERÇEK değerle doldurulur ya da bilinçli olarak TÜMÜYLE silinir. `<...>` yarım
bırakılırsa `check-hygiene --rule=placeholders` kapısı FAIL verir (v0.11: `COST_AXIS` deseni `model:` ve `effort:`
satırlarını yakalar). Silme hâlâ meşru bir kaçış yoludur — ama artık "varsayılanı seçtim" anlamına
gelen bilinçli bir karardır, tembellik değil.

## `thinking:` YAZMA — ölü-referans

Claude Code'da **rol-başına thinking ayarı YOKTUR.** Belge açık: *"There is no per-subagent thinking
setting."* v2.1.198'den beri subagent ana oturumun extended-thinking ayarını miras alır (öncesinde
tümüyle kapalıydı). Rol dosyasına `thinking:` yazmak sessizce yok sayılır = tam olarak bu paketin
savaştığı ölü-referans hatası. Düşünme derinliğini `effort:` ile ayarla; thinking'i oturum
seviyesinde bırak. Üç eksen istendi; ikisi (model, effort) mekanizmaya bağlanabilir, üçüncüsü
(thinking) bağlanamaz — bağlanamayanı yazmamak dürüstlük gereğidir.

🔴 **Opus 5: thinking KAPATILMAZ, effort DÜŞÜRÜLÜR (v0.25).** Opus 5(te) thinking varsayılan
AÇIKtır (Opus 4.8/4.7(de) değildi). Kapatmanın iki bilinen başarısızlık modu vardır: model araç
çağrısını `tool_use` bloğu yerine GÖRÜNÜR METNE yazabilir (çağrı hiç koşmaz, hata da vermez) ve
`<thinking>` etiketleri cevaba sızabilir. Maliyet düşürmek istiyorsan doğru kol `effort: low|medium`
— thinking(i) kapatmak değil. (Bu bir API davranışıdır, rol dosyası ayarı değil; burada
kayıtlı olmasının nedeni `effort:` seçiminin gerekçesi olması.)

## Denetim mekanizması + cost-ledger

- **Kapı:** `gates/check-hygiene.mjs --rule=placeholders` — `COST_AXIS` regex'i doldurulmamış `model:`/`effort:`
  satırını yakalar (yorum içinde `# model: <...>` olsa bile; isimli-`{{...}}` desenine uymadığı için
  eski kapı görmüyordu). FP koruması: yalnız satırın tamamı `<alan>: <...>` formundaysa yakalar.
- **cost-ledger:** ancak Claude Code telemetrisinden türetilirse kurulur — `scripts/token-audit.mjs`
  deseni (transcript `usage` → `message.id` dedup → compact-boundary kesmesi → model-bazlı fiyat).
  Ajan self-report'u ASLA kanıt sayılmaz (doctrine §v0.6). Çıktı "ölçülen maliyet" değil
  **karşı-olgusal üst sınır** olarak etiketlenir.

## MCP envanteri = maliyet kalemi

Her MCP sunucusu araç şemalarını oturum önekine ekler; önek HER istekte yeniden okunur. Ölçüm:
3 global sunucu → oturum-başı medyan ~34K token, tüm projelerde aynı (yük GLOBAL'den, repodan değil).
Envanteri çıkarırken "bu repoda hangi sunucu gerçekten gerekli?" diye sor: gereksizi repo-kapsamına
(`.mcp.json`) al, kullanılmayanı kaldır. Kullanmayan ödemez.

## Model envanteri (v0.7 — sorma, BAK)

Ortamda erişilebilir model tier'larını (Opus/Sonnet/Haiku) ve dış model/MCP araçlarını (Codex,
DeepSeek, Gemini, yerel LLM) gözlemle. Bu envanter rol dosyalarındaki `model:` satırının
hammaddesidir: erişilemeyen modele işaret eden `model:` = ölü dosya yolu (sessiz kırılma).
Yönlendirme rubriği **1. kalite, 2. maliyet**: ev-içi Claude omurga (Opus = en zor, Sonnet =
aktif ana yük, Haiku = ucuz/toplu), dış model son çare + insan-onaylı (gizli kod sızabilir).
[tasarım] `check-model-truth` kapısı ve rol taslakçısı henüz KOD DEĞİL — bu sürümde envanteri
ÖLÇ ve rolleri ELLE doğru tier'la yaz. Gerekçe: `reference/doctrine.md` "Rol ilkeleri" + v0.7
defteri + v0.11 K12.

## Dış-model çağrı yolu (v0.10 — envanter parçası, sorma BAK)

Bir dış model erişilebilir GÖRÜNÜYORSA çağrı yolunu KANIT'la sabitle (varsayma — yanlış komut
yazmak ölü-referanstır): repoda `scripts/codex-run.mjs` var mı, yoksa global
`~/.claude/scripts/codex-run.mjs` mı, yoksa düz CLI mı (`codex exec`/`gemini`)? GERÇEK yolu
KOŞARAK doğrula (kısa "ping"). Bu yol FAZ 4'te hedef CLAUDE.md'nin dış-model danışma adımına
çağrı-komutu alanı (`CLAUDE.template.md`'deki `DIS_MODEL_CAGRI_KOMUTU`) olarak yazılır. Hiç dış
model yoksa: dış-model akış adımı KURULMAZ (no-op, kullanmayan ödemez).

## Token/context toggle'ı (v0.6 — daima hafif, orta+ projede dosyala)

Her seviyede okuma protokolü ve focus summary kuralı kurulur. ORTA/BÜYÜK seviyede
`templates/context-budget.template.md`'den `docs/CONTEXT_BUDGET.md` kur; tekrar eden iş ailesi
kanıtı varsa `docs/SKILL_CARDS.md` de kur. KÜÇÜK seviyede ayrı dosya yok: CLAUDE.md'ye 3-5 satır
context disiplini yazmak yeter. Ajan self-report token sayısı kanıt sayılmaz; telemetri yoksa
"context hotspot" ve süre ölç.


## Kademe kurmadan ÖNCE: cache ekonomisini ölç (v0.25)

Çok-modelli maliyet kademesi kurmadan önce **daha basit alternatifi ölç: en yetenekli modeli
DAHA DÜŞÜK effort(ta).** Gerekçe iki tane:

1. **Yeni nesil modellerde düşük effort, önceki neslin yüksek effort(unu) yakalayabiliyor** —
   yani kademenin varsaydığı "ucuz model = düşük kalite" takası her zaman geçerli değil.
2. **Cache modele bağlıdır.** Kademe, modeller arası cache tekrarını FEDA eder. Oturum ortasında
   `effort` değiştirmek de mesaj cache(ini) geçersiz kılar.

**ÖLÇÜLDÜ (2026-08-28, `.openrouter-usage.jsonl`, 455 çağrı / 13,6M prompt token):**

| Ölçüm | Değer |
|---|---|
| ayrı model sayısı | **31** |
| hacmin yoğunlaştığı yer | iki modelde **%92** |
| genel cache_read oranı | **%13,7** |
| cache alan çağrı | **50 / 455 (%11)** |
| baskın iki modelin cache oranı | %22,1 ve **%3,1** |

**Okuma:** asıl kayıp 29 modellik kuyrukta DEĞİL — baskın modelin kendisi 5,7M token(da) %3,1
cache alıyor. Yani sorun önce **açık `cache_control` breakpoint yokluğu**, sonra parçalanma.
Kademeyi daraltmak tek başına cache(i) düzeltmez; ikisi ayrı kaldıraçtır ve **cache önce gelir**
(bedava kazanç, breakpoint eklemek kademe değiştirmekten ucuz), kademe sonra (kalite takası).