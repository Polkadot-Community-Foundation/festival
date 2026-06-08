import { computed, type Ref } from 'vue'
import { usePermissions as useBasePermissions, type ContractRole } from '@festival/shared/permissions'

/** Backward-compatible alias. Admin code uses FestivalRole everywhere */
export type FestivalRole = ContractRole

/**
 * Admin-specific permissions: extends shared base with page-level visibility
 * and sidebar nav items.
 */
export function usePermissions(roles: Ref<FestivalRole[]>) {
  const base = useBasePermissions(roles)

  // Page-level visibility (admin SPA only)
  const canViewOverview = computed(() => base.hasAnyRole.value)
  const canViewCheckIn = computed(() => base.isVolunteer.value)
  const canViewAttendees = computed(() => base.hasAnyRole.value)
  const canViewSchedule = computed(() => base.isManager.value)
  const canViewMap = computed(() => base.isManager.value)
  const canViewSessions = computed(() => base.isManager.value)
  const canViewAnnouncements = computed(() => base.isManager.value)
  const canViewSettings = computed(() => base.isAdmin.value)

  // Extra admin-only capabilities
  const canEditPolicy = computed(() => base.isManager.value)
  const canToggleSessions = computed(() => base.isAdmin.value)
  const canCreateSession = computed(() => base.isManager.value)

  // Sidebar nav items filtered by role
  const navItems = computed(() => {
    const items: { to: string; label: string }[] = []

    if (canViewOverview.value) items.push({ to: '', label: 'Overview' })
    if (canViewCheckIn.value) items.push({ to: '/checkin', label: 'Check-In' })
    if (canViewAttendees.value) items.push({ to: '/attendees', label: 'Attendees' })
    // Map is listed above Schedule because schedule entries can reference
    // venue markers. Admins typically author the map first, then the program.
    if (canViewMap.value) items.push({ to: '/map', label: 'Map' })
    if (canViewSchedule.value) items.push({ to: '/schedule', label: 'Schedule' })
    if (canViewSessions.value) items.push({ to: '/sub-events', label: 'Sessions' })
    if (canViewAnnouncements.value) items.push({ to: '/announcements', label: 'Announcements' })
    if (canViewSettings.value) items.push({ to: '/settings', label: 'Settings' })

    return items
  })

  return {
    ...base,
    canViewOverview,
    canViewCheckIn,
    canViewAttendees,
    canViewSchedule,
    canViewMap,
    canViewSessions,
    canViewAnnouncements,
    canViewSettings,
    canEditPolicy,
    canToggleSessions,
    canCreateSession,
    navItems,
  }
}
