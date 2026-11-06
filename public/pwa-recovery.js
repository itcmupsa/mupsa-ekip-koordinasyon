;(function () {
  const status = document.getElementById('status')
  const button = document.getElementById('repair')
  const diagnostics = document.getElementById('diagnostics')
  const pwa = window.MupsaPwa
  if (!pwa?.supported) {
    status.textContent = 'Bu ortamda uygulama güncellemesi yapılamıyor. Bağlantıyı normal Safari sekmesinde açıp tekrar dene.'
    return
  }

  function showInfo(info) {
    diagnostics.textContent = JSON.stringify({
      adres: location.origin,
      ortam: window.matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'Kurulu uygulama' : 'Tarayıcı',
      beklenenSurum: info.expectedVersion, etkinSurum: info.activeVersion ?? 'Doğrulanamadı',
      sayfayiYonetenSurum: info.controllerVersion ?? 'Doğrulanamadı',
    }, null, 2)
  }

  button.addEventListener('click', async () => {
    button.disabled = true
    status.textContent = 'Açılış bileşeni güncelleniyor…'
    try {
      const info = await pwa.repair()
      showInfo(info)
      status.textContent = info.controllerVersion === pwa.version
        ? 'Güncel açılış bileşeni doğrulandı. Şimdi Uygulamayı aç düğmesine basabilirsin.'
        : 'Güncel sürüm kuruldu; bu ekran hâlâ eski sürümde olabilir. Bu sekmeyi veya uygulamayı tamamen kapatıp tekrar aç.'
    } catch {
      status.textContent = 'Güncelleme doğrulanamadı. İnternet bağlantını değiştirip yeniden dene; hata sürerse kontrol bilgileriyle birlikte yöneticiye ilet.'
    } finally { button.disabled = false }
  })

  pwa.inspect().then(info => {
    showInfo(info)
    status.textContent = info.activeVersion === pwa.version
      ? 'Güncel açılış bileşeni bulundu. Sorun sürüyorsa Açılışı onar düğmesini kullanabilirsin.'
      : 'Telefondaki açılış sürümü doğrulanamadı. Açılışı onar düğmesiyle güncellemeyi dene.'
  }).catch(() => {
    status.textContent = 'Açılış sürümü kontrol edilemedi. Açılışı onar düğmesiyle yeniden dene.'
  }).finally(() => { button.disabled = false })
})()
