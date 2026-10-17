# Tasarım dili ve akış sözleşmesi — DESIGN.md + flows/screens + walking skeleton

> Kaynak: dış araştırma (web + 9 model ailesi: Gemini, GPT-5.5/5.5-pro, Grok-4.5, DeepSeek-v4-pro,
> Kimi-k3, Qwen3-max-thinking, GLM-5.1) + bu reponun kendi kod/dosya durumunun ölçülmesi
> (2026-07-28). Zorlayıcı: `gates/check-self-registry.mjs --rule=design-tokens` (Kademe 1) · `templates/DESIGN.template.md` ·
> `templates/docs-flows.template.md` + `templates/docs-screens.template.md` · SKILL.md FAZ1/FAZ3/FAZ5.
> Kural → mekanizman yoksa yazma.

## Kök teşhis

Backend **doğrulanabilir uzayda** yaşar (test geçer/geçmez). UI **istatistiksel taklit
uzayındadır** — model "güzel"i bilmez, eğitim korpusunda "modern" ile en sık geçen CSS kalıbını
(indigo-500 gradient, `rounded-xl`+`shadow-lg`) tekrar eder. Bu bir zevk kararı değil, bir
**frekans** kararı. Bu paketin kapıları (v0.15'te 19, bu dosyayla 20) hepsi metin-tabanlı;
hiçbiri "nasıl görünmeli"ye dokunmuyordu. Mevcut `profile: ui` alanı (`templates/
T-teknik-dokuman.template.md`) yalnız NAVİGASYON doğruluğu için (`ui_exits`→404 yakalama) —
görsel kaliteyle hiç ilgisi yok.

## Sorumluluk üçlüsü — karıştırılırsa iki ajan iki alanı birbirine karıştırır

| Katman | Neyi cevaplar | Yaşadığı yer |
|---|---|---|
| `CLAUDE.md` | "Nasıl kodlanır" (mimari, süreç) | kök |
| `DESIGN.md` | "Nasıl görünür" (statik token sözleşmesi, repo-geneli) | kök, `[T]`'den bağımsız |
| `profile: ui` ([T] içi) | "Bu TEK ekran nereye gider" (navigasyon, kod-anchor'lı) | `[T]` şeması içinde |
| docs/flows.md + docs/screens.md (hedef repoda, `templates/docs-flows.template.md`'den üretilir) | "Hangi akış hangi ekrandan geçiyor" (yapısal envanter) | kök docs/ |

## Var olan tasarım dili — tespit (≥2 sinyal eşiği)

9 model bağımsız aynı eşiğe vardı: tek sinyal (yalnız Tailwind kurulu, tema özelleştirilmemiş)
"sadece araç var, dil yok" sayılır; **en az 2-3 bağımsız sinyal** tutarlıysa "dil MEVCUT":
tailwind.config/theme uzantısı · CSS custom properties (`:root { --primary, --radius }`) ·
components/ui/ envanteri · package.json'da shadcn/Radix/MUI · Figma/Storybook linki ·
mevcut ekran görüntüleri. `kasif.md`'nin "sabit verme yasağı" ilkesiyle aynı kökten: iskelet
(nereye bakılacağı) ver, değer (renk kodu) verme — değeri ajan koddan okur.

## Dil yok senaryosu — insan onayı zorunlu

Otomatik varsayılan **kurulmaz**. Zorunlu checkpoint: *"Referans marka/stil var mı (Stripe/
Linear/Vercel)? Yoksa nötr shadcn/ui teması mı?"* Cevap yoksa nötr varsayılan kurulur ama
DESIGN.md'ye **"VARSAYILAN_ONAYSIZ"** durumuyla YAZILMAZ — süpervizöre çıkar (bkz.
`templates/DESIGN.template.md` "Durum" alanı). Gerekçe: insan onayı almamış varsayılan,
"AI slop"un insan-onaylı versiyonu değil, aynısıdır.

## Kademeli kapı zinciri, sınır ihlal edilmeden

| Kademe | Bu pakette | Ne yakalar / yakalamaz |
|---|---|---|
| 0 — Sözleşme varlığı | `check-self-registry --rule=design-tokens` (DESIGN.md yoksa no-op) | DESIGN.md var mı |
| 1 — Statik token | `check-self-registry --rule=design-tokens` (zorunlu, staged) | hardcoded hex/rgb/inline-style/Tailwind-arbitrary — **tutarlılık**, KALİTE DEĞİL |
| 2 — Erişilebilirlik | `templates/ci-workflow.template.yml` opsiyonel blok | axe-core/Lighthouse — hedef repo CI'ında çalışır |
| 3 — Görsel/VLM | aynı, opsiyonel | hiyerarşi/"AI kokusu" — paket ÇALIŞTIRMAZ, yalnız reçete eder |

**Sınır çözümü:** paket tarayıcıyı kendisi çalıştırmaz — bugün zaten `templates/
ci-workflow.template.yml` aynı deseni uyguluyor (CI şablonu üretip hedef repoya bırakıyor).
Kademe 2-3 için de aynı: script+CI job reçete edilir, paket kendi runtime'ında koşturmaz.

## Yedi risk — her biri farklı bir kırılma noktasında (hiçbiri birbirine indirgenmez)

| Risk | Panzehir |
|---|---|
| Bypass sendromu / token kaçağı — ajan kısıt altında inline CSS'e kaçar | Kademe 1 statik kapı `--strict` |
| Uyum ≠ kalite — %100 token-uyumlu ekran hâlâ çirkin olabilir | Kapı yalnız TUTARLILIK iddia eder, DESIGN.md'de "Kademe 1 kalite garantisi değildir" notu |
| Yanlış ölçüm — istisnai rengi "birincil" sanmak, kapı kendi kendini referans aldığı için yakalayamaz | ≥2 sinyal eşiği + insan onayı |
| Bağlamsızlık — "doğru renk, yanlış bağlam" (dark mode'da okunmayan sabit mavi) | DESIGN.md'de light/dark ayrı token grubu (şablonda alan) |
| Kötü baseline'ı kalıcı kılmak — ilk visual-regression screenshot'ı onaysız referans olursa kötülüğü korur | DESIGN.template.md: "ilk baseline insan onayıyla kilitlenir" |
| Sözleşme kaymasını kimse yakalamaz | [ORTA+ toggle] opsiyonel `design-steward` rolü |
| Kimlik ihlali — kurulum süreci ürün geliştirmeye kayar | bkz. aşağıdaki "FAZ sırası" bölümü, koruma kuralı |

## FAZ sırası — "önce ekran mı önce altyapı mı" yanlış ikili

6 model bağımsız aynı sonuca vardı: kullanıcı hipotezi ("önce ekran, sonra altyapı") ile
spec-driven development (GitHub Spec Kit, AWS Kiro, Google Antigravity, BMAD Method) arasında
çelişki yok — sadece "ekran" yanlış çerçevelenmiş. UI ayrı bir FAZ değil, **"Specify" adımının
zorunlu bileşeni**: akış + kabul kriteri + ekran davranışı BİRLİKTE tanımlanır.

**Agentik bağlama özgü fark** (Gemini/Kimi/Grok bağımsız aynı ayrıma vardı):
> İnsan için mockup = düşünme aracı (ıraksak, empati kurar).
> Ajan için ekran = doğrulama aracı (yakınsak, "spec'e uyuyor mu" kontrolü).

Google Antigravity'nin screenshot/walkthrough'u bunun kanıtı — ajan tarayıcıyı tasarım için
değil, üretilen kodu spec'le karşılaştırmak için açıyor. **Spec zayıfsa görsel erişim boşa
gider** — "ajana ekranı göster" tek başına çözüm değildir.

**Yeni FAZ eklenmez** (kimlik ihlali riski — bkz. aşağı). Bunun yerine:
- FAZ1 madde 9 (merkezi altyapı envanteri) yanına: tasarım-dili + akış/ekran sözleşmesi
  hijyeni de taranır (DESIGN.md/flows/screens eksik mi) — "boşluk skoru"na eklenir.
- FAZ3'e `DESIGN.template.md` + `docs-flows.template.md` + `docs-screens.template.md` üretimi
  eklenir ([ORTA+] toggle, UI-ağır repo sinyali varsa).
- FAZ5 (pilot dalga) madde 1 genişler: "küçük gerçek görev" walking-skeleton olarak netleşir —
  **tek akış (flow dosyasından) + tek ekran (DESIGN.md token'larıyla, GERÇEK render, mock
  değil) + minimal gerçek altyapı + ajan render alıp kabul kriteriyle karşılaştırır.** Ekran
  sayısı sert tavan: **1 akış, ≤2 ekran** (pilotun ürün geliştirmeye kaymasını önler).

## En büyük risk ve koruma kuralı (6 model aynı isimle çağırdı)

**Kimlik ihlali / kapsam kayması** — kurulum süreci "otonom ürün geliştirici"ye dönüşme riski.
Her projenin UI ihtiyacı farklıdır (web/mobil/CLI/API-only); paket bunu bilemez, kendi UI
tercihlerini dayatan bir şablon motoruna dönüşürse esnekliğini kaybeder.

**Koruma kuralı:**
> SKILL hiçbir ekran pikseli üretmez; yalnızca ekran üretilecek sürecin şablonunu ve kapısını
> kurar.

## Tek altın kural

> Ajan UI icat etmez; mevcut tasarım dilini ölçerek çıkarır ya da insan-onaylı bir referans
> seçer, bunu DESIGN.md ile ölçülebilir bir sözleşmeye bağlar — akış ekrandan önce gelir,
> ekran akıştan türetilir, ve en az statik bir kapı bu sözleşmeden sapmayı zorunlu olarak
> yakalar. Görsel/VLM doğrulama pakete gömülmez, hedef repoya reçete edilir.
