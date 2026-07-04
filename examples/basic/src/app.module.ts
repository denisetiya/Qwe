import type { ModuleBuilder } from 'qwe';
import { usersModule } from './users/users.module.js';
import { postsModule } from './posts/posts.module.js';

export function appModule(mod: ModuleBuilder): void {
  mod.import(usersModule);
  mod.import(postsModule);
}
