import { z } from 'zod';

export const inviteWarehouseMemberSchema = z.strictObject({
  email: z.email('Введите корректный email'),
});

export type InviteWarehouseMember = z.infer<typeof inviteWarehouseMemberSchema>;
