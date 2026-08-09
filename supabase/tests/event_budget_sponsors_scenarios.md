# Sponsorlar canlı test senaryoları

1. Aktif normal üye sponsorları okuyabilmeli ancak ekleme/düzenleme kontrollerini görmemeli.
2. Etkinlik sahibi sponsor ekleyememeli veya pasifleştirememeli.
3. Bütçe Ana Sorumlusu sponsor ekleyebilmeli, düzenleyebilmeli ve pasifleştirebilmeli.
4. Süper Yönetici sponsorları yönetebilmeli.
5. Sponsor adı boş bırakılamamalı; negatif tutar veritabanı ve arayüz tarafından reddedilmeli.
6. Sponsor pasifleştirildiğinde varsayılan listeden kaybolmalı; “Pasif sponsorları göster” ile görünmeli ve yeniden aktifleştirilebilmeli.
7. Kilitli dönemde sponsor ekleme, düzenleme, pasifleştirme ve yeniden aktifleştirme reddedilmeli.
8. Sponsor ekleme/düzenleme/pasifleştirme işlemleri `audit_logs` içinde `event_budget_sponsor` olarak görünmeli.
9. Aktif Sayman yoksa bütçe Ana Sorumlusu seçimi boş kalmalı; Sayman varsa yalnızca Sayman Ana Sorumlu adayı olarak görünmeli.
