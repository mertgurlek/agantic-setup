<!--
URETIM TALIMATI: Bu dosya iki ayri sablon icerir. ORTA/BUYUK seviyede
docs/CONTEXT_BUDGET.md kurulur. docs/SKILL_CARDS.md yalniz tekrar eden is ailesi
gozlemi varsa kurulur; yoksa STATE.md'ye "gozlemle ac" notu dusulur.
Kucuk seviyede bu dosyalar kurulmaz; kok CLAUDE.md okuma protokolune 3-5 satir ek yeter.
{{...}} alanlari FAZ 1/5 olcumlerinden gelir. Olcmediysen yazma.
-->

<!-- ===== docs/CONTEXT_BUDGET.md [ORTA+] ===== -->
# Context Butcesi

> Amac tokeni korumak degil, dogru ise dogru kadar context harcamak.
> Dogruluk, guvenlik ve kanit token tasarrufundan once gelir.

## Mod butceleri

| Mod | Ne zaman | Context kurali | Cikis beklentisi |
|-----|----------|----------------|------------------|
| hafif | tek dosya / kucuk fix | grep + 1 referans desen + hedefli verify | kisa rapor |
| normal | 2-5 dosya / davranis degisikligi | ilgili rehber + referans desen + hedefli test | focus summary varsa ekle |
| derin | sema/auth/prod/veri/model/kritik karar | kesif planli; kilitler ve kabul kriterleri once | hakem + tam verify |

## Okuma kara listesi ve alternatifleri

| Dosya/desen | Neden pahali | Yerine ne yap |
|-------------|--------------|---------------|
| {{BUYUK_LOG_DOSYASI}} | karar tasimayan uzun cikti | `rg` ile hedefli ara; sadece ilgili bolumu ac |
| {{APPEND_ONLY_LOG}} | tarihsel kayit, tam okutma sisirir | son N girdi + baslik aramasi |
| {{BUYUK_CONFIG}} | tek seferde baglam bombasi | anahtar bazli `rg`, sonra yakin cevre |

## Focus summary formati

Uzun kesif veya 3+ tool okumasi sonrasi ham gecmisi tasima; su blokla kapat:

```md
### Focus Summary - {{KONU}}
Karar icin gerekli gercekler:
- {{GERCEK_1}} (kanit: {{DOSYA_VEYA_KOMUT}})
Risk / belirsizlik:
- {{RISK}}
Sonraki en kucuk adim:
- {{ADIM}}
Atlanan ham baglam:
- {{NE_ATLANDI_VE_NEDEN_GUVENLI}}
```

## Sikistirilamaz taahhutler

Asagidakiler ozetlenebilir ama dusurulemez veya zayiflatilamaz:
- kullanici karari / kapsam siniri
- kabul kriteri ve kanit
- baseline kirmizisi / bilinen failure
- secret, prod veri, auth, maliyet riski
- aktif dosya kilidi ve sahiplik
- insan onayi bekleyen urun veya mimari karar

## Context hotspot kaydi

| Tarih | Gorev | En pahali context kaynagi | Cozum | Sonuc |
|-------|-------|---------------------------|-------|-------|
| {{TARIH}} | {{GOREV}} | {{HOTSPOT}} | {{FOCUS/GREP/BUDAMA}} | {{ETKI}} |

## Budama kurali

- Bir rehber/context kuralinin son gercek faydasi yoksa budama turunda sorgulanir.
- Bir focus summary kritik taahhudu dusurduyse format degistirilir; daha agresif ozetleme yapilmaz.
- Token sayisi ancak arac telemetrisiyle gelirse yazilir. Ajan tahmini sayi kanit degildir.

<!-- ===== docs/SKILL_CARDS.md [gozlem varsa ORTA+] ===== -->
# Skill Cards

> Tekrar eden is ailelerinde "her seferinde sifirdan dusunme"yi azaltir.
> Kart = kisa prosedur + kanit + son gercek kullanim. 5-7 karti gecerse budama turu zorunlu.

## Kart kabul kurali

Yeni kart ancak su kosullarda eklenir:
- ayni is ailesi en az 2 kez goruldu
- prosedur 10 satirdan kisa yazilabiliyor
- yanlis kullanildiginda doguracagi risk yazildi
- son gercek kullanim tarihi var

## {{KART_ADI}}

Ne zaman kullanilir:
- {{TETIK}}

Kisa prosedur:
1. {{ADIM_1}}
2. {{ADIM_2}}
3. {{DOGRULAMA}}

Kanit / referans:
- {{DOSYA_VEYA_KOMUT}}

Tuzak:
- {{YANLIS_KULLANIM_RISKI}}

Son gercek kullanim:
- {{TARIH}} - {{GOREV}}
