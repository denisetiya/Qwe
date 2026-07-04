import type { ExecutionContext } from 'qwe';
import { v, NotFoundException } from 'qwe';
import type { PostsService } from './posts.service.js';
import { createPostSchema } from './dto/create-post.schema.js';

export class PostsController {
  private postsService: PostsService;

  constructor(postsService: PostsService) {
    this.postsService = postsService;
  }

  list(ctx: ExecutionContext): void {
    const result = this.postsService.findAll();
    ctx.response.ok({
      success: true,
      data: result.data,
      total: result.total,
    });
  }

  getOne(ctx: ExecutionContext): void {
    const id = Number(ctx.request.params['id']);
    const post = this.postsService.findById(id);
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    ctx.response.ok({ success: true, data: post });
  }

  create(ctx: ExecutionContext): void {
    const parsed = v.parse(createPostSchema, ctx.request.body);
    const post = this.postsService.create(parsed);
    ctx.response.created({ success: true, data: post });
  }

  update(ctx: ExecutionContext): void {
    const id = Number(ctx.request.params['id']);
    const parsed = v.parse(createPostSchema.omit(['userId']), ctx.request.body);
    const post = this.postsService.update(id, parsed);
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    ctx.response.ok({ success: true, data: post });
  }

  remove(ctx: ExecutionContext): void {
    const id = Number(ctx.request.params['id']);
    const deleted = this.postsService.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    ctx.response.noContent();
  }
}
