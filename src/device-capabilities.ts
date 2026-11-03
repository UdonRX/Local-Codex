export interface DeviceCapabilities {
  userAgent: string; platform: string; isIOS: boolean; isStandalone: boolean;
  secureContext: boolean; webGPU: boolean; sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean; wasm: boolean; wasmSimd: boolean;
  hardwareConcurrency: number | null; deviceMemoryGB: number | null;
  storageQuotaGB: number | null; storageUsageGB: number | null;
}

export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  let storageQuotaGB: number | null = null;
  let storageUsageGB: number | null = null;
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      storageQuotaGB = estimate.quota ? estimate.quota / 1024 ** 3 : null;
      storageUsageGB = estimate.usage ? estimate.usage / 1024 ** 3 : null;
    }
  } catch { /* optional browser capability */ }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const wasmSimd = (() => {
    try {
      // A minimal module using i8x16.splat; validate() returns false without SIMD support.
      return WebAssembly.validate(new Uint8Array([
        0,97,115,109,1,0,0,0,
        1,5,1,96,0,1,123,
        3,2,1,0,
        10,10,1,8,0,65,0,253,15,11
      ]));
    } catch { return false; }
  })();

  return {
    userAgent: navigator.userAgent, platform: navigator.platform, isIOS,
    isStandalone: window.matchMedia('(display-mode: standalone)').matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    secureContext: window.isSecureContext,
    webGPU: Boolean((navigator as Navigator & { gpu?: unknown }).gpu),
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    crossOriginIsolated: window.crossOriginIsolated === true,
    wasm: typeof WebAssembly !== 'undefined', wasmSimd,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemoryGB: nav.deviceMemory ?? null, storageQuotaGB, storageUsageGB
  };
}
