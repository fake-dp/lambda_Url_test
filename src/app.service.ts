import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): object {
    return {
      message: 'Hello from NestJS on Lambda!',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV ?? 'unknown',
      appName: process.env.APP_NAME ?? 'nestjs-lambda-practice',
    };
  }

  getHealth(): object {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
