import type { RouterBuilder } from 'qwe';
import { PostsController } from './posts.controller.js';

export function configurePostsRouter(rb: RouterBuilder): void {
  rb.get('/', PostsController, 'list');
  rb.get('/:id', PostsController, 'getOne');
  rb.post('/', PostsController, 'create');
  rb.put('/:id', PostsController, 'update');
  rb.delete('/:id', PostsController, 'remove');
}
