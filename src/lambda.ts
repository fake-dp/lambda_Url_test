/**
 * Lambda Function URL 전용 진입점 (Node.js 24 호환)
 *
 * serverless-http v3는 async/await를 네이티브 지원하여 Node.js 24와 호환됩니다.
 */
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import serverlessHttp = require('serverless-http');
import { AppModule } from './app.module';

let cachedHandler: ReturnType<typeof serverlessHttp>;

async function bootstrapLambda() {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(AppModule, adapter);

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  });

  await app.init();

  // serverless-http: async 함수 반환 → Node.js 24 callback 문제 없음
  return serverlessHttp(expressApp);
}

export const handler = async (event: any, context: any) => {
  if (!cachedHandler) {
    console.log('[Lambda] 콜드 스타트 - NestJS 앱 초기화 중...');
    cachedHandler = await bootstrapLambda();
    console.log('[Lambda] NestJS 앱 초기화 완료');
  } else {
    console.log('[Lambda] 웜 스타트 - 기존 앱 재사용');
  }

  return cachedHandler(event, context);
};
