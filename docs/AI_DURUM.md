# MUPSA — Güncel Geliştirme Durumu

Bu dosya, proje bağlamının güncel durum kaydıdır. Bir görev tamamlandığında yalnızca bu dosyadaki ilgili bölümleri güncelle; `AI_BAGLAM.md` dosyasını yalnızca kalıcı karar değiştiğinde değiştir.

**Son güncelleme:** 10 Ağustos 2026

## Canlı sistem

- Canlı web adresi: https://mupsa-ekip-koordinasyon.pages.dev
- Barındırma: Cloudflare Pages
- Kaynak dal: GitHub `main`
- İlk canlı derleme başarılı oldu.
- Canlı giriş ekranı ve `/auth/callback` route'u test edildi.

## Tamamlananlar

### Supabase ve veritabanı

Supabase projesi açıldı ve Faz 1 veritabanı altyapısı gerçek projeye uygulandı.

Uygulanan migration konuları:

1. Temel veritabanı şeması, referans veriler ve RLS
2. `period_memberships` değişiklikleri için audit kaydı
3. Görev ataması bildirimi
4. Web Push aboneliği için `push_subscriptions` tablosu
5. SKS durum değişikliği bildirimi
6. Bağımlı görevin etkinleşmesi bildirimi
7. Etkinlik tarihi değişikliği bildirimi
8. Zamanlanmış gecikme, yaklaşan tarih ve tarih bağımlılığı taraması

Tüm migration'lar yerel Supabase CLI kayıtları ile uzak veritabanı kayıtlarında eşitlenmiş ve doğrulanmıştır. `pg_cron` etkinleştirilmiştir.

Bildirim altyapısı `notifications` kuyruğuna kayıt üretir. Web Push teslimi Supabase Edge Function ve her dakikalık cron ile çalışır; gerçek e-posta teslimat katmanı henüz eklenmedi.

### Web temeli

Şu özellikler çalışır durumda:

- Vite + React + TypeScript + Tailwind uygulaması
- E-posta + şifre giriş formu
- Oturumlu kullanıcı için ilk şifre belirleme ekranı (`/app/ayarlar/sifre`)
- Yalnızca davetli kullanıcılar için giriş (`shouldCreateUser: false`)
- Oturum kontrolü ve çıkış yapma
- `/login`, `/auth/callback`, `/app` route'ları
- Aktif dönem üyeliği olmayan kullanıcı için açıklayıcı uyarı ekranı
- Süper Yönetici için aktif dönem üyelerini görüntüleme ekranı
- Süper Yönetici için mevcut kullanıcıyı aktif döneme ekleme ekranı
- Süper Yönetici için mevcut üyeyi düzenleme ve pasifleştirme ekranı
- Aktif dönem etkinliklerini listeleme ekranı (`/app/etkinlikler`)
- Aktif dönemde temel etkinlik oluşturma formu
- Etkinlik detay route iskeleti (`/app/etkinlikler/:eventId`)
- Etkinlik detayında temel bilgi okuma (ad ve açıklama)
- Etkinlik detayında durum etiketi ve tarihleri okuma
- Etkinlik detayında sorumlu, mekân ve sonraki işlem bilgilerini okuma
- Etkinlik sahibinin veya süper yöneticinin etkinlik adı/açıklamasını düzenleyebilmesi
- Etkinlik sahibinin veya süper yöneticinin etkinlik tarihlerini düzenleyebilmesi
- Etkinlik detayında görevleri salt-okunur listeleme
- Etkinlik detayında temel görev oluşturma formu
- Görevlere ana sorumlu, destekleyen ve bilgilendirilen kişi atama/kaldırma yönetimi
- Cloudflare Pages üzerinde canlı yayın

Cloudflare Pages için iki Supabase yayınlanabilir ortam değişkeni tanımlandı. Gizli anahtar kullanılmadı.

### Gerçek canlı test

- Test kullanıcısı Supabase'e davet edildi.
- Davet kabul edildi.
- Kullanıcı canlı sitede başarıyla oturum açtı.
- Önceki Magic Link akışı test edildi; e-posta teslim limitleri nedeniyle gerçek kullanım için kaldırıldı.
- Vercel üzerinde e-posta + şifre ile çıkış yapıp yeniden giriş testi başarıyla tamamlandı.
- Mevcut oturumlu kullanıcı, `/app/ayarlar/sifre` üzerinden ilk şifresini başarıyla belirledi.
- Kullanıcıya henüz dönem üyeliği verilmediği için beklenen “aktif dönem yetkin henüz tanımlanmamış” mesajı görüntülendi.
- İlk yönetici ataması yapıldı: `odsnmn27@gmail.com` hesabı 2026–2027 döneminde Bilişim Teknolojileri Koordinatörü ve `super_admin` olarak aktif.
- Canlı `/app` ve `/app/yonetim/uyeler` ekranları açıldı; yönetici üyelik kartı, “Üye ekle” ve “Düzenle” seçenekleri doğrulandı.
- “Üye ekle” panelinin boş liste davranışı doğrulandı. Başka aktif dönem profili olmadığı için boş liste mesajı beklenen şekilde gösterildi.
- Yanlışlıkla davet edilen `nmnods27@gmail.com` Auth kullanıcısı silindi. Doğru test adresi `nmnod27@gmail.com` için yeni davet gönderimi e-posta hız sınırına takıldığı için beklemede.

Bu test, giriş akışının çalıştığını doğrular. Henüz uygulama işlevlerinin tamamlandığı anlamına gelmez.

## Bilinen eksikler

Henüz yapılmayan ana özellikler:

- İkinci test kullanıcısının davet edilmesi ve üyelik ekleme akışının canlı testi
- Etkinlik düzenleme ekranı
- Görev oluşturma, atama, destekleyen kişi ve bağımlılık ekranları
- Gerçek e-posta teslimat katmanı (Magic Link artık kullanılmıyor; şifreli girişte gerekli değil)
- İlk şifre belirleme ekranının canlı testi
- Kullanıcı oluşturma akışının daha pratik bir yönetim ekranına dönüştürülmesi
- Dışa aktarım ve dönem arşivi ekranları
- PWA kurulumunun ve offline davranışının başkan revizyonu sonrasında yeniden gözden geçirilmesi

## Şu anki sıradaki küçük görev

**Takvim, yönetici duyurusu, merkezi görev akışı ve kişisel rol bazlı dashboard canlıda kontrol edildi. PWA kurulumu ve push bildirimi gerçek telefonda çalışıyor. Sıradaki odak, başkana gönderim öncesi arayüz/deneyim iyileştirmesi ve başkan revizyonunun alınmasıdır.**

Hedef:

- Sadece Süper Yönetici erişebilsin.
- Üyelik Adım 1 tamamlandı: Aktif dönem üyeleri görüntülenebilir.
- Üyelik Adım 2 tamamlandı: Davetli bir profil aktif döneme eklenebilir.
- Üyelik Adım 3 tamamlandı: Mevcut üyenin koordinatörlüğü, rolü ve aktifliği güncellenebilir.
- Kendini pasifleştirme, kendi süper yönetici rolünü kaldırma ve son aktif süper yöneticiyi etkisiz bırakma arayüz düzeyinde engellenir.
- Silme yerine pasifleştirme ilkesi korunur.
- Etkinlik listeleme adımı tamamlandı: aktif üyeler `/app/etkinlikler` üzerinden silinmemiş etkinlikleri görebilir.
- Etkinlik oluşturma adımı tamamlandı: aktif üye etkinlik adı, açıklama, planlama ve tahmini tarihi girerek etkinlik oluşturabilir; oluşturan kişi otomatik etkinlik sahibi olur.
- Etkinlik detay route adımı tamamlandı: etkinlik kartları `/app/etkinlikler/:eventId` adresine gider ve geçici detay sayfası açılır.
- Etkinlik detay temel bilgi adımı tamamlandı: aktif üye, kendi aktif dönemindeki etkinliğin adını ve açıklamasını okuyabilir.
- Etkinlik detay durum/tarih adımı tamamlandı: aktif üye etkinliğin durum etiketini ve planlama, hazırlık başlangıcı, tahmini ve kesinleşen tarihlerini okuyabilir.
- Etkinlik detay süreç bilgileri adımı tamamlandı: aktif üye sorumlu kişiyi, mekânı ve sonraki işlemi okuyabilir.
- Etkinlik detay akışının canlı görünümü kontrol edildi: test etkinliği, durum/tarihler ve süreç bilgileri doğru gösterildi.
- Etkinlik düzenleme adımı tamamlandı: etkinlik sahibi veya süper yönetici yalnızca başlık ve açıklamayı güncelleyebilir.
- Etkinlik düzenleme canlı testi tamamlandı: başlık/açıklama kaydı, sayfa yenileme sonrası kalıcılık ve İptal davranışı doğrulandı.
- Etkinlik düzenleme tarih adımı tamamlandı: planlama, hazırlık başlangıcı, tahmini ve kesinleşmiş tarihler güncellenebilir.
- Etkinlik düzenleme tarih canlı testi tamamlandı: tarih kaydı, boş tarihi `null` yapma ve sayfa yenileme sonrası kalıcılık doğrulandı.
- Etkinlik detay görev listesi adımı tamamlandı: görev adı, durum, son tarih, öncelik ve atanan kişiler salt-okunur gösterilebilir.
- Etkinlik detay görev listesi canlı testi tamamlandı: görevi olmayan etkinlikte beklenen boş liste mesajı gösterildi.
- Etkinlik görev oluşturma adımı tamamlandı: etkinlik sahibi veya süper yönetici görev adı, açıklama, son tarih ve öncelik girerek görev oluşturabilir.
- Etkinlik görev oluşturma canlı testi tamamlandı: görev kaydı, başarı mesajı ve kayıt sonrası liste yenileme doğrulandı.
- Görev önceliği etiket düzeltmesi tamamlandı: `low`, `normal`, `high`, `urgent` değerleri Türkçe gösteriliyor.
- Görev atama yönetimi adımı tamamlandı: aktif dönem üyeleri arasından ana sorumlu, destekleyen ve bilgilendirilen kişiler atanabilir veya kaldırılabilir.
- Görev atama canlı testi tamamlandı: ana sorumlu, destekleyen ve bilgilendirilen atama türleri; ikinci ana sorumlu engeli, ekleme/kaldırma ve sayfa yenileme sonrası kalıcılık doğrulandı.
- Görev durum güncelleme adımı tamamlandı: super_admin, etkinlik sahibi, ana sorumlu ve destekleyen kişi mevcut durum seçeneklerinden seçim yaparak `progress_status` güncelleyebilir; bilgilendirilen ve atanmamış kullanıcılar salt-okunur görür.
- Görev durum güncellemesi canlıda test edildi: durum değişikliği başarıyla kaydedildi ve sayfa yenilemesinden sonra korundu. Supabase RLS, mevcut görev yazma trigger'ı ve migration yapısı değiştirilmedi.
- Görev notu kodu eklendi: yetkili kullanıcılar `tasks.notes` alanına not ekleyebilir, düzenleyebilir veya boşaltabilir; diğer kullanıcılar notu salt-okunur görür.
- Görev notu canlı testi tamamlandı: not ekleme, düzenleme, boşaltma ve sayfa yenileme sonrası kalıcılık doğrulandı.
- Görev düzenleme kodu eklendi: etkinlik sahibi ve `super_admin` görev adı, açıklama, son tarih ve önceliği güncelleyebilir; durum, not ve atamalar korunur. Lint/build başarılı, canlı görev düzenleme testi bekliyor.
- Görev yaşam döngüsü adımı tamamlandı: `super_admin` görevleri `deleted_at` ile pasifleştirebilir, pasif görevleri ayrı filtreyle görebilir ve yeniden aktifleştirebilir. Canlı pasifleştirme, gizleme, filtreleme ve geri alma testi başarılı; migration/RLS değişikliği yapılmadı.
- Görev bağımlılıkları altyapısı korunuyor ancak kullanıcı arayüzü feature flag ile gizlendi (`ENABLE_TASK_DEPENDENCY_UI = false`); mevcut görev akışını sade tutuyoruz. Migration/RLS ve veritabanı modeli silinmedi.
- Ana sayfa dashboard'ı kodlandı: aktif etkinlik/açık görev/bana atanan açık görev/geciken görev özetleri, bana atanan görevler, geciken ve yaklaşan görevler, son etkinlikler ve hızlı erişim bağlantıları gösteriliyor.
- Dashboard verileri aktif dönem ve aktif üyelikle sınırlandırılıyor; görev ve etkinlikler pasif/silinmiş kayıtları dışlıyor. Etkinlik ve görev durum etiketleri veritabanından okunuyor.
- Dashboard kod incelemesinde Gemini teslimindeki `any` kullanımı düzeltildi; lint, TypeScript/Vite build ve `git diff --check` başarılı. Canlı dashboard testi tamamlandı: gerçek etkinlik/görev verileri ve görev sayıları doğrulandı.
- Uygulama içi bildirim alanı kodlandı: kullanıcıya ait `in_app` bildirimleri listeleniyor, okunmamış sayısı gösteriliyor, bildirimler tek tek veya toplu olarak okundu işaretlenebiliyor ve ilişkili etkinlik detayına yönlendirme yapılıyor.
- Bildirim alanında yalnızca mevcut kullanıcının kayıtları sorgulanıyor; migration, RLS, auth, e-posta ve push teslimatı değiştirilmedi. Lint, TypeScript/Vite build ve `git diff --check` başarılı. Canlı bildirim testi tamamlandı: görev ataması ve etkinlik tarihi bildirimleri göründü; tekli ve toplu okundu işaretleme kalıcı olarak doğrulandı.
- PWA temel kurulumu eklendi: manifest, 192/512 SVG ikonları ve service worker kaydı mevcut. Service worker Supabase/auth ve yazma isteklerini cache'lemiyor; kullanıcı verisi offline cache'e alınmıyor. Lint, build ve diff kontrolleri başarılı; canlı telefona kurulum ve push bildirimi testi tamamlandı.
- Ana sayfa Hızlı Erişim bölümüne tüm kullanıcılar için `/app/ayarlar/sifre` adresine giden **Şifre değiştir** kartı eklendi. `AppHome.tsx` değişikliği lint/build kontrollerinden geçti ve GitHub’a gönderildi.
- `AppHome.tsx` mobil görünüm için iyileştirildi: dar ekranlarda başlık ve bildirim metinleri taşmıyor, özet kartları daha sıkı aralıklarla düzenleniyor, görev/etkinlik satırları gerektiğinde alt satıra geçiyor. Veri çekme, yetki, bildirim ve yönlendirme mantığı değiştirilmedi. Lint, build ve `git diff --check` başarılı; canlı mobil kontrol tamamlandı.
- Tek ekran kullanıcı oluşturma formu eklendi: Süper Yönetici, ad-soyad, kişisel e-posta, geçici şifre, koordinatörlük ve uygulama rolünü tek panelde girebilir. Bu ilk adım yalnızca form doğrulaması yapar; henüz Supabase hesabı veya üyelik oluşturmaz. Gerçek hesap oluşturma, service_role anahtarını tarayıcıya koymadan güvenli sunucu/Edge Function adımında bağlanacaktır.
- Güvenli kullanıcı oluşturma Edge Function kodu eklendi: `supabase/functions/create-user/index.ts`. Fonksiyon aktif Süper Yönetici oturumunu doğrular, aktif koordinatörlüğü kontrol eder, Auth hesabı ve dönem üyeliği oluşturur; üyelik eklenemezse Auth hesabını geri alır. Supabase projesine deploy edildi ve `AdminMembers.tsx` formuna bağlandı. İlk canlı denemede genel bir non-2xx hata görüldü; arayüz gerçek hata gövdesini gösterecek şekilde güncellendi. Hata `Geçersiz oturum` olarak ayrıştırıldı; function, oturumu service-role ile token üzerinden doğrulayacak şekilde düzeltildi ve yeniden deploy edildi. Canlı yeni kullanıcı oluşturma testi tekrar bekleniyor.
- Durum, SKS, mekân ve sonraki işlem alanları bu adımda düzenlenemez.
- Kararlar için `event_decisions` tablosu, aktif üye okuma politikası, etkinlik sahibi/süper yönetici yazma yetkisi, dönem kilidi ve audit kaydı migration olarak eklendi. Etkinlik detayında karar listeleme, ekleme, düzenleme, pasifleştirme ve pasif kararı yeniden aktifleştirme ekranı `EventDetail.tsx` içine eklendi. Pasif kararlar varsayılan listede gizlidir; yetkili kullanıcı `Pasif kararları göster` seçeneğiyle görüp geri alabilir. Lint, build ve `git diff --check` başarılı; canlı geri aktifleştirme testi bekleniyor.
- Etkinlik genel notu `events.general_note` alanına bağlandı. Etkinlik sahibi ve süper yönetici not ekleyebilir/düzenleyebilir; diğer aktif üyeler notu okuyabilir. Boş bırakıldığında not `null` olarak saklanır. Lint, build ve `git diff --check` başarılı; canlı ekleme/düzenleme testi bekleniyor.
- Faz 2 / Adım 1 veritabanı altyapısı tamamlandı: `event_reports`, `event_links` ve `event_files` metadata tabloları; aktif üyelik RLS politikaları; dönem kilidi; geri alınabilir pasifleştirme; audit kayıtları; event/task ilişki kısıtları ve 5 MB dosya sınırı eklendi.
- `20260808110000_add_reports_links_files.sql` migration'ı uzak Supabase projesine uygulandı ve migration geçmişi yerel/uzak olarak eşitlendi.
- Canlı Supabase transaction/rollback testleri başarılı oldu: rapor ve bağlantı audit kayıtları, 5 MB sınırı, ilişki kısıtları ve kilitli dönem yazma engeli doğrulandı. Test verileri rollback ile kalıcı bırakılmadı.
- Bu adımda Storage bucket/upload akışı ve frontend ekranları eklenmedi; yalnızca veritabanı metadata altyapısı hazırlandı.
- SKS süreç ekranı `EventDetail.tsx` içine eklendi: durumlar veritabanından okunuyor; aktif dönem üyeleri Ana Sorumlu, Destekleyen ve Bilgilendirilen olarak atanabiliyor. Durum değişikliği yalnızca süper yönetici veya SKS ana sorumlusuna, ekip yönetimi ise süper yönetici, etkinlik sahibi veya SKS ana sorumlusuna açılıyor. Aynı kişi bir SKS etkinliğinde yalnızca tek sorumluluk türünde yer alabiliyor; aktif Genel Sekreter ana sorumlu için varsayılan olarak öneriliyor. Lint, build ve `git diff --check` başarılı; canlı SKS yetki ve kilitli dönem testi bekleniyor.
- Bütçe altyapısı ve ekranı eklendi: `budget_statuses`, tahmini/onaylanan bütçe, gerçekleşen harcama ve bütçe notu alanları; Sayman varsayılan adaylığı; bütçe ekibi ve alan düzenleme akışı. Etkinlik sahibi bütçe alanlarına yazamaz; yalnızca bütçe süreç Ana Sorumlusu ve süper yönetici yazabilir. Remote Supabase migration’ı uygulandı, sütunlar/durumlar/policy/trigger doğrulandı. Lint, build ve `git diff --check` başarılı; canlı bütçe yetki, negatif tutar ve kilitli dönem testi bekleniyor.
- Bütçe kartının altına Sponsorlar bölümü eklendi: sponsor adı, tutar, not, ekleme/düzenleme, pasifleştirme ve yeniden aktifleştirme. Aktif üyeler sponsorları okuyabilir; yalnızca bütçe Ana Sorumlusu ve Süper Yönetici değiştirebilir. `event_budget_sponsors` migration’ı remote Supabase’e uygulandı; tablo, RLS policy’leri ve audit/dönem kilidi trigger’ları doğrulandı. Lint, build ve `git diff --check` başarılı; canlı sponsor ve bütçe testleri bekleniyor.
- Etkinlik durum grupları eklendi: Tasarım / Duyuru için `Gerekli Değil`, `Brief Bekliyor`, `Tasarımda`, `Revize`, `Hazır`, `Paylaşıldı`; Rapor durumu için `Hayır`, `Hazırlanıyor`, `Evet`. Alanlar etkinlik detayında okunuyor ve yetkili kullanıcılar tarafından güncellenebiliyor. `20260809060000_add_event_status_groups.sql` ve tasarım/duyuru yetkisini süreç sorumlusuna bağlayan `20260809061000_fix_event_design_status_permissions.sql` migration’ları uzak Supabase’e uygulandı. Tasarım/Basın-Yayın ana sorumlusu veya Süper Yönetici Tasarım / Duyuru durumunu; etkinlik sahibi veya Süper Yönetici Rapor durumunu değiştirebilir. Lint, build ve `git diff --check` başarılı; canlı durum ve dönem kilidi testi bekleniyor.
- Görev bağımlılıkları için mevcut veritabanı altyapısı korunuyor ancak arayüz, ihtiyaç netleşene kadar ertelendi.

Bu görev şunları **kapsamaz**:

- Yeni dönem oluşturma
- Kullanıcıya e-posta daveti gönderme
- Migration/RLS değişikliği
- Etkinlik, görev veya bildirim ekranları

Üyelik yönetimi Adım 1–3 ve etkinlik listeleme kod/derleme düzeyinde doğrulanmış, ilk süper yönetici ataması ve yönetici ekranının canlı açılışı test edilmiştir. İkinci kullanıcı ekleme testi, Supabase’in yerleşik e-posta sağlayıcısındaki hız sınırı nedeniyle beklemededir. Etkinlik oluşturma, etkinlik detayının durum/tarih-süreç bilgileri ve başlık/açıklama/tarih düzenleme akışları canlıda doğrulanmıştır.

## Son teknik değişiklikler

- Cloudflare Pages'in eski `_redirects` kuralını döngü riskiyle yok saydığı canlı derleme logunda görüldü.
- `public/_redirects` dosyası kaldırıldı.
- Cloudflare Pages'in otomatik SPA geri dönüşü, `/auth/callback` adresinde canlı olarak doğrulandı.
- Bu düzeltme GitHub `main` dalına gönderildi ve Cloudflare otomatik yeniden yayın yapar.
- MUPSA logo SVG'si `public/mupsa-logo.svg` olarak eklendi. Giriş ekranındaki eski `+` simgesi ve ana ekran başlığındaki logo alanı bu dosyayı kullanıyor. Supabase, auth, yetki ve veri akışları değiştirilmedi; lint, build ve `git diff --check` başarılı.
- PWA uygulama ikonları (`public/icon-192.svg` ve `public/icon-512.svg`) siyah arka plan ve MUPSA logosu kullanacak şekilde güncellendi; manifest arka planı da siyah yapıldı. Lint, build ve `git diff --check` başarılı.
- Kararlar altyapısı `20260808100000_add_event_decisions.sql` migration'ı ve `supabase/tests/event_decisions_scenarios.md` senaryo dosyasıyla eklendi. Migration uzak Supabase projesine uygulandı ve `supabase migration list` ile doğrulandı. `EventDetail.tsx` karar ekranı uzak şemaya bağlandı; canlı ekleme/pasifleştirme testi yapıldı, yeniden aktifleştirme testi bekleniyor.
- Rapor, bağlantı ve dosya metadata altyapısı `20260808110000_add_reports_links_files.sql` migration'ı ve `supabase/tests/reports_links_files_scenarios.md` senaryo dosyasıyla eklendi. Migration uzak Supabase projesine uygulandı; canlı rollback testleri başarılı oldu.
- Dosya Storage altyapısı `20260809010000_add_event_files_storage.sql` migration'ı ile eklendi. `event-files` bucket'ı private, 5 MB limitli ve Storage RLS policy'leri gerçek aktif etkinlik path'ini doğrulayacak şekilde canlı Supabase'e uygulandı.
- Etkinlik raporları, bağlantıları ve dosya ekranları `EventDetail.tsx` içine eklendi. Aktif kullanıcıların okuma, yetkili kullanıcıların ekleme/düzenleme/pasifleştirme akışları canlıda test edildi; dosya yükleme, indirme, 5 MB sınırı ve soft-delete kontrolleri başarılı.
- Safari favicon sorunu için `public/favicon.png` ve iOS/PWA PNG ikonları eklendi; giriş arka planlarının responsive görselleri korunuyor. Lint, build ve `git diff --check` başarılı.
- Farkındalık Paylaşımları için `awareness_posts` altyapısı, 1 Temmuz dönem düzeltmesi, etkinliklerde 40 gün ve farkındalıklarda 14 gün otomatik hazırlık başlangıcı, RLS ve `AwarenessPosts.tsx` ekranı hazırlandı. `20260809040000_add_awareness_and_period_fixes.sql` migration’ı uzak Supabase’e uygulandı; canlı yetki/tarih/pasifleştirme testleri bekliyor. `npm run lint`, `npm run build` ve `git diff --check` başarılı.
- Takvim frontend ve veritabanı hazırlığı tamamlandı: mevcut etkinlik/farkındalık tarihleri tekrar kayıt oluşturulmadan takvimde gösteriliyor; manuel kayıtlar için `calendar_entries` tablosu, RLS, soft-delete ve audit eklendi. Görev son tarihleri `auth.uid()` kullanan `get_my_calendar_task_deadlines()` RPC'si üzerinden yalnızca primary ve supporting atanan kişilere gösteriliyor. `Calendar.tsx`, `/app/takvim` route'u ve ana sayfa bağlantısı eklendi. `20260810050000_add_calendar_entries.sql` uzak Supabase'e uygulandı ve local/remote migration eşleşti. Canlı takvim testinde etkinlik, farkındalık, görev, manuel kayıt ve ay geçişleri doğrulandı.
- Takvim görünümü düzeltildi: mevcut ay 6 haftalık ızgaraya tamamlanıyor; önceki/sonraki ay günleri ve bu günlere ait kayıt başlıkları soluk biçimde doğrudan takvim hücresinde gösteriliyor. Böylece Ağustos görünümünde 1 Eylül kaydı da görünür durumda. Lint, build ve `git diff --check` başarılı.
- Merkezi Görevler sayfası eklendi: `/app/gorevler` üzerinden etkinlik, farkındalık veya bağımsız görev oluşturma; aktif dönem üyelerine ana sorumlu/destekleyen/bilgilendirilen atama; arama, bağlı kayıt ve durum filtreleri; yetkili kullanıcıların durum güncellemesi hazırlandı. Süper Yönetici tüm bağlamlarda görev oluşturabilir; etkinlik sahibi yalnızca kendi etkinliklerine, farkındalık sorumlusu yalnızca yönettiği farkındalıklara görev açabilir.
- `20260810150000_add_central_tasks.sql` ile `tasks.period_id` ve `awareness_post_id` eklendi, mevcut görevler dönemlerine bağlandı, bağımsız görev modeli ve bağlam doğrulaması/RLS açıldı. Görev atama bildirimleri etkinliksiz görevlerde de çalışacak şekilde güncellendi. Takvim görev RPC'si bağımsız/farkındalık görevlerini de kapsıyor; bağımsız görevler takvimden `/app/gorevler` sayfasına yönleniyor. Migration uzak Supabase'e uygulandı; canlıda 2 mevcut görev dönem bağlantısıyla doğrulandı.
- Takvim görev görünürlüğü düzeltildi: `20260810070000_allow_supporting_task_calendar.sql` ile supporting atanan kişilerin de görev son tarihlerini görmesi sağlandı; informed, atanmamış kullanıcı, yalnızca etkinlik sahibi ve başka bir Süper Yönetici görmeye devam etmez.
- Kişisel rol bazlı dashboard güncellendi: koordinatörler anasayfada kendi görevlerini, sorumlu oldukları etkinlik/farkındalıkları ve kendilerine ait geciken işleri görür. Süper Yöneticiler aktif ekip üyesi, genel açık görev, atanmamış açık görev ve yaklaşan ekip sorumluluklarını görür. Mevcut RLS ve veritabanı şeması değiştirilmedi; `AppHome.tsx` lint/build/diff kontrollerinden geçti, canlı rol görünümü testi tamamlandı.
- Mobil Web Push teslim altyapısı eklendi: ana sayfadan cihaz aboneliği açma/kapatma, `public/sw.js` içinde bildirim gösterme ve bildirime tıklayınca etkinlik detayına yönlendirme hazırlandı. `20260810110000_queue_push_notifications.sql` mevcut `in_app` kuyruğundan `push` kaydı üretir; `supabase/functions/deliver-push-notifications/index.ts` güvenli teslim için Supabase'e deploy edildi. VAPID secret'ları Supabase'te tanımlandı, push teslimi için `pg_net` ve her dakikalık `pg_cron` zamanlaması kuruldu. Frontend public VAPID key'i ortam değişkeni veya güvenli public fallback ile kullanıyor. Gerçek telefon bildirimi için kullanıcının ana sayfadan bildirimleri açması ve cihaz izin testi bekliyor.
- Hesap ayarları ekranı eklendi: `/app/ayarlar` altında hesap bilgileri, dönem görünen adı, rol, mobil bildirim açma/kapatma, şifre değiştirme ve süper yönetici için ekip/yetki yönetimine geçiş bulunuyor. Ana sayfadaki mobil bildirim ve yönetim kartları bu sayfaya taşındı; ana sayfa özet ve çalışma akışlarına odaklandı. Görünen ad değişikliği dönem geçmişini korumak için mevcut süper yönetici yönetim modeliyle sınırlı tutuldu. Lint, build ve `git diff --check` başarılı.
- Süper Yönetici duyuruları eklendi: `/app/ayarlar` içindeki Yönetim bölümünden ayrı bir sayfa açmadan herkese, seçili koordinatörlüklere veya belirli kişilere duyuru gönderilebilir. Aktif Süper Yöneticiler her duyuruyu otomatik alır; isteğe bağlı ileri tarihli gönderim desteklenir. `admin_announcements` tablosu, `send_admin_announcement` güvenli RPC'si, RLS, audit ve bildirim/push kuyruğu bağlantısı `20260810130000_add_admin_announcements.sql` migration'ı ile uzak Supabase'e uygulandı. Gelecek zamanlı duyurular zamanı gelmeden uygulama içi listede görünmez ve push kuyruğuna teslim edilmez. Lint, build ve `git diff --check` başarılı.

### Dönem bazlı görünen kullanıcı adı — tamamlandı

Sabit kurumsal/kişisel Auth hesabı korunarak dönem bazlı görünen ad modeli uygulandı:

- Sabit kurumsal/kişisel Auth e-posta hesabı korunacak.
- Aynı profil farklı dönemlerde farklı görünen ad taşıyabilecek.
- Dönem görünen adı `period_memberships.period_display_name` alanında tutuluyor.
- Mevcut üyelikler `profiles.display_name` ile geriye dönük dolduruldu.
- Kullanıcı, profil veya Auth hesabı silinmiyor; dönem üyelikleri pasifleştiriliyor.
- Dönem görünen adını yalnızca Süper Yönetici değiştirebiliyor; kilitli dönem değiştirilemiyor.
- `useMembershipStatus`, AdminMembers, EventsList, EventDetail ve AwarenessPosts dönem üyeliği adını kullanıyor.
- `create-user` Edge Function yeni üyelikte dönem görünen adını dolduracak şekilde deploy edildi.
- `20260809050000_add_period_display_names.sql` migration’ı uzak Supabase’e uygulandı.
- `npm run lint`, `npm run build` ve `git diff --check` başarılı geçti.

## Kullanım talimatı — yeni yapay zekâ sohbeti

1. Önce `AI_BAGLAM.md` ve bu dosyayı yükle veya paylaş.
2. “Bu iki dosyayı oku, henüz kod yazma; anladığını kısa biçimde doğrula.” de.
3. Sonra yalnızca tek küçük görev ver.
4. Teslimde kaynak dosyaları içeren ZIP iste; ZIP'te `node_modules`, `dist` veya `.env.local` bulunmamalı.
5. ZIP teknik inceleme, entegrasyon, test ve GitHub işlemleri için ana teknik asistana verilir.
