# NestJS + Lambda Function URL 실습 프로젝트

NestJS 서버를 AWS Lambda Function URL로 배포하는 전체 흐름을 직접 경험하기 위한 실습용 프로젝트입니다.

---

## 프로젝트 구조

```
nestjs-lambda-practice/
├── src/
│   ├── main.ts          ← 로컬 개발 진입점 (node 서버로 실행)
│   ├── lambda.ts        ← Lambda 배포 진입점 (핵심!)
│   ├── app.module.ts
│   ├── app.controller.ts
│   └── app.service.ts
├── .github/
│   └── workflows/
│       └── deploy.yml   ← GitHub Actions 배포 파이프라인
├── .env.sample
├── package.json
└── tsconfig.json
```

---

## STEP 1. 로컬에서 먼저 실행해보기

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 파일 복사
cp .env.sample .env

# 3. 로컬 서버 실행
npm run start:dev
```

브라우저에서 확인:
- `http://localhost:3000` → Hello 응답
- `http://localhost:3000/health` → Health check 응답

---

## STEP 2. AWS 콘솔에서 Lambda 함수 만들기

### 2-1. Lambda 함수 생성

1. [AWS Lambda 콘솔](https://ap-northeast-2.console.aws.amazon.com/lambda) 접속
2. **함수 생성** 클릭
3. 옵션 선택:
   - 함수 이름: `nestjs-lambda-practice`
   - 런타임: `Node.js 22.x`
   - 아키텍처: `x86_64`
4. **함수 생성** 클릭

### 2-2. 핸들러 설정 변경

생성 후 **Configuration → General configuration → Edit**:
- 핸들러: `dist/lambda.handler`  ← 기본값인 `index.handler`에서 변경!
- 메모리: `512 MB`
- 타임아웃: `30초`

### 2-3. Function URL 활성화

**Configuration → Function URL → Create function URL**:
- Auth type: `NONE` (공개 접근, 인증은 NestJS에서 처리)
- CORS: 비활성화 (NestJS에서 처리)
- **저장** 후 생성된 URL 복사해두기

  예: `https://xxxxxxxxxxxxxxxx.lambda-url.ap-northeast-2.on.aws`

### 2-4. 환경 변수 등록

**Configuration → Environment variables → Edit**:

| 키 | 값 |
|----|-----|
| `NODE_ENV` | `production` |
| `APP_NAME` | `nestjs-lambda-practice` |
| `CORS_ORIGIN` | `*` (또는 특정 도메인) |

---

## STEP 3. GitHub Actions 배포 설정

### 3-1. GitHub 레포 생성 및 푸시

```bash
git init
git add .
git commit -m "feat: initial NestJS Lambda setup"
git remote add origin https://github.com/[본인계정]/nestjs-lambda-practice.git
git push -u origin main
```

### 3-2. GitHub Secrets / Variables 등록

레포 → **Settings → Secrets and variables → Actions**

**Secrets** (민감 정보):

| 이름 | 값 |
|------|-----|
| `AWS_ACCESS_KEY_ID` | IAM 사용자 Access Key |
| `AWS_SECRET_ACCESS_KEY` | IAM 사용자 Secret Key |

**Variables** (비민감 설정값):

| 이름 | 값 |
|------|-----|
| `AWS_REGION` | `ap-northeast-2` |
| `LAMBDA_FUNCTION_NAME` | `nestjs-lambda-practice` |
| `LAMBDA_FUNCTION_URL` | `https://xxxxxxxx.lambda-url.ap-northeast-2.on.aws` |
| `CORS_ORIGIN` | `*` |

### 3-3. IAM 사용자 권한 설정

배포용 IAM 사용자에 다음 권한 필요:
- `lambda:UpdateFunctionCode`
- `lambda:UpdateFunctionConfiguration`
- `lambda:GetFunction`
- `lambda:WaitFunctionUpdated` (내부적으로 `GetFunction` 사용)

최소 권한 IAM 정책 예시:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration"
      ],
      "Resource": "arn:aws:lambda:ap-northeast-2:[계정ID]:function:nestjs-lambda-practice"
    }
  ]
}
```

---

## STEP 4. 배포 실행

`main` 브랜치에 push하면 자동으로 GitHub Actions가 실행된다.

```bash
git push origin main
```

Actions 탭에서 진행 상황 확인:
1. Install dependencies
2. Build (TypeScript 컴파일)
3. Create deployment package (zip)
4. Update Lambda function code
5. Wait for Lambda update
6. Update Lambda environment variables
7. Health check

### 수동 실행도 가능

레포 → **Actions → Deploy to Lambda → Run workflow**

---

## STEP 5. 동작 확인

Function URL로 직접 요청:

```bash
# Function URL 복사 후 아래 명령 실행
FUNCTION_URL="https://xxxxxxxx.lambda-url.ap-northeast-2.on.aws"

# Hello 응답
curl $FUNCTION_URL

# Health Check
curl $FUNCTION_URL/health
```

Lambda 콘솔 → **Monitor → View CloudWatch logs** 에서 콜드 스타트/웜 스타트 로그 확인 가능

---

## 콜드 스타트 vs 웜 스타트 직접 확인

Lambda 콘솔 → Test 탭에서 연속으로 두 번 호출해보기.

CloudWatch Logs에서 아래처럼 차이를 확인할 수 있다:

```
# 첫 번째 요청 (콜드 스타트)
[Lambda] 콜드 스타트 - NestJS 앱 초기화 중...
[Lambda] NestJS 앱 초기화 완료

# 두 번째 요청 (웜 스타트, 컨테이너 재사용)
[Lambda] 웜 스타트 - 기존 앱 재사용
```

---

## 자주 발생하는 오류

### 핸들러를 찾을 수 없음

```
Error: Cannot find module 'index'
```

→ Lambda 콘솔에서 핸들러를 `dist/lambda.handler`로 변경했는지 확인

---

### 패키지 크기 초과 (50MB 제한)

```
Error: Unzipped size must be smaller than 262144000 bytes
```

→ `node_modules` 크기 문제. 아래처럼 S3 경유 방식으로 업로드:

```bash
# deploy.yml에서 update-function-code 부분을 아래로 교체

# 1. S3에 업로드
aws s3 cp deploy.zip s3://[버킷명]/nestjs-lambda-practice/deploy.zip

# 2. S3에서 Lambda 업데이트
aws lambda update-function-code \
  --function-name nestjs-lambda-practice \
  --s3-bucket [버킷명] \
  --s3-key nestjs-lambda-practice/deploy.zip
```

---

### CORS 오류

Function URL 콘솔의 CORS 설정과 NestJS CORS 설정이 충돌하는 경우.  
→ Function URL 콘솔의 CORS는 반드시 **비활성화**. NestJS 설정만 사용.

---

## 다음 단계 (실제 프로젝트 적용 시)

- [ ] Cron 작업은 EventBridge Scheduler + 별도 Lambda 핸들러로 분리
- [ ] 민감 환경 변수는 AWS Secrets Manager로 이관
- [ ] 커스텀 도메인 유지 시 CloudFront Distribution 앞단에 추가
- [ ] 콜드 스타트 개선이 필요하면 Provisioned Concurrency 검토
# lambda_Url_test
