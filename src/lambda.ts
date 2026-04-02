/**
 * Lambda Function URL 전용 진입점
 *
 * 동작 원리:
 * 1. Lambda가 최초 실행될 때 NestJS 앱을 초기화 (콜드 스타트)
 * 2. 초기화된 앱을 serverless-express로 래핑
 * 3. 이후 모든 요청은 핸들러(handler)를 통해 처리
 * 4. Lambda 컨테이너가 살아있는 동안은 앱 재초기화 없이 재사용 (웜 스타트)
 */
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverlessExpress from '@vendia/serverless-express';
import { Context, Handler } from 'aws-lambda';
import express from 'express';
import { AppModule } from './app.module';

// 웜 스타트 최적화: 컨테이너가 살아있는 동안 재사용
let cachedHandler: Handler;

async function bootstrapLambda(): Promise<Handler> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(AppModule, adapter);

  // CORS 설정 (Function URL 직접 호출 또는 CloudFront 경유 모두 허용)
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  });

  await app.init();

  // NestJS 앱을 Lambda 이벤트 핸들러로 변환
  return serverlessExpress({ app: expressApp });
}

export const handler = async (event: any, context: Context, callback: any) => {
  // 콜드 스타트: 아직 핸들러가 없으면 초기화
  if (!cachedHandler) {
    console.log('[Lambda] 콜드 스타트 - NestJS 앱 초기화 중...');
    cachedHandler = await bootstrapLambda();
    console.log('[Lambda] NestJS 앱 초기화 완료');
  } else {
    console.log('[Lambda] 웜 스타트 - 기존 앱 재사용');
  }

  return cachedHandler(event, context, callback);
};
