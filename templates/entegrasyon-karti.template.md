---
servis: {{SERVIS_ADI}}             # ör. AWS SES
paketler: ["{{PAKET}}"]            # manifestteki paket adları, TIRNAKLI; sonu * = önek (ör. "AWSSDK.*", "@aws-sdk/*")
kaynak: {{RESMI_BELGE_URL}}        # OKUNAN resmî belge — hafıza/blog DEĞİL
dogrulandi: {{YYYY-AA-GG}}         # prob'un en son koşulduğu gün
boyutlar: [{{BOYUT}}]              # servisin BÖLÜNDÜĞÜ eksenler: bolge | ortam | hesap | paket | surum
                                   #   ölçüldü ve yoksa `boyutlar: yok` yaz — BOŞ bırakma
prob: "{{SALT_OKUR_KOMUT}}"        # durumu ÖLÇEN salt-okur komut (yazma/gönderme YAPMAZ)
---
<!--
ÜRETİM TALİMATI (v0.27 — dış-sistem ekseni; manifestte bilinen dış servis SDK'sı VARSA kurulur):
  Hedef: `docs/integrations/<servis>.md` — her dış servis için YARIM SAYFA. Belgenin kopyası DEĞİL;
  "bu servis nasıl bölünür, bizde hangi parçası hangi durumda, nasıl ölçülür" özeti.

  🔴 Kart ÖLÇÜLEREK doldurulur. Sıra atlanmaz:
    1. Resmî belgeyi OKU (web) — özelliği değil önce BÖLÜNME biçimini ara: bölge başına mı,
       ortam (sandbox/production) başına mı, hesap/paket başına mı?
    2. Her boyut değeri için salt-okur PROB koş (ör. AWS: `aws sesv2 get-account --region <b>`).
    3. Ölçüleni tabloya yaz; ölçemediğini `[ÇIKARIM]` diye işaretle — ölçülmüş gibi yazma.

  Zorlayan kapı: `gates/check-provenance.mjs --rule=integration-cards` — dış SDK'sı olup kartı
  olmayan paketi ve boş alanı bildirir; `dogrulandi` 90 günden eskiyse NOT düşer. Kapı kartın
  DOĞRU olduğunu göremez — doğruluk hakem işidir. Gerekçe: reference/doctrine.md D-33.
-->

# {{SERVIS_ADI}} — Entegrasyon Kartı

## Ölçülen durum

| Boyut değeri | Durum | Kanıt (prob çıktısından tek satır) | Etiket |
|---|---|---|---|
| {{ör. bolge=eu-west-1}} | {{ör. production}} | {{ör. ProductionAccessEnabled: true}} | [ÖLÇÜLDÜ] |

## Tuzaklar

<!-- Bu servisi yanlış anlatmaya en yatkın olgular. Ör: "sandbox durumu bölge başınadır;
     bir bölgede production olmak diğerini açmaz" · "gönderici kimliği de bölgeye bağlıdır". -->
- {{TUZAK}}

## Kodda nerede

<!-- İstemcinin kurulduğu yer + boyutu belirleyen ayar (ör. region env değişkeni). -->
- {{DOSYA_VE_AYAR}}
