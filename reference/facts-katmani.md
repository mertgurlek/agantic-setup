# FACTS katmanı — türetilebilir değer elle yazılmaz (v0.26)

> Ağır gerekçe. SKILL.md FAZ 3 madde 7'nin kaynağı. Kapı sözleşmesi: `CONTRACT.md`
> (`check-doc-integrity:facts-drift`). Şablon: `templates/facts.template.json`.

## Neden var — ÖLÇÜLDÜ (2026-09-06, 7 repoluk saha denetimi)

Beş bağımsız denetim ajanı, skill'in kurulduğu repoları taradı ve iddiaları **komut koşarak**
(`dotnet test`, `vitest`, `tsc`, kapı scriptleri, `git log`) gerçekle karşılaştırdı:

| Repo | İddia | Gerçek | Yayılım |
|---|---|---|---|
| pilot-backend | `baseline.json` **1.240 test** | `dotnet test` → **1.488** (%20) | **11 dosya** |
| pilot-backend | STATE.md L0 makale | **118 / 131 / 140** — üçü de aynı dosyada | 9 dosya, 3 değer |
| pilot-docs | `verify` **0,8 sn** | koşum **8,2 sn** | 3 dosya |
| pilot-mobile | CLAUDE.md **"MobX 2.3.0"** | MobX projede **HİÇ YOK** | yüzlerce commit dokunulmamış |
| saha-H | analiz deseni **%13** | **0** — veri şeması değişti | 8 dosya |

**Kök neden bir cache invalidation arızasıdır.** Kapı = origin, özet tablo = cache, aralarında
write-through yok, ajan yalnız cache'i okur. pilot-backend'de ölçüm katmanı tamamen DOĞRU
çalışıyordu (registry 752/752 · [T] 764 · feature 744 · L0 270 · test-claims 437 — hepsi güncel);
bozuk olan tek şey bu çıktıların elle yazılmış özetlere geri yazılmamasıydı.

**Çelişki, tazelikle çözülemez.** L0 sayısının aynı dosyada 118/131/140 olması zaman-tabanlı
hiçbir mekanizmanın göremeyeceği bir arızadır: üçü de aynı commit'te, üçü de "taze". Yalnız
İDDİA↔ÖLÇÜM karşılaştırması görür.

## İki sınıf — karıştırılırsa katman çöker

| Sınıf | Nedir | Kim yazar | Örnek |
|---|---|---|---|
| `measurements` | koddan/koşudan **türetilir** | **makine** | "şu an 560 test var" |
| `policy` | insan **kararı** (tavan/bütçe/eşik) | **insan** | "SKILL.md 300 satır tavanı" |

Ayrımın testi: *"SKILL.md 300 satır TAVANI"* politikadır (v0.25 K70 kararı);
*"SKILL.md ŞU AN 300 satır"* ölçümdür. Politika sabitini facts'e sokmak, insan kararını
makine ölçümü sanmaktır — katmanın en olası ölüm biçimi budur.

## UNKNOWN ≠ 0 (saha-H dersi)

O repoda bir analiz deseni `%13 → 0` düştü çünkü veri şeması değişmişti ve sistem bunu **sessiz
sıfır** diye okudu. Ölçülemeyen fact asla `0` dönmez — `status: "unknown"` döner ve kapı bunu
"sapma" değil "ölçülemedi" diye AYRI bir NOT bloğunda raporlar (MADDE 15/16'nın "atlanan görünür
olmalı" dersinin tekrarı). Ölçücü patlarsa da unknown; "emin olmadığı sayı" asla yazılmaz.

## Neden yaş değil DELTA

Beş bağımsız dış model (Grok 4.6 · GLM 5.3 · Kimi K3 · GPT-6-Astra · Claude Fable 5.1) ham yaş
enjeksiyonunu (*"bu belge 47 commit önce doğrulandı"*) **reddetti**: yaş zayıf sinyaldir, eski ≠
yanlış — ve yaşı göstermek ajanı eski ama doğru mimari kararı kırpmaya, dünkü deneyi şişirmeye
iter. Delta ise eyleme dönüştürülebilir çelişkidir:

```
iddia 547 · ölçüm 550 (Δ+3)
```

Aynı panelin ikinci ortak reddi: **elle yazılan `gecerlilik:` alanı**. O alan bir sabittir ve
sabitler bayatlar; refactor yolu değiştirdiğinde tripwire *sessizce* ölür — ateşlemeyen alarm ile
ateşleyecek şeyi olmayan alarm dışarıdan aynı görünür. Bu yüzden facts katmanında elle yazılan
tek şey `policy`'dir.

## Kurulum kademesi — tek beden herkese uymaz

Saha ölçümü iki uç gösterdi: **~200 bin satır** doküman (backend) ve **0 satır** (pilot-admin,
yüzlerce dosyalık aktif bir backend reposu). Aynı kurulum ikisine de uymaz.

| Kademe | Hedef | Kurulan | Kazanç |
|---|---|---|---|
| **K0 ENVANTER** | doküman yok/az | manifest'ten türetilenler: bağımlılık, sürüm, test komutu, dosya sayısı | ajan boşluğu **önselinden doldurmaz** (sessizlik çürümesi kapanır); "MobX hayaleti" `deps.mobx = absent` olarak **türetilmiş negatif bilgiye** döner |
| **K1 İŞARETLE** | dokümanı olan repo | K0 + mevcut md'lerdeki ölçüm sayıları fact-işaretlenir | mükerrer iddia tek ölçümden denetlenir |
| **K2 BAĞLA** | olgun repo (kendi kapıları var) | K1 + mevcut kapı çıktıları `measurements`'a beslenir | 1240/1488 sapması **yapısal olarak** kapanır |

**K2'de yeni ölçüm YAZILMAZ** — var olanın çıktısı bağlanır. İkinci bir ölçüm platformu kurmak,
bu katmanın engellemek için var olduğu şeyi (aynı olgunun iki bağımsız kaynağı) üretirdi.

## Dürüst sınırlar

- **Kapı yalnız İŞARETLİ hücreyi görür.** Dokümandaki çıplak "550 test" yazısı görüş alanı
  dışındadır; işaretlemek insan/kurulum işidir. Bu kapı *"işaretleneni taze tutar"*, *"her sayıyı
  bulur"* değildir.
- **Satır-içi kod (`` ` ``) içindeki işaret örnektir, iddia değildir.** Bu kapı kurulduğu gün
  kendi CONTRACT satırındaki dokümantasyon örneğini "kayıtsız iddia" sanıp yanlış-alarm verdi —
  dogfood'un yakaladığı kusur; `tests/check-doc-integrity.test.mjs` regresyon nöbetçisi taşır.
- **Snapshot körlüğü ayrı yerde denetlenir.** Kayıtlı `source_hash` ≠ güncel hash kontrolü
  ölçüm koşucusundadır (`facts:check`), kapıda değil: kapı DOKÜMAN↔facts karşılaştırmasıdır,
  ölçüm koşucusu değil. Kapı bayat **dokümanı**, koşucu bayat **kaydı** yakalar.
- **Bu bir VARLIK/karşılaştırma kapısıdır.** İddianın ölçümle EŞİT olduğunu doğrular; ölçümün
  kendisinin doğru olduğunu değil. Ölçücü yanlış sayıyorsa kapı bunu göremez (E2 — hakem işi).

## Nasıl ölür

| Arıza | Erken uyarı sinyali |
|---|---|
| `facts.json` bayatlar (ölçüm koşmadan commit) | `facts:check` exit 1 sayısı CI'da artıyor |
| Ölçücü sessizce yanlış sayıyor (adaptör çürümesi) | beklenmedik keskin düşüş; parse edilemediği hâlde değer üretilmesi — saha-H'in `%13→0` vakası bunun uyarısıdır |
| Politika sabiti ölçüm sanılır | `policy` bölümüne makine yazması; `measurements`'ta tavan/eşik adı görünmesi |
| İşaret yayılır ama ölçüm eklenmez | "KAYITSIZ İŞARET" not bloğu her koşuda büyüyor |
| Katman bakım yükü olur | elle yazılmış sayısal iddia sayısı sprint başına **düşmüyorsa** — bu durumda üstüne mekanizma eklenmez, **durdurulur** |

Son satır kabul ölçütüdür: bu katman bakım **sayacını düşürmek** için vardır (bir sayı için 11
elle yazılan konum → 0). Sayaç düşmüyorsa katman amacına ulaşmamıştır.
