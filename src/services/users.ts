import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/types'

export const usersService = {
  async list(): Promise<UserRecord[]> {
    return await pb.collection('users').getFullList<UserRecord>({
      sort: 'name',
    })
  },
}
