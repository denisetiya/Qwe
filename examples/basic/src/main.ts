import { createApplication } from 'qwe';
import { appModule } from './app.module.js';
import { loggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { httpExceptionFilter } from './common/filters/http-exception.filter.js';

const app = createApplication({ port: 3000 });
app.module(appModule);
app.useInterceptor(loggingInterceptor);
app.useInterceptor(httpExceptionFilter);
await app.listen();
