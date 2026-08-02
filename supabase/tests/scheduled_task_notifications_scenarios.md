# Zamanlanmis gorev bildirimleri ve tarih bagimliligi testi

Bu senaryolar, `20260802190000_schedule_task_reminders_and_date_dependencies.sql` migration'i uygulandiktan sonra gercek Supabase test projesinde calistirilir. Zamanlanmis islerin beklenmesine gerek yoktur: ayni fonksiyonlar SQL Editor'den dogrudan cagrilarak gercek davranis kontrol edilir.

## 1. Geciken gorev: ilk bildirim ve 24 saat sonraki tek hatirlatma

1. Aktif, tamamlanmamis ve son tarihi gecmis bir gorev olusturulur.
2. Gorev sahibi, asil/destek atananlar, Baskan ve Super Yoneticilerin her birine uygulama ici + e-posta olmak uzere ilk `task_overdue` bildiriminin yazildigi dogrulanir.
3. Ilk bildirimlerin zamani test icin 25 saat geriye alinir; kontrol fonksiyonu yeniden calistirilir.
4. Ayni alicilar icin `24_hour_reminder` asamasinda ikinci ve son bildirimin olustugu dogrulanir.
5. Gorev tamamlanir; kontrol fonksiyonu tekrar calistirildiginda yeni gecikme bildirimi olusmadigi dogrulanir.

## 2. Yaklasan son tarih: 24 saat penceresi

1. Aktif ve tamamlanmamis, son tarihi sonraki 12 saat icinde olan bir gorev olusturulur.
2. Etkinlik sahibi ile gorevin asil/destek atananlarina `task_due_soon` bildirimlerinin uygulama ici + e-posta olarak yazildigi dogrulanir.
3. Fonksiyon ikinci kez calistirilir; ayni son tarih icin tekrar bildirim yazilmadigi dogrulanir.

## 3. Etkinlik tarihine bagli taslak gorev

1. Taslak bir goreve `event_date_offset` bagimliligi eklenir.
2. Kaynak etkinligin kesin tarihi varsa o tarih; kesin tarih yoksa tahmini tarihi kullanilarak esik gunun gelip gelmedigi kontrol edilir.
3. `offset_days = -14` degeri etkinlikten 14 gun onceyi ifade eder. Esik gelmis gorev Aktif olur ve aktif atananlarina `dependency_activated` bildirimleri yazilir.
4. Diger SKS veya gorev bagimliliklari henuz saglanmadiysa, tarih kosulu saglansa bile gorevin Taslak kaldigi dogrulanir.

## 4. Zamanlama kayitlari

1. `cron.job` icinde `mupsa-task-overdue-scan` kaydinin `*/15 * * * *` ile olustugu dogrulanir.
2. `mupsa-daily-task-and-date-scan` kaydinin `0 6 * * *` ile olustugu dogrulanir. Bu saat, Turkiye saatiyle 09.00'a karsilik gelir.
3. Is calisma kayitlarinin Supabase dashboardundaki cron gorunumunden izlenebildigi dogrulanir.
