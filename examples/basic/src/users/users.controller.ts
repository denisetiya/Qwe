import type { ExecutionContext } from 'qwe';
import { v, NotFoundException } from 'qwe';
import type { UsersService } from './users.service.js';
import { createUserSchema } from './dto/create-user.schema.js';

export class UsersController {
  private usersService: UsersService;

  constructor(usersService: UsersService) {
    this.usersService = usersService;
  }

  list(ctx: ExecutionContext): void {
    const result = this.usersService.findAll();
    ctx.response.ok({
      success: true,
      data: result.data,
      total: result.total,
    });
  }

  getOne(ctx: ExecutionContext): void {
    const id = Number(ctx.request.params['id']);
    const user = this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    ctx.response.ok({ success: true, data: user });
  }

  create(ctx: ExecutionContext): void {
    const parsed = v.parse(createUserSchema, ctx.request.body);
    const user = this.usersService.create(parsed);
    ctx.response.created({ success: true, data: user });
  }

  update(ctx: ExecutionContext): void {
    const id = Number(ctx.request.params['id']);
    const parsed = v.parse(createUserSchema.partial(), ctx.request.body);
    const user = this.usersService.update(id, parsed);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    ctx.response.ok({ success: true, data: user });
  }

  remove(ctx: ExecutionContext): void {
    const id = Number(ctx.request.params['id']);
    const deleted = this.usersService.delete(id);
    if (!deleted) {
      throw new NotFoundException(`User ${id} not found`);
    }
    ctx.response.noContent();
  }
}
