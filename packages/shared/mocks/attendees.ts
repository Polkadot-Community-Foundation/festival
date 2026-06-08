export interface MockAttendee {
  address: string
  name: string
  isRegistered: boolean
  isCheckedIn: boolean
  ticketTokenId: number
  poapTokenId: number | null
}

export const MOCK_ATTENDEES: MockAttendee[] = [
  {
    address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    name: 'Alice',
    isRegistered: true,
    isCheckedIn: true,
    ticketTokenId: 1,
    poapTokenId: 1,
  },
  {
    address: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
    name: 'Bob',
    isRegistered: true,
    isCheckedIn: false,
    ticketTokenId: 2,
    poapTokenId: null,
  },
  {
    address: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y',
    name: 'Charlie',
    isRegistered: true,
    isCheckedIn: true,
    ticketTokenId: 3,
    poapTokenId: 2,
  },
]

export function useMockAttendees() {
  return {
    attendees: MOCK_ATTENDEES,
    isLoading: false,
    error: null as string | null,
  }
}
