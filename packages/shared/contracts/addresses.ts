/** Deployed festival contract addresses. Override via env vars. */

export const FESTIVAL_ADDRESS = ((import.meta as any).env?.VITE_FESTIVAL_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
export const FESTIVAL_POAP_ADDRESS = ((import.meta as any).env?.VITE_FESTIVAL_POAP_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
export const SUB_EVENT_POAP_ADDRESS = ((import.meta as any).env?.VITE_SUB_EVENT_POAP_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
export const MULTICALL_ADDRESS = ((import.meta as any).env?.VITE_MULTICALL_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
