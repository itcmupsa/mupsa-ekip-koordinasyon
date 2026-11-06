/* Runs independently of React, Supabase and window.load, including on the recovery page. */
;(function () {
  const version = '2026-11-06.1'
  const workerUrl = `/sw.js?revision=${version}`
  const serviceWorker = navigator.serviceWorker
  const supported = Boolean(serviceWorker && window.isSecureContext)
  const refreshInterval = 5 * 60 * 1000
  let inFlight = null
  let lastAttempt = 0
  let lastAttemptSucceeded = false

  function update() {
    if (!supported) return Promise.reject(new Error('worker_unsupported'))
    if (inFlight) return inFlight
    lastAttempt = Date.now()
    lastAttemptSucceeded = false
    // Reuse the root registration (and its PushSubscription); never unregister or clear storage.
    inFlight = serviceWorker.register(workerUrl, { scope: '/', updateViaCache: 'none' })
      .then(registration => {
        if (registration.waiting) registration.waiting.postMessage({ type: 'MUPSA_SKIP_WAITING' })
        lastAttemptSucceeded = true
        return registration
      })
      .finally(() => { inFlight = null })
    return inFlight
  }

  function readVersion(worker) {
    if (!worker) return Promise.resolve(null)
    return new Promise(resolve => {
      const channel = new MessageChannel()
      const finish = value => {
        clearTimeout(timer)
        channel.port1.close()
        channel.port2.close()
        resolve(value)
      }
      const timer = setTimeout(() => finish(null), 1000)
      channel.port1.onmessage = event => {
        if (event.data?.type === 'MUPSA_WORKER_STATUS' && event.data.handlesFetch === false
          && typeof event.data.version === 'string') finish(event.data.version)
      }
      try { worker.postMessage({ type: 'MUPSA_WORKER_STATUS' }, [channel.port2]) }
      catch { finish(null) }
    })
  }

  function withTimeout(promise, milliseconds) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('worker_timeout')), milliseconds)
      promise.then(resolve, reject).finally(() => clearTimeout(timer))
    })
  }

  async function inspect() {
    if (!supported) return { supported: false, expectedVersion: version }
    const registration = await withTimeout(serviceWorker.getRegistration('/'), 5000)
    const [activeVersion, controllerVersion] = await Promise.all([
      readVersion(registration?.active), readVersion(serviceWorker.controller),
    ])
    return { supported: true, expectedVersion: version, activeVersion, controllerVersion }
  }

  async function repair() {
    const registration = await withTimeout(update(), 10000)
    // A forced retry also checks the server when register() returned an existing registration.
    await withTimeout(registration.update(), 10000)
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      if (await readVersion(registration.active) === version) {
        return { supported: true, expectedVersion: version, activeVersion: version,
          controllerVersion: await readVersion(serviceWorker.controller) }
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    throw new Error('worker_timeout')
  }

  window.MupsaPwa = { version, supported, inspect, repair }
  if (!supported) return

  function refresh() {
    if (document.visibilityState === 'hidden'
      || (lastAttemptSucceeded && Date.now() - lastAttempt < refreshInterval)) return
    void update().catch(() => { /* The normal page can still load if the update network is unavailable. */ })
  }
  // No automatic reload: an open form must not lose its draft during worker activation.
  void update().catch(() => {})
  window.addEventListener('pageshow', refresh)
  window.addEventListener('online', refresh)
  document.addEventListener('visibilitychange', refresh)
})()
