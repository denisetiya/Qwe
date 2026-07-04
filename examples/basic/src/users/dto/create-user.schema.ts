import { v } from 'qwe';

export const createUserSchema = v.object({
  name: v.string().min(1).max(100),
  email: v.string().email(),
  age: v.number().int().min(0).max(150),
});
