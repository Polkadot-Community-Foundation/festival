export default defineNuxtPlugin(() => {
  // Initialize wallet store in all modes. Host or standalone.
  import('@festival/shared/host/wallet').then(({ useWalletStore }) => {
    useWalletStore()
  })
})
