/**
 * Lambda Function URL 전용 진입점 (Node.js 24 호환)
 *
 * Node.js 24부터 callback 방식이 제거되어 async/await 방식으로 구현.
 * @vendia/serverless-express 대신 직접 express 앱을 호출하는 방식 사용.
 */
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Context } from 'aws-lambda';
import express, { Express } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';

let cachedApp: Express;

async function bootstrapLambda(): Promise<Express> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create(AppModule, adapter);

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  });

  await app.init();
  return expressApp;
}

function forwardRequestToExpress(
  expressApp: Express,
  event: any,
): Promise<any> {
  return new Promise((resolve) => {
    // Function URL 이벤트를 express req/res 형태로 변환
    const method = event.requestContext?.http?.method ?? 'GET';
    const path = event.rawPath ?? '/';
    const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
    const headers = event.headers ?? {};
    const body = event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body
      : undefined;

    const req = Object.assign(new IncomingMessage(null as any), {
      method,
      url: `${path}${query}`,
      headers,
    }) as any;

    if (body) {
      req.push(body);
      req.push(null);
    } else {
      req.push(null);
    }

    const chunks: Buffer[] = [];
    const res = Object.assign(new ServerResponse(req), {
      write: (chunk: any) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
      end: (chunk?: any) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const responseBody = Buffer.concat(chunks).toString('utf8');
        resolve({
          statusCode: (res as any).statusCode ?? 200,
          headers: (res as any).getHeaders?.() ?? {},
          body: responseBody,
        });
      },
    }) as any;

    expressApp(req, res);
  });
}

export const handler = async (event: any, context: Context) => {
  if (!cachedApp) {
    console.log('[Lambda] 콜드 스타트 - NestJS 앱 초기화 중...');
    cachedApp = await bootstrapLambda();
    console.log('[Lambda] NestJS 앱 초기화 완료');
  } else {
    console.log('[Lambda] 웜 스타트 - 기존 앱 재사용');
  }

  return forwardRequestToExpress(cachedApp, event);
};
