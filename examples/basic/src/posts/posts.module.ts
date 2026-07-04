import { createModule } from 'qwe';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { configurePostsRouter } from './posts.router.js';

export const postsModule = createModule('posts', (mod) => {
  mod.provider('postsService', PostsService);
  mod.controller(PostsController);
  mod.router('/posts', configurePostsRouter);
});
