import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /
  @Get()
  getHello() {
    return this.appService.getHello();
  }

  // GET /health  ← GitHub Actions Health Check에서 사용
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
