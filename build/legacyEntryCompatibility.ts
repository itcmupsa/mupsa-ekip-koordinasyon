import type { Plugin } from 'vite'

// Older installed shells may still request an entry hash from a previous deployment.
// Only missing entry files use these aliases; existing hashed assets remain unchanged.
export function legacyEntryCompatibility(): Plugin {
  return {
    name: 'mupsa-legacy-entry-compatibility',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = Object.values(bundle)
      const entries = files.filter(file => file.type === 'chunk' && file.isEntry)
      const styles = files.filter(file => file.type === 'asset' && file.fileName.endsWith('.css'))
      if (entries.length !== 1 || styles.length !== 1) {
        this.error('Legacy entry compatibility expects one application entry and one stylesheet. Update the compatibility aliases before changing code splitting.')
      }
      this.emitFile({
        type: 'asset', fileName: '_mupsa/entry.js',
        source: `import ${JSON.stringify(`/${entries[0].fileName}`)};\n`,
      })
      this.emitFile({
        type: 'asset', fileName: '_mupsa/style.css',
        source: `@import url(${JSON.stringify(`/${styles[0].fileName}`)});\n`,
      })
    },
  }
}
