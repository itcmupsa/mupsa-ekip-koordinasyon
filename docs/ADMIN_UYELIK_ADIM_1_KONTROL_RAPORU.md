# Kontrol Raporu — Süper Yönetici Üyelik Ekranı, Adım 1

**Tarih:** 3 Ağustos 2026

## Kapsam

- `useMembershipStatus` aktif üyeliğe ait profil, dönem, uygulama rolü ve koordinatörlük bilgilerini de döndürür.
- `/app/yonetim/uyeler` yolunda Süper Yönetici için salt okunur üye listesi yer alır.
- Ana ekranda yalnızca Süper Yöneticiye gösterilen yönetim kartı eklendi.

Bu adımda üyelik ekleme, düzenleme, pasifleştirme, kullanıcı daveti, migration veya RLS değişikliği yoktur.

## Doğrulama

Yerel proje üzerinde `npm run lint` ve `npm run build` çalıştırılarak doğrulanmalıdır.

## Başlangıç yetkisi notu

İlk kullanıcı, uygulama içinden kendi kendine Süper Yönetici olamaz. Ekranın gerçek veriyle kullanılabilmesi için, test kullanıcısının kontrollü bir SQL işlemiyle aktif dönem için `super_admin` üyeliğine atanması gerekir.
