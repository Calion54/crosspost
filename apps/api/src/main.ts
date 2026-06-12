import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // `admin/queues` (dashboard Bull Board) est exclu du préfixe global : son
  // middleware est monté sur `/admin/queues`, et sans cette exclusion le module
  // calcule un basePath `/api/admin/queues` qui ne matche pas → 404.
  app.setGlobalPrefix('api', { exclude: ['admin/queues'] });
  // Parse les query params tableau (`?platforms[]=a&platforms[]=b` ou
  // `?platforms=a&platforms=b`) en arrays via qs. Sans ça, la clé `platforms[]`
  // n'est pas reconnue et les filtres tableau sont silencieusement ignorés.
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: string) => void;
  };
  expressApp.set('query parser', 'extended');
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 5174);
}
bootstrap();
