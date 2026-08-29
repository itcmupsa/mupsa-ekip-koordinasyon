# MUPSA PWA/Web Push güvenilirlik ve güvenlik düzeltmesi

## Hedef
7+ gün uygulama açılmasa da sunucu tarafı push teslimini dayanıklı, çoklu cihaz güvenli ve tekrar denemeli hale getirmek; logout/RLS/VAPID/SW/payload risklerini azaltmak.

## Durum
Tamamlandı. Supabase migration uygulandı, `deliver-push-notifications` Edge Function yayına alındı, Git commit/push tamamlandı ve Vercel canlı adresi 200/login ekranıyla doğrulandı.

## Uygulanan kararlar
- Push provider kabulü için TTL explicit 28 gün (`2419200` sn).
- Transient provider/network retry dizisi: 1 dk, 5 dk, 15 dk, 1 sa, 6 sa, 24 sa, 48 sa, 96 sa, 7 gün.
- Notification + subscription bazlı `push_notification_deliveries` modeli eklendi.
- `claim_push_notification_deliveries` RPC, `FOR UPDATE SKIP LOCKED`, claim token ve 10 dk stale-processing recovery kullanıyor.
- Aynı kullanıcının bir cihazı başarılı diğer cihazı transient ise notification `queued` kalıyor; cihaz retry kaybolmuyor.
- 404/410 subscription pasifleştiriliyor ve retry edilmiyor.
- Logout'ta eski profile bağlı DB endpoint satırı silinmeye çalışılıyor ve browser subscription iptal ediliyor; normal logout olmayan uzun kapalı kullanımda aboneliğe dokunulmuyor.
- Bildirim izni granted ise ve kullanıcı açıkça opt-out yapmadıysa eksik browser subscription app açılışında sessizce yeniden kurulabiliyor.
- `pushsubscriptionchange` best-effort SW resubscribe + açık client sync mesajı eklendi; kapalı sayfada authenticated server sync garantisi verilmedi.
- `notifications` istemci UPDATE yetkisi yalnız `read_at` kolonuna indirildi.
- Süper Yönetici başka kullanıcıların ham push endpoint/p256dh/auth verisini SELECT edemiyor; service role teslimatı sürüyor.
- Frontend hardcoded VAPID fallback kaldırıldı; `VITE_WEB_PUSH_PUBLIC_KEY` env zorunlu hale geldi.
- SW notification click yalnız same-origin `/app` veya `/app/...` hedefini kabul ediyor.
- Push JSON UTF-8 byte boyutu 3000 byte güvenli sınırında tutuluyor; uzun Unicode gövde yalnız push için kısaltılıyor, uygulama içi body tam kalıyor.
- Mevcut hardcoded production cron/function URL risksiz ortam kaynağı doğrulanamadığı için değiştirilmedi.

## Değişen yollar
- .agent/PROGRESS.md
- .agent/HISTORY.md
- .env.example
- README.md
- public/sw.js
- src/App.tsx
- src/components/AppShell.tsx
- src/lib/pushNotifications.ts
- src/pages/AccountSettings.tsx
- src/pages/AppHome.tsx
- supabase/functions/deliver-push-notifications/index.ts
- supabase/functions/_shared/pushDeliveryPolicy.ts
- supabase/functions/_shared/pushDeliveryPolicy.test.mjs
- supabase/migrations/20260827231000_harden_web_push_delivery.sql
- supabase/tests/push_delivery_scenarios.md
- supabase/tests/push_subscriptions_scenarios.md
- package.json

## Doğrulamalar
- `npm run test:push`: PASS; 5 otomatik push policy/migration invariant testi geçti.
- `npm run lint`: PASS, 0 warning / 0 error.
- `npm run build`: PASS; TypeScript + Vite production build tamamlandı.
- `git diff --check`: PASS.
- `supabase db lint --linked`: PASS; bağlı mevcut uzak şemada hata yok. Bu komut yeni yerel migration uygulanmadığı için onun runtime semantiğini tek başına doğrulamaz.
- `supabase db push --linked --dry-run`: PASS; yalnız `20260827231000_harden_web_push_delivery.sql` uygulanacağı doğrulandı.
- `supabase db push --linked`: PASS; migration uzak veritabanına uygulandı.
- `supabase migration list --linked`: PASS; `20260827231000` local ve remote eşleşiyor.
- `supabase functions deploy deliver-push-notifications`: PASS; function ACTIVE version 12 olarak doğrulandı.
- Trivy `all`: PASS; vulnerability/secret/misconfig bulgusu yok, yalnız 16 LOW license bulgusu.
- `deno check supabase/functions/deliver-push-notifications/index.ts`: ÇALIŞMADI; ortamda `deno` komutu yok. Deploy bundling başarılı oldu.

## Kalan riskler
- Web Push dış servis olduğu için send başarılı olduktan sonra DB finalize öncesi worker crash olursa nadir duplicate yeniden gönderim penceresi tamamen ortadan kaldırılamaz; atomik claim eşzamanlı duplicate'i engeller ve notification `tag` aynı bildirimi cihazda replace etmeye yardımcı olur.
- `pushsubscriptionchange` tarayıcı desteği sınırlıdır; app hiç açılmadan subscription rotasyonu olduğunda authenticated server sync tüm tarayıcılarda garanti edilemez.
- Cron migration'ındaki hardcoded production function URL değiştirilmedi; güvenli ortam-spesifik URL/Vault standardı ayrıca ele alınmalı.
- Vercel `VITE_WEB_PUSH_PUBLIC_KEY` canlı Production ortam değişkeni doğrulandı ve eklendi. Yeni frontend deployment ile etkili olacak.

## Sonraki adım
Gerçek cihazlarda en az bir iPhone/PWA ve bir ikinci cihaz ile test bildirimi gönderip teslim davranışını gözlemle; gerekirse teslim gözlemlenebilirliğini ayrıca geliştir.

## 2026-08-28 Ortak koordinatör sistemi
- Hedef: Bir etkinliğin tek ana sahibi korunurken birden fazla ortak koordinatör atanabilsin; ortak koordinatörler etkinliği genel olarak düzenleyebilsin, fakat ana sahiplik ve ortak koordinatör yönetimi kritik yetki olarak ana sahip/Süper Yönetici tarafında kalsın.
- Plan: `event_coordinators` veri modeli + RLS/yetki fonksiyonları; etkinlik oluşturma formunda çoklu ortak koordinatör seçimi; Etkinlikler filtresinde ana veya ortak koordinatör rolüne göre tekil kart gösterimi; etkinlik detayında ortak koordinatörleri görüntüleme/yönetme; ortak koordinatör için genel etkinlik/görev düzenleme yetkisi; lint/build/Supabase lint+dry-run ve canlı salt-okunur doğrulama.
- Filtre kararı: Mevcut üst koordinatör filtresi korunur. Ortak etkinlik ilgili tüm koordinatörlük filtrelerinde görünür, ancak `Tümü` listesinde yalnız bir kez görünür. Sayaçlar da aynı tekil etkinlik mantığını kullanır.
- Yetki kararı: Ortak koordinatör etkinlik genel alanlarını ve bağlı görevleri yönetebilir; `owner_id`, `created_by`, dönem, kalıcı silme ve ortak koordinatör listesini değiştirme yetkisi yoktur. Ortak koordinatör ekleme/çıkarma ana sahip veya Süper Yöneticiye aittir.
- Durum: Uygulama tamamlandı. `event_coordinators` canlı Supabase'e uygulandı; ortak koordinatör seçimi, filtre davranışı, etkinlik detay yönetimi ve ortak koordinatör düzenleme yetkisi kodlandı. Lint/build/diff-check ve linked Supabase lint/dry-run/push doğrulamaları geçti. Git commit/push tamamlandı. Canlı UI doğrulaması bağlı Chrome DOM okuması takıldığı için bu turda tamamlanamadı; veri oluşturulmadı.
- 2026-08-28 UI iyileştirmesi: Yeni etkinlik formunda "Ortak koordinatör var mı? Hayır / Evet" progressive disclosure eklendi. Varsayılan Hayır; Evet seçilince kişi listesi açılıyor. Her seçenek "Koordinatörlük" üstte, "İsim" altta gösteriliyor. Evet seçiliyken en az bir kişi seçme doğrulaması eklendi. Mevcut etkinlik detayındaki ana/ortak koordinatör kartlarında ve ekleme select'inde de koordinatörlük + isim birlikte gösteriliyor. Lint/build/git diff check PASS; commit/push sırada.

## 2026-08-28 Etkinlik düzenleme yetkisi + manuel hazırlık tarihi regresyonu
- Hedef: Süper yönetici etkinlik düzenleme kontrollerinin görünmemesi ve mevcut etkinlikte hazırlık başlangıç tarihinin değiştirilememesi sorunlarını düzeltmek.
- Git bulgusu: Etkinlik düzenleme `5b3dd03` ile eklendi. Hazırlık tarihi ilk başta manueldi; `1ccf721` (2026-08-09) ile otomatik/disabled hale getirildi. 2026-08-28 manuel hazırlık tarihi çalışmasında yeni etkinlik/farkındalık ve DB triggerları düzeltilmişti ancak `EventDetail.tsx` atlanmıştı.
- Yetki bulgusu: `EventDetail` düzenleme görünürlüğü `appRole === 'super_admin'` sonucuna bağlı. Kullanıcı ekran görüntüsünde `Ekip Yönetimi` menüsü de yoktu; açık oturum frontend tarafından süper yönetici görülmüyordu. `useMembershipStatus` artık üyelik satırına ek olarak veritabanının yetkili `is_super_admin()` RPC sonucunu kullanıyor; böylece frontend yetkisi DB ile aynı kaynaktan doğrulanıyor.
- Değişen yollar: `src/pages/EventDetail.tsx`, `src/hooks/useMembershipStatus.ts`.
- Düzeltme: Mevcut etkinlik düzenleme formunda hazırlık başlangıç tarihi tekrar manuel ve kaydedilebilir; update payload `preparation_start_date` içeriyor.
- Doğrulama: `npm run lint` PASS (0/0), `npm run build` PASS, `git diff --check` PASS.
- Sonraki adım: Commit/push; Vercel sonrası aynı süper yönetici oturumunda `Ekip Yönetimi` ve `Düzenle` kontrollerini canlı doğrula. RPC false dönerse aktif dönem `period_memberships.app_role` verisi ayrıca kontrol edilmeli.

## 2026-08-28 Etkinlikler arama + ortak etkinlik rozeti
- Hedef: Etkinlikler sayfasında ortak etkinlikleri kart üzerinde hızlı ayırt etmek ve büyüyen listede başlıktan kolay arama sağlamak.
- Değişen yol: `src/pages/EventsList.tsx`.
- Karar: En az bir ortak koordinatörü olan kartta `Ortak etkinlik` rozeti gösterilir. Arama başlık, açıklama, ana koordinatör adı, ana koordinatörlük ve ortak koordinatörlük adlarında çalışır. Koordinatör filtresi ile arama birlikte uygulanır.
- UI: Arama alanında temizleme düğmesi, sonuç sayısı ve arama/filtre sonucu boşsa tek `Filtreleri temizle` aksiyonu bulunur.
- Doğrulama: `npm run lint`, `npm run build`, `git diff --check` PASS.
- Sonraki adım: Commit/push ve Vercel otomatik deployment sonrası canlı Etkinlikler sayfasında arama/rozet görünümünü salt-okunur doğrula.

## 2026-08-28 Manuel hazırlık tarihi
- Hedef: Etkinlik ve farkındalık oluştururken hazırlık başlangıç tarihini sistemin otomatik hesaplaması yerine kullanıcı seçsin.
- Değişen yollar: `src/components/events/NewEventPanel.tsx`, `src/pages/EventsList.tsx`, `src/pages/AwarenessPosts.tsx`, iki yeni Supabase migration.
- Karar: Hazırlık tarihi isteğe bağlıdır; mevcut kayıtlar korunur. MUPİ farkındalık önerisi varsa önerilen hazırlık tarihi forma önceden gelir ama kullanıcı değiştirebilir.
- Supabase: `20260828202000_allow_manual_preparation_dates.sql` canlı veritabanına uygulandı; otomatik trigger fonksiyonları artık tarihi ezmiyor.
- Ek doğrulama: DB lint sırasında önceki push claim fonksiyonunda değişken/kolon belirsizliği yakalandı; `20260828202100_fix_push_claim_variable_resolution.sql` ile düzeltildi ve canlı DB lint `No schema errors found` verdi.
- Doğrulama: `npm run lint`, `npm run build`, `git diff --check`, Supabase dry-run ve linked lint PASS.
- Sonraki adım: Git commit/push ve canlı formları veri kaydetmeden doğrula.

## 2026-08-28 Takvim aylık sayaç düzeltmesi
- Hedef: Takvim ay başlığı altındaki etkinlik/görev/farkındalık sayılarını dönem toplamı yerine seçili aya ait benzersiz kayıt sayılarıyla göstermek.
- Değişen yol: `src/pages/Calendar.tsx`.
- Karar: Etkinlik aynı ayda hem hazırlık hem etkinlik tarihi taşısa da bir kez sayılır; farkındalık tarih aralığı seçili ayla kesişiyorsa bir kez sayılır; görevler son tarih ayına göre sayılır.
- Doğrulama: `npm run lint`, `npm run build`, `git diff --check` PASS.
- Sonraki adım: Commit/push ve canlı Takvimde ay değiştirerek sayaçların değiştiğini doğrulamak.

## 2026-08-29 Etkinlik Genel Bakış UI aşama 1
- Hedef: Veri modelini değiştirmeden Etkinlik Genel Bakış ekranındaki tarih/süreç karışıklığını ve hızlı düzenleme tutarsızlığını düzeltmek.
- Baseline: `6890beb` (`fix: restore event editing controls`). Beğenilmezse yalnız bu UI çalışmasının commit'i geri alınacak.
- Değişen yol: `src/pages/EventDetail.tsx`.
- UI: `Tarihleri düzenle` artık yalnız dört tarih alanını açan odaklı modal kullanıyor; hazırlık başlangıç tarihi manuel kalıyor. Tarihler kartından Tasarım/Duyuru ve rapor durumu çıkarıldı.
- UI: Genel Bakış sol kolonuna ayrı `Süreçler` kartı eklendi. SKS kendi gerçek durumuyla, Tasarım/Duyuru mevcut birleşik veri modeliyle gösteriliyor. Tasarım/Duyuru değişikliği anlık select yerine ayrı odaklı düzenleme modalından kaydediliyor. Rapor ana süreç kartında öne çıkarılmadı.
- UI: Sonraki işlem ve Mekân mevcut odaklı hızlı düzenleme pencerelerini kullanmaya devam ediyor. Tam `Etkinliği düzenle` formundaki eski otomatik hazırlık açıklaması manuel davranışla uyumlu hale getirildi.
- Veri: Supabase migration veya veri modeli değişikliği yok; Tasarım ve Duyuru/Yayın ayrımı sonraki aşamaya bırakıldı.
- Doğrulama: `npm run lint` PASS (0 warning/0 error), `npm run build` PASS, `git diff --check` PASS. Projede `typecheck` script'i yok; ilk typecheck denemesi bu nedenle çalışmadı, build içindeki `tsc -b` başarıyla geçti.
- Sonraki adım: Git commit/push, Vercel otomatik deployment sonrası canlı etkinlikte yalnız ekranları açarak tarih modalı/süreç kartı/erişilebilirliği doğrula; canlı veri kaydetme.

## 2026-08-29 Etkinlik süreç ayrımı aşama 2
- Hedef: Referans `6890beb` değişmeden, Genel Bakış Süreçler kartından SKS'yi kaldırmak ve Tasarım ile Duyuru/Yayın durumlarını veri modelinde gerçekten ayırmak.
- UI: Süreçler kartında artık yalnız `Tasarım` ve `Duyuru / Yayın` bulunuyor. SKS burada gösterilmiyor; ayrıntılı SKS yönetimi Operasyon sekmesinde kalıyor.
- Tasarım durumları: Gerekli Değil / Brief Bekliyor / Tasarımda / Revizede / Hazır. Eski `Paylaşıldı` tasarım seçeneği pasifleştirildi ve mevcut `published` kayıtları Tasarım=`Hazır` olarak taşındı.
- Duyuru/Yayın durumları: Gerekli Değil / İçerik Bekliyor / Yayın Planlandı / Yayınlandı. Yeni `events.announcement_status` alanı ve `event_announcement_statuses` referans tablosu eklendi.
- Veri taşıma: Eski birleşik Tasarım/Duyuru durumundan Duyuru/Yayın durumu türetildi; `published` -> `Yayınlandı`, tasarımın aktif aşamaları -> `İçerik Bekliyor`, `not_required` -> `Gerekli Değil`.
- Yetki: Tasarım sürecinin ana sorumlusu yalnız Tasarım durumunu; Basın/Yayın sürecinin ana sorumlusu yalnız Duyuru/Yayın durumunu değiştirebilir. Süper Yönetici ikisini de değiştirebilir. Bütçe görünürlüğü/yetkisi değiştirilmedi.
- Migration: `20260829133000_split_design_and_announcement_statuses.sql` ve takip `20260829133100_refine_design_status_labels.sql` linked Supabase'e uygulandı. Migration geçmişi canlıda uygulandı; DB lint temiz.
- Doğrulama: `npm run lint` PASS 0/0, `npm run build` PASS (`tsc -b` + Vite), Supabase linked lint PASS, dry-run/push PASS.
- Sonraki adım: Git diff-check, commit/push ve Vercel sonrası canlı sayfada Tasarım/Duyuru ayrımını veri kaydetmeden doğrula.

## 2026-08-29 Etkinlik detay yükleme hotfix
- Sorun: Süreç ayrımı sonrası tüm etkinlik detayları `Etkinlik yüklenirken bir hata oluştu.` ekranına düşüyordu.
- Teşhis: Linked Supabase şemasında `events.announcement_status` ve yeni referans tablo mevcut; migration kayıp değil. Ancak ana etkinlik yükleme akışı yeni Duyuru/Yayın alanını ve yetkili bütçe RPC'sini kritik yolun içine almıştı. Bu ikincil sorgulardan herhangi biri hata verdiğinde tüm etkinlik sayfası çöküyordu.
- Düzeltme: Ana event sorgusu yeniden yalnız stabil temel alanları yüklüyor. `announcement_status` ayrı, hataya dayanıklı ikinci sorguyla yükleniyor; hata olursa varsayılan `Gerekli Değil` ile sayfa açık kalıyor. `get_event_budget` RPC hatası da artık tüm etkinlik detayını kapatmıyor; bütçe verisi boş kalıyor.
- Veri/DB: Yeni migration yok; canlı şema değişmedi.
- Doğrulama: `supabase gen types typescript --linked` yeni alan/tabloyu doğruladı. `npm run lint` PASS 0/0, `npm run build` PASS, `git diff --check` PASS.
- Sonraki adım: Commit/push ve Vercel sonrası canlı etkinlik detayının tekrar açıldığını doğrula.

## 2026-08-29 Etkinlik detay kalan UI tamamlamaları
- Hedef: Baseline `6890beb` korunarak kalan Etkinlik detay UI iyileştirmelerini tek akışta tamamlamak.
- Genel Bakış: Üst bilgi kartına etkinliğin ana yaşam döngüsü eklendi: Fikir → Planlanıyor → Kesinleşti → Gerçekleşti → Raporlandı → Arşivlendi. Ertelendi/İptal durumları ayrı rozetle gösteriliyor. Görünüm salt-okunur; mevcut durum düzenleme akışını değiştirmiyor.
- Düzenleme: Süper Yönetici ana sorumlu seçiminde artık `Koordinatörlük/Rol — İsim` birlikte gösteriliyor.
- Operasyon: SKS kartı kapalıyken mevcut SKS durumu küçük rozet olarak görünür; ayrıntılı düzenleme yine Operasyon içindeki SKS panelinde kalır.
- Bütçe: Mevcut güvenlik modeli doğrulandı; UI yalnız `super_admin` veya aktif `treasurer` için açılıyor, DB RPC/RLS de aynı kuralı uyguluyor. Etkinlik sahibi/ortak koordinatöre bütçe görünürlüğü eklenmedi.
- Duyuru/Yayın: Kolon bazlı `events` SELECT kısıtı nedeniyle yeni `announcement_status` kolonunun authenticated rolüne açıkça grant edilmesi gerekiyordu. `20260829143000_grant_announcement_status_select.sql` linked Supabase'e uygulandı; artık Duyuru/Yayın durumu fallback yerine gerçek değerini okuyabilir.
- Doğrulama: `npm run lint` PASS 0/0; `npm run build` PASS (`tsc -b` + Vite); `git diff --check` PASS; Supabase dry-run/push PASS; linked DB lint `No schema errors found`.
- Sonraki adım: Commit/push ve Vercel sonrası bağlı canlı etkinlikte yaşam döngüsü, rol+isim sorumlu seçimi, SKS durum rozeti ve ayrı Duyuru/Yayın değerini veri değiştirmeden doğrula.
