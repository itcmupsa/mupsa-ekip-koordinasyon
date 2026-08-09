# Dönem bazlı görünen ad test senaryoları

## Hazırlık

- Test için iki dönem ve en az bir profil bulunmalı.
- Aynı profilin iki dönemde de üyeliği olmalı.
- Birinci dönemdeki üyelik adı `Eski Koordinatör`, ikinci dönemdeki üyelik adı `Yeni Koordinatör` olmalı.
- Test sırasında gerçek kullanıcı e-postası, parola veya gizli anahtar dosyaya yazılmamalı.

## Senaryolar

1. `period_memberships.period_display_name` alanının mevcut üyeliklerde dolu olduğu doğrulanır.
2. Aynı profilin iki farklı dönemde iki farklı görünen ad taşıdığı doğrulanır.
3. Birinci döneme ait etkinlikte `Eski Koordinatör` adı görünür.
4. İkinci döneme ait etkinlikte `Yeni Koordinatör` adı görünür.
5. Süper Yönetici, `/app/yonetim/uyeler` ekranında aktif dönem görünen adını değiştirir; sayfa yenilendikten sonra yeni ad korunur.
6. Normal kullanıcı üyelik görünen adını değiştiremez; RLS işlemi reddeder.
7. Kilitli dönemde üyelik görünen adı, rolü veya aktifliği değiştirilemez; veritabanı trigger'ı işlemi reddeder.
8. Aynı profil için aynı dönemde ikinci üyelik oluşturulamaz.
9. Auth e-posta adresi değişmeden kalır.
10. `useMembershipStatus`, EventsList, EventDetail, AppHome, AwarenessPosts ve AdminMembers ekranlarında kişi adları boş veya profil fallback'i olarak görünmez; dönem üyeliğinden gelir.

## Beklenen güvenlik sonucu

- Sadece Süper Yönetici dönem üyeliği görünen adını değiştirebilir.
- Eski dönem üyeliği ve eski görünen ad korunur.
- Profil/Auth hesabı silinmez.
