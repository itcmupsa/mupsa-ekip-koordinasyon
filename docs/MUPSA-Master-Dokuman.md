# MUPSA Ekip Koordinasyon Uygulaması — Master Doküman (Sürüm 2)

## 🔄 Güncel Durum (her önemli adımda buradan güncellenir)

**Son güncelleme:** Faz 1 / Adım 1 tamamlandı ve gerçek Supabase Free projesinde uygulandı. Faz 1 / Adım 2'nin şu ana kadarki bildirim motoru; görev atama, SKS durum değişikliği, bağımlı görev aktivasyonu, etkinlik tarihi değişikliği, geciken görev ve yaklaşan son tarih kontrollerini uygulama içi/e-posta teslimat kuyruğuna yazar. SKS değişikliği, karar gereği etkinliğin dönemindeki tüm aktif ekibe gider. SKS, kaynak görev veya etkinlik tarihine bağlı taslak görevler, tüm yapılandırılmış koşulları sağlandığında Aktif olur ve atanmışlarına bildirim gider. Tarih bağımlılığı kesin tarihi, kesin tarih yoksa tahmini tarihi kullanır; görev tarihleri hiçbir durumda otomatik kaydırılmaz. Push altyapısı için, kullanıcının birden fazla cihaz/tarayıcı aboneliğini ayrı tutan `push_subscriptions` tablosu eklendi; teknik abonelik anahtarları audit geçmişine yazılmaz. Migration'lar; kullanıcı profilleri ve roller, dönemler, etkinlikler, görevler, çok kişili atamalar, yapılandırılmış bağımlılıklar, bildirim kuyruğu, dönem kilidi, geri alınabilir silme, audit geçmişi ve Row Level Security kurallarıyla gerçek veritabanında çalıştırıldı. Dönem üyeliğindeki rol, süper yönetici, aktif/pasif ve üyelik değişiklikleri de audit geçmişine girer. Tüm bu bildirim parçaları gerçek veritabanı işlemi içinde test edilip geri alındı; test kaydı bırakılmadı.

**Şu an neredeyiz:** Faz 1 / Adım 1 tamamlandı. Faz 1 / Adım 2'de “görev atandı”, “SKS durumu değişti”, “bağımlı görev aktifleşti”, “etkinlik tarihi değişti”, “görev gecikti” ve “görev son tarihi yaklaşıyor” kuralları, push abonelik altyapısı, `pg_cron` zamanlamaları ve ayrı test senaryoları eklendi; gerçek Supabase projesinde uygulama ve işlev testleri başarıyla tamamlandı. İlk migration'lar için Supabase CLI bağlantısı ve uzak migration geçmişi baseline senkronizasyonu da tamamlandı. E-posta/push kayıtlarını gerçek kanallara teslim edecek katman henüz yazılmadı.

**Henüz kurulmadı:** Canlı ortam değişkenleri, e-posta teslimat katmanı ve gerçek tarayıcı push gönderimi. Uygulama istemcisinin Faz 1 web temeli kuruldu: Vite + React + TypeScript + Tailwind CSS ile mobil uyumlu giriş, magic-link dönüşü ve korumalı uygulama kabuğu hazırdır; etkinlik/görev ekranları henüz yoktur.

**Yeni bir Claude/GPT sohbetine bu projeyi anlatman gerekirse:** bu dokümanı yükle + "MUPSA projesine devam ediyoruz, bu dokümanı oku, Güncel Durum bölümünden devam et" de. GitHub repo: `https://github.com/onndd/mupsa-ekip-koordinasyon`.

---

Bu doküman, önceki proje özetini ve GPT'nin hazırladığı "Nihai Ürün ve İşleyiş Raporu"nu birleştirip üzerinde anlaşılan tüm kararları tek bir referans haline getirir. Kodlamaya başlarken talimat dokümanı, kod geldikçe kontrol referansı olarak kullanılacaktır.

## 1. Ne inşa ediyoruz

MUPSA kulübü için, **sadece ekip içi kullanıma** açık, mobil uyumlu (PWA) bir ekip koordinasyon uygulaması. WhatsApp'ın yerini almayacak; WhatsApp'ta ve toplantılarda konuşulup kaybolan bilgiyi kalıcı hale getiren resmi kulüp çalışma hafızası olacak.

Excel dosyası (`MUPSA_2026-2027_ETKINLIK_VE_GOREV_TAKIP.xlsx`) veri kaynağı olarak **kullanılmayacak** — yalnızca hangi bilgilerin takip edilmesi gerektiğine dair referans oldu. Uygulama boş başlayacak.

## 2. Teknik Altyapı

| Katman | Seçim |
|---|---|
| Barındırma | Cloudflare Pages (ücretsiz) |
| Giriş / kimlik / rol / yetki | **Supabase Auth — tek ve ana giriş sistemi.** Sabit kurumsal veya kişisel e-posta hesabı kimlik olarak kullanılır; rol ataması ve kayıt bazlı yetkilendirme dönem üyeliği üzerinden yönetilir. |
| Veritabanı + Dosya | Supabase (ücretsiz katman: 500MB DB, 1GB depolama) |
| E-posta | Kulübün SMTP'si (Roundcube arkası) varsa o, yoksa Resend (ücretsiz, ayda 3000 mail) |
| Push bildirim | PWA Web Push — **baştan dahil**, ikinci aşamaya ertelenmiyor |
| Frontend | Vite + React + TypeScript + Tailwind CSS |
| Maliyet | 0 TL (opsiyonel: özel alan adı) |

**Basitleştirildi:** Kullanıcı deneyimini gereksiz zorlaştırmamak için Cloudflare Access **zorunlu ikinci giriş kapısı olarak kullanılmayacak.** Supabase Auth zaten kişisel hesaplı, gerçek bir giriş sistemi olduğu için tek başına yeterli. Cloudflare Access, istenirse ileride ek bir ağ güvenliği katmanı olarak ayrıca değerlendirilebilir, ama MVP'de yok.

**Bilinen kısıtlar:** Supabase ücretsiz proje 7 gün hareketsizlikte uyuyabilir. Düzenli otomatik istekle ("yoklama") bu risk azaltılmaya çalışılacak, ancak bu **kesin bir çözüm değildir** — Supabase düşük etkinlikte projeyi yine de duraklatabilir. Bu yüzden **düzenli (örn. aylık) yedek/dışa aktarma zorunlu** olacak. İlk sürümde bu şu şekilde çalışır: **IT veya Genel Sekreter, uygulama içindeki "Arşivi Dışa Aktar" butonuna basar → sistem Excel/PDF ve dosya listesini oluşturur → oluşturulan arşiv Drive'a manuel olarak yüklenir.** Tam otomatik Drive senkronizasyonu daha sonraki bir aşamada eklenebilir. Dosya başına üst sınır 5MB, sadece döküman formatları (PDF, DOCX, XLSX vb.) — görsel/tasarım dosyası yüklenmeyecek, büyük dosyalar harici link (Drive) olarak tutulacak.

## 3. Ekip Roster'ı (2026–2027 Dönemi)

| Koordinatörlük | Kişi |
|---|---|
| Başkan | Zehra Nur COŞKUN |
| Genel Sekreter | İrem Nur PULAŞ |
| Sayman | Halime YILICAK |
| EPSA İletişim Sekreteri | İrem DURMAZ |
| Twinnet Koordinatörü | Cennet Ceyda ÇABUK |
| Halkla İlişkiler Koordinatörü | Ezgi ÖZDÜZENCİLER |
| Halk Sağlığı Koordinatörü | Nisa YAŞAR |
| Proje ve Eğitim Koordinatörü | Şifa YILMAZ |
| Sosyal Etkinlik Koordinatörü | Ceylin ALÇI |
| Sosyal Sorumluluk Koordinatörü | Merve TOPRAK |
| Lojistik Koordinatörü | Nurhüda DURMUŞ |
| Basın Yayın Koordinatörü | Beyza ÇALIŞIR |
| Bilişim Teknolojileri Koordinatörü (IT, proje sahibi) | Numan ÖNDEŞ |
| Tasarım Koordinatörü | Nimet Sevda ASLAN |

## 4. Kayıt Türleri

1. **Etkinlik** — planlanan/yapılan/iptal edilen organizasyon
2. **Görev** — bir etkinliğin gerçekleşmesi için yapılması gereken iş
3. **Farkındalık Paylaşımı** — gün/hafta/ay bazlı sosyal medya içerikleri, etkinliklerden ayrı
4. **Karar** — "ne yapılacağını" değil "neyi, neden kararlaştırdığımızı" tutan ayrı kayıt türü
5. **Dönem Arşivi** — bir akademik döneme ait tüm kayıtların değiştirilemez geçmiş görünümü

## 5. Kullanıcı Hesap Modeli — KARARLAŞTIRILDI

**Sabit Auth hesabı + dönem bazlı görünen ad.** Koordinatörlüklerin kullandığı kurumsal e-posta hesabı dönemler arasında aynı kalabilir. Kişisel e-posta hesapları da aynı modelle kullanılabilir. E-posta, hesabın sabit kimliğidir; dönem içindeki ekranda görünen ad `period_memberships.period_display_name` alanından okunur.

**Giriş yöntemi:** Supabase Auth e-posta + şifre. Yalnızca yönetici tarafından oluşturulmuş veya davet edilmiş hesaplar giriş yapabilir; uygulama ekranı herkese açık hesap oluşturma sunmaz.

Gerekçe: kurumsal hesapların her yıl yeniden oluşturulması gerekmezken, geçmiş dönemlerde işlemi yapan kişinin o dönemdeki görünen adı korunur. Aynı hesabın aynı dönem içinde hangi gerçek kişi tarafından kullanıldığı ayrıca kanıtlanamaz; bu, kurumsal hesap kullanımının kabul edilmiş sınırlamasıdır. Kritik işlemler audit kayıtlarında hesap kimliği, dönem ve zaman bilgisiyle tutulur.

Süreç:
1. Başkan veya IT sabit Auth hesabını oluşturur ya da mevcut hesabı aktif döneme ekler.
2. Üyelik oluşturulurken o dönem için görünen ad girilir.
3. Aynı profil yeni dönemde tekrar kullanılacaksa yeni dönem için yeni `period_memberships` kaydı açılır ve yeni görünen ad yazılır.
4. Eski dönem üyeliği korunur ve dönem kapanınca pasifleştirilir; eski kayıtlar eski görünen adla okunur.
5. Kullanıcı/profil/Auth hesabı silinmez; üyelik yaşam döngüsü pasifleştirme ile yönetilir.

Bu planın uygulanması için `period_memberships.period_display_name` alanı, dönem bazlı adın yalnızca Süper Yönetici tarafından düzenlenmesi ve kişi adı sorgularının kayıt dönemine göre yapılması gerekir.

## 6. Yetkilendirme Modeli

- **Süper Yönetici** (Başkan + IT): her şeyi görür/düzenler; kullanıcı ve yetki yönetir, dönem açar/kapatır, arşiv dışa aktarır. **Silme, varsayılan olarak geri alınabilir olacak** — bir kayıt "silindi" denince gerçekten veritabanından kalkmaz, "Arşivden kaldırıldı / İptal edildi / Silinmiş olarak işaretlendi" gibi geri döndürülebilir bir duruma geçer. Süper Yönetici gerekirse **kalıcı silme** de yapabilir, ancak bu nadir ve istisnai bir işlem olarak kalmalı; bu işlem de kim/ne zaman yaptı bilgisiyle kayıt altına alınır.
- **Etkinlik Sahibi** (kaydı oluşturan, otomatik atanır): genel süreci yönetir, görev oluşturur/atar, not/karar/rapor ekler. **Ama:** SKS alanını Genel Sekreter'in (veya atanan SKS sorumlusunun) yerine değiştiremez; Bütçe alanını Sayman'ın yerine değiştiremez; Tasarım durumunu Tasarım Koordinatörü'nün yerine değiştiremez — genel süreci yönetmek, süreç sorumlularının kendi alanlarını devralmak anlamına gelmez.
- **Süreç Sorumlusu — SKS örneği (kesin kural):** Etkinlik sahibi etkinliği açar → SKS sorumlusu olarak Genel Sekreter veya başka yetkili biri atanır → **SKS sorumlusu, SKS sürecindeki diğer koordinatörleri kendisi seçer** ve başvuru/belge/durum güncellemelerini o yönetir → Başkan ve IT (Süper Yönetici) her durumda bu alana da müdahale edebilir. Diğer süreç sorumlulukları (Bütçe, Teknik, Tasarım, Basın/Yayın, Lojistik) da benzer şekilde yalnızca kendi alanını yönetir (örn. Sayman bütçeyi).
- **Görev Sorumlusu**: atandığı görevin durumunu günceller; bir görevde Asıl Sorumlu / Destekleyen / Bilgilendirilecek ayrımı olur
- **Tüm ekip**: her şeyi görüntüler (şeffaflık), yetkisi olmayanı değiştiremez

## 7. Bildirim Mantığı — KARARLAŞTIRILDI: Hedefli (Zincirleme), Toplu Değil

Bir durum değişikliği, **ilgisi olmayan herkese değil, sırası gelen kişi(ler)e** bildirim üretir.

**Örnek:** Bir etkinlikte 6 kişi görev alıyor. Genel Sekreter SKS onayını aldığında görevi biter. Bu onay, SKS'ye bağlı olarak "Taslak" bekleyen diğer 5 kişinin görevlerini otomatik "Aktif" durumuna geçirir ve **yalnızca o 5 kişiye** "artık sıra sende" bildirimi gider. Genel Sekreter'e veya işi bitmiş kişilere tekrar bildirim gitmez.

Teknik gereksinim: her görev/kayıt oluşturulurken **"neye bağlı/hangi durum değişince aktifleşsin"** alanı doldurulabilecek. **Bu alan serbest metin OLMAYACAK, yapılandırılmış/seçilebilir bir ilişki olacak** — örneğin: "Bu görev [şu kaydın] SKS onayına bağlı", "Bu görev [şu görevin] tamamlanmasına bağlı", "Bu görev etkinlik tarihinden [X] gün önce aktifleşir" gibi önceden tanımlı seçeneklerden biri seçilip ilgili kayda bağlanır. Aksi halde otomatik aktivasyon ve bildirim sistemi güvenilir çalışmaz.

Bildirim üretilecek olaylar: görev atandı, görev güncellendi, görev yaklaşıyor, görev gecikti, SKS durumu değişti, etkinlik tarihi değişti, etkinliğe yeni kişi eklendi, rapor eksik, link/belge eksik, etkinlik tamamlandı, **+ bağımlı görev/kayıt aktifleşti (zincirleme bildirim)**.

Şimdilik SKS durumu değiştiğinde bildirim, aktif dönemdeki tüm ekip üyelerine gönderilecektir.

Geciken görev bildirimi görev geciktiği anda gönderilir. Görev hâlâ tamamlanmadıysa 1 gün sonra tekrar gönderilir; görev tamamlandıysa ikinci bildirim gönderilmez.

**Not — bu, Faz 1'in en riskli parçasıdır.** Gerçek bağımlılık zincirleri (örn. Görev A → SKS onayına bağlı, Görev B → Görev A'nın tamamlanmasına bağlı, Görev C → etkinlik tarihinden 14 gün önce aktifleşir) karmaşık bir yapı gerektirir. Bu yüzden ilk modelde:
- Görevlerde **Aktivasyon (Taslak/Aktif)** ve **İlerleme (Başlanmadı/Devam ediyor/Beklemede/Tamamlandı/İptal)** ayrı iki alan olarak tutulacak (bkz. Bölüm 9)
- Bağımlılık alanı **yapılandırılmış/seçilebilir bir ilişki** olacak, serbest metin olmayacak
- **Otomatik aktivasyon zinciri** güvenilir şekilde test edilerek kademeli eklenecek — ilk sürümde elle aktifleştirme de her zaman mümkün olacak, yani otomatik tetikleme çalışmazsa sistem kilitlenmeyecek

Kanallar: **E-posta + uygulama içi bildirim, güvenilir temel kanallar olarak baştan çalışır.** Push bildirim altyapısı da ilk sürümde hazırlanacak, ancak çalışması kullanıcının "ana ekrana ekleme" adımını tamamlamasına, bildirim izni vermesine ve cihazın (iOS/Android farklı davranır) PWA koşullarına bağlıdır — yani push, herkes için anında garanti değildir, e-posta ve uygulama içi bildirim asıl güvenceyi sağlar.

Otomatik hatırlatmalar: ilk uygulanan günlük kural, sonraki 24 saat içindeki görev son tarihidir. Hazırlık başlangıcı ile rapor/link/belge eksikliği kuralları aynı zamanlama altyapısına daha sonraki bildirim adımlarında eklenecektir.

### 7.1 Bağımlılık İstisnaları — VARSAYILAN (onay bekliyor)

Bağımlı görev/kayıtlarda "beklenmeyen" durumlar için tek bir genel kural öneriyorum: **sistem hiçbir zaman otomatik olarak iptal etmez, sadece "gözden geçir" durumuna alıp ilgili kişiye bildirir — son kararı her zaman insan verir.** Somut karşılıkları:

- **Bağlı olunan görev iptal edilirse:** ona bağlı görev otomatik iptal olmaz, "Beklemede" durumuna alınır + bağlı görevin sorumlusuna "bağlı olduğun görev iptal edildi, durumu gözden geçir" bildirimi gider.
- **SKS reddedilirse:** SKS'ye bağlı görevler otomatik iptal olmaz, "Beklemede" durumuna alınır + etkinlik sahibine ve SKS sorumlusuna bildirim gider (yeniden başvuru mu, etkinlik iptali mi — bu insan kararı).
- **Etkinlik ertelenirse:** tarih bazlı görevlerin tarihi **otomatik kaymaz**; ilgili görev sorumlularına "etkinlik tarihi değişti, görev tarihini gözden geçir" bildirimi gider, tarihi kendileri günceller.

Bu, Başkan/ekiple netleşmemiş bir varsayım — istenirse (örn. "SKS reddedilirse bağlı görevler otomatik iptal olsun") değiştirilebilir, sadece ilk sürüm için güvenli/tutucu tarafta kalmayı öneriyorum.

### 7.2 Zamanlanmış Bildirim Kontrolleri — KARARLAŞTIRILDI

Zamanlanmış kontroller için uygulamanın ana altyapısındaki **Supabase Cron (`pg_cron`)** kullanılacak. Cron yalnızca veritabanındaki güvenli fonksiyonları çalıştırıp `notifications` kuyruğuna kayıt üretecek; e-posta ve push gönderimi ayrı bir teslimat katmanında yapılacak. Böylece bildirim üretimi ile gönderim hataları birbirinden ayrılır ve tekrar deneme güvenli yapılır.

- **Gecikme taraması:** Her 15 dakikada bir çalışır. Son tarihi geçen ve tamamlanmamış görev için ilk gecikme kaydını üretir; 24 saat sonra hâlâ tamamlanmamışsa, aynı görev için yalnızca bir kez ikinci hatırlatmayı üretir.
- **Günlük tarama:** Her gün Türkiye saatiyle **09.00**'da çalışır. Şimdilik sonraki 24 saat içindeki aktif görev son tarihlerini ve etkinlik tarihine bağlı taslak görevleri kontrol eder. Kesin tarih yoksa tahmini tarih kullanılır; `-14` gün değeri etkinlikten 14 gün önce anlamına gelir.
- Her tarama, benzersiz `dedupe_key` kullanır. Aynı olay aynı kişiye tekrar tekrar bildirilmez.
- Cron çalışmaları Supabase panelinden izlenebilir. Cloudflare Worker veya GitHub Actions, bu iş için ilk tercih değildir; sadece ileride harici sistem çağrısı ya da yedekleme otomasyonu gerekirse değerlendirilir.

## 8. Etkinlik Yaşam Döngüsü

Genel durum ile SKS durumu **ayrı** tutulur.

- **Genel durum:** Fikir → Planlanıyor → Kesinleşti → (Ertelendi/İptal) → Gerçekleşti → Raporlandı → Arşivlendi
- **SKS durumu:** Gerekli Değil / Başvuru Hazırlanıyor / Başvurusu Yapıldı / İnceleme/Beklemede / Revize İstendi / Onaylandı / Reddedildi
- **Tasarım / Duyuru durumu:** Gerekli Değil / Brief Bekliyor / Tasarımda / Revize / Hazır / Paylaşıldı
- **Rapor durumu:** Hayır / Hazırlanıyor / Evet. Bu alan rapor kaydının süreç durumudur; rapor metinleri ayrıca Raporlar bölümünde tutulur.

Etkinlikteki **Kesinleşti** durumu, etkinliğin planının veya tarihinin netleştiğini ifade eder; SKS onayı anlamına gelmez. SKS onayı ayrı olarak SKS durumundaki **Onaylandı** seçeneğiyle takip edilir. Kullanıcı ekranında açıklık için “Planı/Tarihi Kesinleşti” şeklinde gösterilebilir.

SKS onayı alınmadan etkinlik fiilen gerçekleştirilmiş/duyurulmuş sayılmaz.

## 9. Görev Sistemi

Alanlar: görev adı, açıklama, bağlı etkinlik, asıl sorumlu, destekleyen kişiler, bilgilendirilecek kişiler, sorumlu koordinatörlük, başlangıç/son tarih, öncelik, not, dosya/link, **bağımlılık (yapılandırılmış, bkz. Bölüm 7)**.

**Durum, iki ayrı boyutta tutulur (bunlar birbirini engellemez):**
- **Aktivasyon durumu:** Taslak → Aktif (bir görev "aktif" olabilir ama henüz kimse başlamamış olabilir)
- **İlerleme durumu:** Başlanmadı → Devam ediyor → Beklemede → Tamamlandı / İptal

Görevler aylar öncesinden "Taslak + Başlanmadı" olarak açılabilir, hazırlık zamanı gelince (elle veya bir bağımlılık tetiklemesiyle) "Aktif"e geçer; ilerleme durumu bundan bağımsız olarak ayrıca güncellenir.

## 10. Etkinlik Detay Sayfası (bölümler)

Genel Bilgiler · SKS Süreci · Sorumlular ve Ekip · Görevler · Kararlar · Raporlar · Notlar · Dosyalar · Linkler · Bütçe · Geçmiş ve Değişiklikler

## 11. Kişiye Özel Dashboard'lar

- **Başkan/IT:** tüm geciken görevler, SKS bekleyenler, dönem özeti, kullanıcı/yetki yönetimi, depolama kullanımı, eksik raporlar, sistem uyarıları
- **Etkinlik sahibi:** kendi etkinlikleri, atadığı görevler, bekleyen kararlar, eksik raporlar, yaklaşan tarihler
- **Genel Sekreter:** SKS bekleyen etkinlikler, revizyon bekleyenler, SKS görevleri, yaklaşan onay tarihleri
- **Tasarım:** tasarım bekleyen görevler, yaklaşan afiş tarihleri
- **Sayman:** bütçe bekleyen etkinlikler, harcama belgeleri, tahmini/gerçekleşen bütçe
- **Görev sorumlusu:** bana atanan görevler, yaklaşan/geciken deadline'lar

## 12. Dönem ve Arşiv Sistemi

Her kullanıcı bir dönemle ilişkilendirilir. Yeni dönemde eski kullanıcı pasifleşir, kayıtları korunur ve değiştirilemez hale gelir, yeni ekip okuyabilir. "Dönem Arşivini Dışa Aktar" özelliği: Excel (etkinlik/görev/farkındalık listeleri) + PDF dönem özeti + raporlar + karar geçmişi + dosya/link listesi. Veritabanı PostgreSQL olduğu için gerekirse ham dışa aktarım da mümkün.

## 12.1 Ek Netleştirmeler

- SKS onayı olmadan etkinlik **fiilen yapılamaz ve duyurulamaz** — bu kural sistemde zorlanacak (onaysız kayıt "tamamlandı" durumuna geçemez).
- SKS sorumlusu ile etkinlik sahibinin yetki ayrımı Bölüm 6'da tek ve kesin ifadeyle tanımlıdır.
- Taslak görevler başlangıçta atanıp hazırlık zamanı gelince aktifleştirilebilir (elle veya bağımlılık tetiklemesiyle).
- Geçmiş dönemin salt-okunur kalması için teknik bir **"dönem kilidi"** uygulanacak — dönem kapandığında o döneme ait kayıtlar normal kullanıcılar için düzenlemeye kapatılır. **İstisna: Başkan ve IT (Süper Yönetici) gerektiğinde kilitli bir dönemi geçici olarak açıp düzeltme yapabilir; bu işlem (kim, ne zaman, ne değiştirdi) sistemde kayıt altına alınır.**
- Dönem arşivi yalnızca etkinlikleri değil; görevleri, kararları, raporları, notları, linkleri ve belgeleri de kapsar.
- Kişisel e-posta adresleri diğer ekip üyelerine görünür olmak zorunda değildir (yalnızca sistem/giriş için kullanılır).
- Ortak kulüp e-postası yalnızca bildirim gönderici/kurtarma adresi olarak kullanılır, kullanıcı girişi için kullanılmaz.

## 13. Cevabı Bekleyen Açık Sorular

Aşağıdakiler Başkan ve ekiple netleşene kadar makul varsayılan değerlerle ilerlenecek, cevap geldiğinde güncellenecek (bu değişiklikler çoğunlukla ayar değişikliği seviyesinde, yeniden yazım gerektirmez):

**Başkanla:**
- Kararlar bölümüne kimler kayıt ekleyebilir/düzenleyebilir
- Dönem arşivi dışa aktarımından ve Drive'a koymaktan kim sorumlu
- Kişisel e-posta paylaşımı için ekipten ayrıca onay gerekiyor mu
- Kullanıcı pasifleştirme yetkisi yalnızca Başkan'da mı, IT tek başına da yapabilir mi

**Ekipten:**
- Hazırlıkta gerçekten hangi görevler tekrar ediyor (şablon için)
- Hangi görevler koordinatörlüğe, hangileri doğrudan kişiye atanmalı
- Aynı görevi birden fazla kişi yürüttüğünde sorumluluk nasıl paylaşılmalı
- Geçmiş etkinliklerde en çok hangi bilgi/belgeye tekrar ihtiyaç duyuldu
- Raporda/gelecek ekibe notta mutlaka olması gereken bilgiler
- Görev gecikince kaç gün sonra "gecikti" bildirimi gitsin
- Mobilde en çok hangi anda kullanılacak (toplantıda mı, yoldayken mi)

## 14. Şimdiye Kadar Üretilen Dosyalar

- `/mnt/user-data/outputs/index.html` — statik tasarım prototipi (gerçek roster işlenmiş, görsel dil belirlenmiş)
- Bu doküman — güncel master referans

## 15. Yapım Sırası — KARARLAŞTIRILDI: Yalnızca Geliştirme Sırası

**Önemli netleştirme:** Aşağıdaki fazlar ürün kapsamından hiçbir özelliği çıkarmaz. Bu yalnızca **geliştirme ve test sırasıdır** — ekip, tüm fazlar tamamlanıp uygulama eksiksiz hale gelmeden kullanmaya başlamayacaktır. Faz 1 bittiğinde "yayına alalım" denmeyecek; Faz 3 de bitene kadar geliştirme/test sürecine devam edilecektir.

1. **Faz 1 — Çekirdek:** hesap/rol sistemi (Supabase Auth), Etkinlik + Görev CRUD, hedefli bildirim motoru (e-posta + uygulama içi + push altyapısı), temel dashboard
2. **Faz 2 — Süreç derinliği:** SKS süreci, Kararlar bölümü, dosya/link yükleme, bütçe alanları
3. **Faz 3 — Kurumsal hafıza:** Dönem/arşiv sistemi + dönem kilidi, dışa aktarma, kişiye özel dashboard'lar, Farkındalık Paylaşımı takvimi, görev şablonları

Her faz tamamlandığında GPT'nin ürettiği kod bu dokümandaki kararlara göre kontrol edilecek, bir sonraki faza öyle geçilecektir.
