# Çoklu-Model Beyin Fırtınası — Karar Öncesi Ayrışma Protokolü

> Bu dosya HEDEF repolarda koşacak bir protokolü TARİF eder (bu repo skill üretir, runtime motoru
> değil — insan çağırır). Kaynak: iki turluk pilot danışma koşusu (2026-08-06), icat edilmedi.
> Kod/orkestratör script'i AYRI bir iştir, burada yazılmaz.

## Ayrım — mevcut dış-model danışmasından FARKLI akış

`reference/faz4-roller-surec.md`'deki dış-model DANIŞMA adımı = hazır planı **eleştirtme**
(plan sonrası, hakem öncesi, AVLAMA modu). Beyin fırtınası = henüz karar yokken **alternatif
üretme** (plan ÖNCESİ). Girdi ve çıktı farklı → ayrı akış, biri diğerini ikame etmez. Mevcut
dış-model adımına DOKUNULMADI.

## Ne zaman çağrılır

Yapısal/geri-alınamaz kararlar: mimari seçim, sözleşme kırılması, kimlik değişikliği. Rutin iş ve
hafif modda ÇAĞIRMA (tören maliyeti — bkz. dış-model danışma ilkeleriyle aynı gerekçe).

**Tetikleme — kendi başına ATEŞLENMEZ:**
1. Kullanıcı açıkça ister.
2. Ajan emin değilse SORAR. "Emin değil" ölçütü: kâşif ≥2 makul alternatif buldu ve kanıtla
   ayıramadı · karar geri-alınamaz · süpervizöre-çıkar maddelerinden birine değiyor.

**`KARARSIZ` bayrağı — tetiği ajanın hissine bırakma.** Kâşif raporunu bitirirken şu soruyu
CEVAPLAMAK ZORUNDA: *"kaç makul alternatif buldum, kanıtla ayırabildim mi?"* Ayıramadıysa rapor
`KARARSIZ` bayrağı taşır; ana ajan bayrağı görünce beyin fırtınası önerir (başlatmaz — SORAR).
Gerekçe: "emin değilim" diyebilmek için önce emin olmadığını FARK ETMEK gerekir ve aşırı-güven
SESSİZDİR. Bayrak, tetiği içsel yargıdan kâşifin yapısal çıktısına taşır — mekanik denetlenebilir.

## Panel kompozisyonu

- 6-7 panelist, her biri **farklı aileden** — ölçüt "farklı sağlayıcı" DEĞİL "farklı aile"; aynı
  ailenin iki modeli tek panelist sayılır (kör noktaları ortak).
  ⚠ **Dış bulgu bu sayıyla ÇELİŞİYOR:** ensemble etkisinin 3-5 üyede en güçlü olduğu bildiriliyor
  (`[web: https://orq.ai/blog/llm-juries-in-practice · yayın tarihi bulunamadı · erişim 2026-08-06]`,
  ⚠ tek-kaynak). 6-7 optimumun üstünde olabilir; ÖLÇÜLMEDİ. Çelişki çözülmedi, çağırana taşınıyor.
- Model ID'leri ASLA koda gömülmez/hafızadan yazılmaz — `openrouter-models.mjs` ile canlı listeden
  çözülür (bu repodaki model-fiyat/ID disiplinin aynısı, bkz. kök CLAUDE.md model erişim tablosu).
- İki katman: `ucuz` (geniş tarama, düşük risk) ve `iyi` (yapısal karar).
- Moderatör kendi ailesini panele koymaz — eleme/sentez biası büyür.

## Akış

1. **Brief.** İKİ kâşif TEK sefer koşar → `brief.md`: `kasif` repo zeminini, `web-kasif` dış
   bulguları çıkarır (bkz. `.claude/agents/web-kasif.md`). Birleştirme ÇAĞIRANIN işidir.
   Dış modellerin repoya ve web'e erişimi YOK; herkes AYNI brief'i alır (girdi eşitliği →
   ayrışma gerçek olsun; ayrıca maliyet + sızıntı kontrolü). **Panelistlere web verilmez:** her
   panelist kendi araştırmasını yaparsa farklı kaynak okur ve ayrışma "farklı bilgi gördükleri
   için" çıkar — bu SAHTE sinyaldir.
   Zorunlu alanlar: SORU (karar formunda) · BAĞLAM · KISITLAR · **DIŞ BULGULAR** · BEKLENEN KAZANÇ
   (başarı ölçütü) · KAPSAM DIŞI · ÇIKTI FORMATI. Format alanında **"EN ZAYIF NOKTA — kendi
   cevabının nerede kırıldığı" ZORUNLU**; boş bırakmak cevabı geçersiz kılar.
   DIŞ BULGULAR bölümü İDDİA taşır, SONUÇ değil; her satır `[web: URL · yayın · erişim]` etiketli.
   Gerekçe: panelin ortak kör noktası bilgi TAZELİĞİDİR — yedi model de eğitim kesimiyle sınırlı ve
   bilmediğini bilmez. Bayat bilgiyle yakınsama, protokolün en tehlikeli çıktısıdır.
2. **Tur 1 — kör.** Herkes bağımsız, kimse kimseyi görmez (anchoring engeli).
3. **Brief kanaryası.** Bir panelist (dönüşümlü) soruyu cevaplamaz, yalnız "bu brief hangi cevabı
   itiyor?" sorusunu cevaplar. Çıktı rapor başlığına işlenir. Gerekçe: pilot koşusunda
   yakınsamanın brief anchor'ı olduğu ÖLÇÜLDÜ (aşağıdaki pilot verisi, koşu 1), protokolde bunu
   yakalayan mekanizma yoktu.
4. **ELEME YOK — etiket matrisi.** Moderatör panelist elemez/seçmez. Tur 2'de her panelist
   diğerlerinin cevaplarını anonim görür ve her birini tek satırla etiketler:
   `aynıyım | kısmen ayrı | tamamen ayrı`. Ayrışma eksenleri bu matristen MEKANİK çıkar (hangi
   çiftler en çok "tamamen ayrı" dedi) — moderatör yorumu gerekmez.
5. **Çapraz eleştiri — sabit şablon, moderatör soru YAZMAZ.** Şablon: *"Diğer pozisyonlar şunlar:
   [...]. Kendi pozisyonunla kıyasla — hangi spesifik noktada itiraz ediyorsun? Fikrini değiştirdin
   mi, gerekçesi ne?"* Moderatörün araya metin yazması YASAK. Moderatör yalnızca brief dışına
   kaymayı brief'e geri çağırır; bu müdahale RAPORDA İŞARETLİ durur.
6. **Dinamik durdurma.** DUR koşulu: etiket matrisi iki tur üst üste AYNI (matris değişmediyse yeni
   argüman zaten yoktur) VEYA 4 tur tavanı doldu. Fikir değişikliği durdurma koşulu DEĞİLDİR —
   yalnız kaydedilir (`korudum | değiştirdim | kısmen`), çünkü kozmetik taviz oyunlanabilir.
   **Erken yakınsama (tek turda) = DUR ve brief bozuk sinyali** — panel yeniden koşulmaz, brief
   revize edilir. (Taslakta "bir tur daha zorla" idi; panelin 4/7'si bağımsız bunu yanlış buldu —
   §Pilot koşu 2: modeller "devam et" komutunu itaatle karşılayıp SAHTE ayrışma uydurur.)
7. **Çıktı = ayrışma haritası, öneri DEĞİL.** Ham cevaplar dokunulmadan saklanır; moderatör yorumu
   AYRI ve İŞARETLİ bölümde. Yakınsama "kanıt" sayılmaz — ortak eğitim biası olabilir, raporda
   böyle etiketlenir.

## Kalite mekanizmaları (dogfood: kural değil MEKANİZMA)

- **Alıntı-bütünlüğü kapısı:** her ayrışma ekseni ve her moderatör yorumu ≥2 farklı panelistten
  VERBATIM alıntı taşımalı; alıntı ham cevabın substring'i olmalı (mekanik doğrulanabilir).
  Geçemeyen bölüm rapora giremez. "Başlıkları doğru ama içi boş" sentezi eler.
- **`DEĞERSİZ` karar formu:** koşu sonrası insan doldurur — (a) haritadan kaç soru karara taşındı
  (b) brief'te olmayan kaç varsayım kırıldı. (a)+(b)=0 ise koşu `DEĞERSİZ` etiketiyle arşivlenir.
  Protokolün KENDİ faydasını zamanla ölçer — bkz. pilot-dersleri.md §2 "ölçünün kendisi de
  oyunlanabilir" ile aynı disiplin, burada koşu-bazlı uygulanmış hali.

## Bilinen zayıflıklar (dürüstlük bölümü)

- Alıntı kapısı tembel moderatörü yakalar, YETKİN biası yakalamaz — gerçek alıntılar seçilip
  bağlam bükülebilir (cherry-picking substring testinden geçer).
- Etiket matrisi, panelistin sycophancy yüzünden yanlış etiket vermesini engellemez ("itiraz etmek
  zahmetli" → "aynıyım").
- Çapraz eleştirinin işlemesi sert anti-sycophancy promptuna bağlı olabilir; yumuşak promptla
  yakınsamaya çökebilir. Test EDİLMEMİŞ iddia — ÖLÇÜLMEDİ.
- Ayrışma haritasının insan kararını gerçekten DEĞİŞTİRDİĞİNE dair veri yok — protokol bir
  iç-rahatlatma ritüeli olabilir. `DEĞERSİZ` formu tam da bunu ölçmek için var.

## Dış bulgular — protokolü besleyen literatür

Aşağıdakiler `web-kasif` çıktısıdır: İDDİA, sonuç değil. Erişim 2026-08-06.

- LLM'lerde anchoring ÖLÇÜLMÜŞ bir olgudur: soruların %22-61'i anchor'lanıyor, akıl yürüten
  modellerde oran en düşük `[web: https://arxiv.org/pdf/2505.15392 · ICLR HCAIR 2026 · 2026-08-06]`.
  → Brief anchor'ı kişisel gözlem değil, beklenen davranış; brief kanaryası bunun için var.
- Klasik Delphi'de ANONİMLİK, en yüksek statülü üyenin grubu anchor'lamasını engellemek içindir
  `[web: https://tesify.app/delphi-method-in-research-consensus-study-step-by-step-2026/ · 2026 ·
  2026-08-06]`. → Etiket matrisinin anonim olması bu geleneğe oturur.
- RAND/UCLA varyantındaki TARTIŞMA öğesi zenginlik katar ama klasik Delphi'nin önlemek için
  tasarlandığı sosyal etki dinamiklerini (otorite gradyanı, belagat etkisi, anchoring) geri sokar
  `[aynı kaynak]`. → Çapraz eleştiri turunun bilinen bedeli; "Tur 2'yi kes" itirazının literatürdeki
  karşılığı. Turu tutuyoruz ama bedeli kayıtlı.

⚠ Bu bulgular tek turluk bir aramadan geldi; sistematik tarama DEĞİL.

## Ölçülmüş pilot verisi

- **Koşu 1 (2026-08-06):** 2 panelist × 2 tur = 4 çağrı, ~$0.30. Bulgu: ana sorudaki yakınsama
  brief anchor'ıydı; gerçek ayrışma "neyi kesmeli"de çıktı ve KAPANMADI.
- **Koşu 2 (2026-08-06):** 7 panelist (7 aile) × 1 tur = 7 çağrı, ~$1.50. Bulgu: 7/7 "şu haliyle
  değmez, şu değişiklikle değer" dedi; 4/7 moderatör elemesini bozuk saydı. Protokol kendi
  kuralıyla Tur 2'ye geçmeden durdu.

## Orkestratör — `scripts/brainstorm.mjs`

```
node scripts/brainstorm.mjs --brief <yol> --panel=<id1>,<id2>,... [--max-tur=4] [--dry-run] [--json]
```

Takdiri KODA çeviren parça (iki pilot koşusunda en kritik kararları moderatör vermişti):

| Protokol kuralı | Kodda karşılığı |
|---|---|
| Aile çeşitliliği | `ceshitlilikDenetle` — aynı aile 2× → exit 1 |
| Moderatör soru yazmaz | sabit çapraz-eleştiri şablonu (`caprazPrompt`) |
| DUR = matris diff | `matrisAyni` — iki tur aynıysa dur; "yeni argüman var mı?" MODELE SORULMAZ |
| Erken yakınsama = brief bozuk | `tamYakinsama` → exit 2 `BRIEF_BOZUK` |
| Eksenler mekanik | `eksenleriCikar` — "tamamen ayrı" oyları sayılır |
| Alıntı-bütünlüğü | `alintiDogrula` — substring testi |
| Ham veri korunur | `runs/<ts>/` (gitignore), harita ayrı dosya |

**İki İNSAN KAPISI:** ① panel + maliyet onayı (para harcanacak) ② `DEĞERSİZ` formu (koşu işe yaradı
mı). Arada müdahale YOK — aradaki her müdahale moderatör biasıdır.

🔴 **Script LLM yorumu YAPMAZ.** Sentez/özet/"hangisi daha iyi" için model çağırmaz. Sentezi modele
yaptırmak, protokolün kaldırdığı biası koda gömerdi. Yorum isteyen insan ham cevapları okur.

Model ID'leri script'e GÖMÜLÜ DEĞİLDİR — `--panel` zorunludur ve ID'ler `openrouter-models.mjs` ile
canlı çözülür (ID uydurma yasağı). Script yalnız AİLE önerisi taşır.

## Sınır — bu dosya TARİF, kapı KODU DEĞİL

Panel kompozisyonu, brief kalitesi, "emin değil misin" yargısı bulanık invariant'lardır — E0'a
inmez (doctrine: bulanık kural disiplinde/moderatörde kalır). Zorlayan mekanizma: alıntı-bütünlüğü
kontrolü (mekanik, substring) + `DEĞERSİZ` karar formu (insan doldurur). Orkestratör script'i ve
bir olası `check-brainstorm-*` kapısı bu sürümde KOD DEĞİL — ayrı bir iştir.
