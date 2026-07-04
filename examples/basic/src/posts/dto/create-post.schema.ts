import { v } from 'qwe';

export const createPostSchema = v.object({
  title: v.string().min(1).max(200),
  content: v.string().min(1),
  userId: v.number().int().positive(),
});
