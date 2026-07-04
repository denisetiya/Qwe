import type { RouterBuilder } from 'qwe';
import { UsersController } from './users.controller.js';

export function configureUsersRouter(rb: RouterBuilder): void {
  rb.get('/', UsersController, 'list');
  rb.get('/:id', UsersController, 'getOne');
  rb.post('/', UsersController, 'create');
  rb.put('/:id', UsersController, 'update');
  rb.delete('/:id', UsersController, 'remove');
}
