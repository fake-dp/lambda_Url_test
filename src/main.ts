/**
 * 로컬 개발 전용 진입점
 * Lambda 배포 시에는 lambda.ts 가 진입점으로 사용된다.
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`\n✅ 서버 실행 중!: http://localhost:${port}`);
  console.log(`   GET /        → Hello 응답`);
  console.log(`   GET /health  → Health check\n`);
}

bootstrap();
