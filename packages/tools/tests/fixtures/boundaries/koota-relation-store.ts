import { relation } from 'koota'

export const Owes = relation({ exclusive: true, store: { amount: 0 } })
