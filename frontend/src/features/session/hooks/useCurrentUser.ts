import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../services/sessionService'

export const useCurrentUser = () =>
  useQuery({
    queryKey: ['session', 'me'],
    queryFn: ({ signal }) => getCurrentUser(signal),
  })
