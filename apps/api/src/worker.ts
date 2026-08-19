import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrapWorker() {
  const logger = new Logger('WorkerBootstrap');
  logger.log('👷 Starting AI Interview Practice BullMQ Worker process...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();

  const handleShutdown = async (signal: string) => {
    logger.log(`Received ${signal}, closing worker gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  logger.log(
    '✅ BullMQ Worker is active and listening for background jobs (Questions, Evaluations, Learning Paths).',
  );
}

bootstrapWorker().catch(err => {
  console.error('Fatal worker bootstrap error:', err);
  process.exit(1);
});
