# Supabase veritabani

Bu klasor Faz 1 / Adim 1 veritabani iskeletini icerir.

`migrations/20260802120000_faz1_database_skeleton.sql` dosyasi sunlari kurar:

- Supabase Auth ile bagli kullanici profilleri ve donem uyelikleri
- Koordinatorlukler, donemler ve Super Yonetici rol modeli
- Etkinlikler, surec sorumlulari ve ekip uyeleri
- Cok kisili gorev atamasi ve yapilandirilmis gorev bagimliliklari
- Uygulama ici/e-posta/push bildirim kuyrugu
- Geri alinabilir silme, donem kilidi ve audit gecmisi
- Row Level Security (RLS) politikalarinin ilk surumu

Sonraki migration'lar bu iskeleti bozmadan eklenir:

- `20260802130000_add_period_membership_audit.sql`: donem uyeligi, rol ve yetki degisikliklerini audit gecmisine ekler.
- `20260802140000_queue_task_assigned_notifications.sql`: yeni gorev atamasinda uygulama ici ve e-posta bildirim kuyrugu kayitlarini uretir. E-posta gonderimi bu asamada henuz yapilmaz.
- `20260802150000_add_push_subscriptions.sql`: kullanicilarin birden fazla cihaz/tarayici icin push aboneliklerini ve gerekli teknik anahtarlarini saklar. Abonelik anahtarlari audit gecmisine yazilmaz.

Bildirim ve push altyapisinin test senaryolari `tests/` klasorunde tutulur. Ilk senaryolar: `tests/notification_task_assigned_scenarios.md` ve `tests/push_subscriptions_scenarios.md`.

2 Agustos 2026'da bu dort migration gercek Supabase projesinde SQL Editor ile uygulanmis ve temel bildirim/push senaryolari test edilmistir. Ayrintilar: `tests/REAL_SUPABASE_TEST_REPORT.md`.

> Onemli: Ilk migration'lar SQL Editor ile elle uygulandigi icin Supabase CLI migration gecmisinde henuz kayitli degildir. Yeni migration eklemeden once proje CLI ile repoya baglanip güvenli bir baseline olusturulmalidir.

Migration uygulandiginda etkinlik, gorev veya kullanici kaydi olusturulmaz. Yalnizca master dokumanda tanimlanan sabit durumlar, koordinatorlukler ve 2026-2027 donemi eklenir.

## Ilk canli yonetici kurulumu

Supabase Auth uzerinden ilk kullanici davet edildikten sonra, ilk Super Yonetici uyeligi Supabase SQL Editor veya guvenli yonetim araci ile olusturulmalidir. Bu islem uygulama arayuzu gelmeden once bir kez yapilir. Sonraki kullanici ve rol yonetimi uygulamanin yonetici ekraniyla yapilacaktir.

E-posta adresleri `auth.users` tablosunda kalir; `public.profiles` tablosunda ekip listesinde gorunen ad tutulur. Bu nedenle kullanicilar birbirlerinin e-posta adreslerini uygulama veritabanisi sorgularindan goremez.
