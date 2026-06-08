import { computed, type Ref } from 'vue'

/**
 * Role labels shared by both Festival and FestivalSession contracts.
 * Both use the same OZ AccessControlEnumerable base with identical role hashes.
 */
export type ContractRole = 'ADMIN' | 'MANAGER' | 'VOLUNTEER'

/**
 * Derives UI capabilities from a set of roles on any contract (Festival or Session).
 * Contract-agnostic. The caller decides which contract address to load roles from.
 *
 * Hierarchy: ADMIN inherits MANAGER, MANAGER inherits VOLUNTEER.
 */
export function usePermissions(roles: Ref<ContractRole[]>) {
  const isAdmin = computed(() => roles.value.includes('ADMIN'))
  const isManager = computed(() => isAdmin.value || roles.value.includes('MANAGER'))
  const isVolunteer = computed(() => isManager.value || roles.value.includes('VOLUNTEER'))

  const hasAnyRole = computed(() => roles.value.length > 0)

  // Action-level capabilities
  const canEditMetadata = computed(() => isManager.value)
  const canEditCapacity = computed(() => isManager.value)
  const canCheckIn = computed(() => isVolunteer.value)
  const canManageRoles = computed(() => isAdmin.value)
  const canCancel = computed(() => isAdmin.value)

  return {
    isAdmin,
    isManager,
    isVolunteer,
    hasAnyRole,
    canEditMetadata,
    canEditCapacity,
    canCheckIn,
    canManageRoles,
    canCancel,
  }
}
