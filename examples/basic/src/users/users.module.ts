import { createModule } from 'qwe';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { configureUsersRouter } from './users.router.js';

export const usersModule = createModule('users', (mod) => {
  mod.provider('usersService', UsersService);
  mod.controller(UsersController);
  mod.router('/users', configureUsersRouter);
});
