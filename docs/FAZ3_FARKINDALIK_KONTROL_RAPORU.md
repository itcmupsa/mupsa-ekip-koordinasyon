# Faz 3 — Farkındalık Paylaşımları Kontrol Raporu

## Durum

Kod ve migration hazırlandı. Migration uzak Supabase’e uygulandı; canlı kullanıcı testi henüz tamamlanmadı.

## Yapılan düzeltmeler

- Gemini migration numarası mevcut bütçe migration’ı ile çakışmayacak şekilde `20260809040000_add_awareness_and_period_fixes.sql` olarak düzenlendi.
- 2026–2027 dönemi 1 Temmuz 2026–30 Haziran 2027 aralığına düzeltildi.
- Etkinlik hazırlık başlangıcı kesin tarihten, yoksa tahmini tarihten 40 gün önce hesaplanacak hale getirildi.
- Farkındalık hazırlık başlangıcı paylaşım tarihinden, yoksa tahmini tarihten 14 gün önce hesaplanacak hale getirildi.
- Audit türleri korunarak `awareness_post` eklendi.
- Fiziksel silme policy’si eklenmedi; pasifleştirme soft-delete ile yapılacak.
- Farkındalık sorumlularının aynı dönemin aktif üyesi olması için veritabanı kontrolü eklendi.
- Farkındalık ekranında `any` kullanımı kaldırıldı ve eksik tarih yardımcı fonksiyonu tamamlandı.
- Farkındalık route’u ve ana sayfa kısayolu eklendi.

## Yerel kontroller

- `npm run lint`: başarılı
- `npm run build`: başarılı
- `git diff --check`: başarılı
- `supabase db lint --local`: çalıştırılamadı; Supabase CLI çalışma alanı telemetry dosyasına sandbox nedeniyle yazamadı.
- `supabase db push`: başarılı; `20260809040000_add_awareness_and_period_fixes.sql` uzak Supabase’e uygulandı.

## Canlı testten önce

- Dönem, etkinlik hazırlık tarihi ve audit kayıtları için SQL testleri çalıştırılmalı.
- Sonra aktif üye, yetkisiz üye, sorumlu, pasifleştirme ve kilitli dönem canlı testleri yapılmalı.

Ayrıntılı test listesi: `supabase/tests/awareness_posts_scenarios.md`
