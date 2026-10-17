# Katkı Rehberi

Katkın için teşekkürler. Bu repo herkese açıktır: indirebilir, fork'layabilir, kendi
projende kullanabilirsin (lisans: MIT). Ana repoya değişiklik ise yalnızca **pull request**
ile girer.

## Akış

1. Repoyu fork'la, kendi fork'unda bir dal aç.
2. Değişikliğini yap; yerelde doğrula:
   ```bash
   npm run check        # öz-doğrulama + kapı birim testleri
   ```
3. Pull request aç. Şablondaki kontrol listesini doldur.
4. CI (`verify` iş akışı) yeşil olmalı ve depo sahibi (`CODEOWNERS`) onaylamalıdır.
   `main` dalına doğrudan push ve force-push kapalıdır.

## Kurallar

- Repo kuralları `CLAUDE.md`'dedir; kapı sözleşmesi `CONTRACT.md`'dedir.
- Yeni kapı = `gates/check-*.mjs` + `CONTRACT.md` satırı + `tests/` altında kirli-girdi testi.
  Bu üçü olmadan kapı kabul edilmez (`check-self-registry --rule=orphan-gates` zorlar).
- Gizli anahtar, kişisel veri, müşteri ya da şirket adı **eklemeyin**. Örnekler için
  `example.io` gibi nötr adlar kullanın.
- Yeni bağımlılık eklemeden önce issue açın; paket bilinçli olarak bağımlılıksızdır.

## Lisans

Pull request göndererek katkının bu reponun lisansı (MIT) altında yayımlanmasını kabul etmiş olursun.
