# Troubleshooting

## GID=0 Required Error

**증상:**
```
WARNING! You should run the image with GID (Group ID) set to 0
```

**발견:** `docker logs airflow-airflow-scheduler-1`

**원인:** Airflow Docker 이미지는 OpenShift 호환성을 위해 GID=0(root 그룹)을 요구합니다. 모든 쓰기 권한 디렉토리가 GID=0으로 설정되어 있습니다.

**해결:**
```bash
# .env
AIRFLOW_GID=0
```

**참고:** [Airflow Entrypoint 문서](https://airflow.apache.org/docs/docker-stack/entrypoint.html#allowing-arbitrary-user-to-run-the-container)

**노트**
- Airflow는 OpenShift 환경과 호환되도록 만들어져 있음
    - OpenShift는 쿠버네티스 기반 '엔터프라이즈 컨테이너 오케스트레이션' 플랫폼
    - 그래서 보안을 위해 사용자가 랜덤 UID로 실행됨
    - 하지만 그 사용자는 항상 GID가 0이여야 함 (그것만 허용하는 구조)
---

## Plugin Import Error

**증상:**
```
ImportError: attempted relative import with no known parent package
```

**발견:** `docker logs airflow-airflow-init-1`

**원인:** Airflow plugins는 패키지 구조와 다르게 로드되어 relative import가 작동하지 않습니다.

**해결:** AirflowPlugin 클래스를 사용한 단일 파일로 통합

---

## Database: SQLite Instead of PostgreSQL

**증상:**
```
DB: sqlite:////opt/airflow/airflow.db
```

**발견:** `docker logs airflow-airflow-init-1 | grep -E "(db|DB)"`

**원인:** `airflow-init` 환경변수가 `AIRFLOW__DATABASE__SQL_ALCHEMY_CONN`을 상속받지 않아 기본값인 SQLite 사용

**해결:**
```yaml
airflow-init:
  environment:
    <<: *airflow-common-env  # 부모 환경변수 상속
```

---

## `db init` Deprecated

**증상:**
```
DeprecationWarning: `db init` is deprecated. Use `db migrate` instead
```

**발견:** `docker logs airflow-airflow-init-1`

**원인:** Airflow 2.7+부터 관심사 분리를 위해 `db init`이 `db migrate`와 `connections create-default-connections`으로 분리됨

**해결:**
```yaml
command:
  - airflow db migrate
  - airflow connections create-default-connections
```

---

## Airflow 3.x: `webserver` Command Removed

**증상:**
```
airflow command error: argument GROUP_OR_COMMAND: Command `airflow webserver` has been removed.
Please use `airflow api-server`
```

**발견:** `docker logs airflow-airflow-webserver-1`

**원인:** Airflow 3.0부터 `webserver` 명령어가 `api-server`로 변경됨

**해결:**
```yaml
# docker-compose.yaml
airflow-webserver:
  command: api-server  # webserver → api-server
```

---

## Airflow 3.x: Operator Import Deprecated

**증상:**
```
The `airflow.operators.python.PythonOperator` attribute is deprecated.
The `airflow.operators.email.EmailOperator` attribute is deprecated.
```

**발견:** `docker-compose exec airflow-scheduler python /opt/airflow/dags/your_dag.py`

**원인:** Airflow 3.0부터 operator들이 provider 패키지로 이동

**해결:**
```python
# Before
from airflow.operators.python import PythonOperator
from airflow.operators.email import EmailOperator

# After
from airflow.providers.standard.operators.python import PythonOperator
from airflow.providers.smtp.operators.smtp import EmailOperator
```

---

## Airflow 3.x: dag-processor Required

**증상:**
```
No data found  # DAG가 DB에 등록되지 않음
```

**발견:** `docker-compose exec airflow-scheduler airflow dags list`

**원인:** Airflow 3.0부터 standalone DAG processor가 필수. scheduler만으로는 DAG를 처리하지 않음

**해결:**
```yaml
# docker-compose.yaml에 추가
airflow-dag-processor:
  <<: *airflow-common
  command: dag-processor
  restart: always
  depends_on:
    airflow-init:
      condition: service_completed_successfully
```

---

## Airflow 3.x: 401 Unauthorized (SimpleAuthManager)

**증상:**
```
401 Unauthorized
Invalid credentials
```

**발견:** 
- 웹 UI 로그인 시도
- `docker logs airflow-airflow-init-1 | grep -E "(admin|user)"`
- `docker compose exec airflow-webserver airflow users list`

**원인:** 
Airflow 3.x 기본 인증 매니저는 `SimpleAuthManager`입니다. 
- `simple_auth_manager_users` 설정이 비어있으면 사용자가 정의되지 않음
- **Breeze**(Airflow 개발환경)에서만 admin 사용자가 자동 생성됨
- 일반 Docker 배포에서는 별도 설정 필요

**해결:**
```yaml
# docker-compose.yaml (개발 환경용 - 인증 없이 모두 admin)
environment:
  AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_ALL_ADMINS: "True"
```

또는 사용자 정의 방식:
```yaml
environment:
  AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_USERS: "admin:admin"
```
(비밀번호는 webserver 로그에서 확인)

**참고:** 
- [Simple Auth Manager 문서](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/auth-manager/simple/index.html)

---

## Airflow 3.x: `airflow users create` AttributeError

**증상:**
```
AttributeError: 'AirflowSecurityManagerV2' object has no attribute 'find_role'
```
(`airflow users create` CLI 실행 시)

**발견:** 
- `docker compose exec airflow-webserver airflow users create ...`
- `docker compose exec airflow-webserver airflow config get-value core auth_manager`
- 결과: `airflow.api_fastapi.auth.managers.simple.simple_auth_manager.SimpleAuthManager`

**원인:** 
`airflow users create`는 FabAuthManager용 CLI 명령어입니다. 현재 auth_manager가 SimpleAuthManager인 경우, DB 기반 사용자 관리를 하지 않아 `find_role` 메서드가 없습니다.

**해결:**
SimpleAuthManager 설정을 사용하세요 (위 "401 Unauthorized" 항목 참조)

**참고:** 
- [Simple Auth Manager 문서](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/auth-manager/simple/index.html)

---

## Airflow 3.x: UI에서 태스크 로그 로드 실패

**증상:**
```
Could not read served logs: Invalid URL 'http://:8793/log/dag_id=.../task_id=.../attempt=1.log': No host supplied
```

**발견:** 
- UI에서 태스크 클릭 → Logs
- `docker compose exec airflow-webserver airflow config list | grep log_server`

**원인:** 
Airflow 3.x에서 `worker_log_server_port`와 `trigger_log_server_port`가 기본 설정되지 않아 로그 서버 URL에 호스트가 누락됨. 태스크 실행은 성공하지만 UI에서 로그를 불러오지 못함.

**해결:**
```yaml
# docker-compose.yaml (로컬 개발용 - 파일에서 직접 로그 읽기)
environment:
  AIRFLOW__LOGGING__TASK_LOG_READER: "task"
```

또는 로그 서버 설정:
```yaml
environment:
  AIRFLOW__LOGGING__WORKER_LOG_SERVER_PORT: "8793"
```

**참고:** 
- [Airflow Logging Configuration](https://airflow.apache.org/docs/apache-airflow/stable/configurations-ref.html#logging)

---

## Airflow 3.x: LocalExecutor 태스크 실행 실패 (SIGKILL)

**증상:**
```
Process exited [supervisor] exit_code=<Negsignal.SIGKILL: -9>
Task execution failed.
airflow.sdk.api.client.ServerResponseError: Method Not Allowed
```

**발견:** 
- UI에서 태스크 상태: `up_for_retry` 또는 `failed`
- `docker logs airflow-airflow-scheduler-1 | grep -E "(SIGKILL|Method Not Allowed)"`
- 태스크 로그 파일이 비어있음 (실행조차 안 됨)

**원인:** 
Airflow 3.x Execution API 설정 문제:
1. **Execution API가 `/execution/` 경로에 마운트됨**
   - `http://airflow-webserver:8080` → `Method Not Allowed` (405)
   - `http://airflow-webserver:8080/execution/` → 정상 작동
2. **API 인증 토큰 불일치**
   - Supervisor가 Execution API 호출 시 JWT 토큰 사용
   - `api_auth.secret_key`가 모든 서비스에서 동일해야 함
3. **로그 서버 URL 호스트 누락**
   - `http://:8793/log/...` → "No host supplied"

**해결:**
```yaml
# docker-compose.yaml
environment:
  # Execution API URL에 /execution/ 경로 포함
  AIRFLOW__CORE__EXECUTION_API_SERVER_URL: "http://airflow-webserver:8080/execution/"
  # API 인증 키 (모든 서비스에서 동일해야 함, 64바이트 이상 권장)
  AIRFLOW__API_AUTH__SECRET_KEY: ${AIRFLOW_API_AUTH_SECRET_KEY:-test_secret_key_for_local_dev_minimum_64_chars_padding_xxxxxxxxxxxx}
  # 로그 서버 호스트
  AIRFLOW__LOGGING__LOG_SERVER_HOST: "airflow-scheduler"
```

**진단 방법:**
```bash
# Execution API 엔드포인트 확인
docker exec airflow-airflow-webserver-1 curl -s http://localhost:8080/execution/task-instances/test/run -X PATCH -d '{}'
# 응답: {"detail":"Invalid auth token: ..."} → URL은 맞음, 인증 문제

docker exec airflow-airflow-webserver-1 curl -s http://localhost:8080/task-instances/test/run -X PATCH -d '{}'
# 응답: {"detail":"Method Not Allowed"} → 잘못된 URL (execution/ 없음)
```

**노트:**

### 아키텍처 구조
```
Scheduler Container
├── SchedulerJob (Main Process)
├── LocalExecutor (Thread Pool)
│   └── Task Queue (multiprocessing.Queue)
└── Worker Threads
    └── supervise() 함수 실행 ← Supervisor 역할
        └── Task Runner subprocess (사용자 코드)
```

### Task Queue 위치
- **LocalExecutor**: Scheduler 프로세스 내부의 in-memory Queue (`multiprocessing.Queue`)
- **CeleryExecutor**: 외부 Redis/RabbitMQ
- **KubernetesExecutor**: Kubernetes API (Pod 생성 요청)
- LocalExecutor는 단일 머신에서만 동작하므로 메모리 큐 사용

### Supervisor란?
`supervise()` 함수는 Worker Thread 내부에서 실행되며 다음 역할을 수행:
1. Execution API 호출 (`POST /run`) → 실행 컨텍스트 획득
2. Task Runner subprocess 생성 (fork/exec)
3. Task Runner 모니터링 및 로그 수집
4. Execution API 호출 (`PATCH .../run`) → 결과 보고

### 태스크 실행 흐름 (LocalExecutor)
1. Scheduler → LocalExecutor → Task Queue
2. Worker Thread → `supervise()` 함수 실행
3. `supervise()` → Task Runner subprocess fork
4. **Task Runner → Execution API (`/execution/run`) 호출하여 실행 컨텍스트 요청**
5. Task Runner → 사용자 코드 실행
6. `supervise()` → Execution API에 결과 보고

`execution_api_server_url`이 틀리면 4번 단계에서 실패 → SIGKILL

---

## Airflow 3.x: Secret Key 설정 가이드

### 네 가지 Secret/JWT Key

Airflow 3.x에서는 **네 가지 key** 설정이 필요하며, 모든 컨테이너에서 동일해야 합니다:

| 설정 | 섹션 | 용도 | 미설정 시 |
|------|------|------|-----------|
| `api.secret_key` | `[api]` | UI 세션, CSRF 토큰, 데이터 암호화 | 각 컨테이너가 **랜덤 생성** |
| `api.jwt_secret` | `[api]` | REST API JWT 토큰 서명 | 각 컨테이너가 **랜덤 생성** |
| `api_auth.secret_key` | `[api_auth]` | Execution API 인증 (키 교환용) | 각 컨테이너가 **랜덤 생성** |
| `api_auth.jwt_secret` | `[api_auth]` | Execution API JWT 토큰 서명 | 각 컨테이너가 **랜덤 생성** |

---

### api 섹션 vs api_auth 섹션

| 섹션 | 대상 API | 사용자 |
|------|----------|--------|
| `api.*` | Core API (`/api/v2/*`) | 사용자/UI/CLI |
| `api_auth.*` | Execution API (`/execution/*`) | Task Runner (내부) |

- `api.*`: DAG 조회, 트리거 등 **사용자 요청** 인증
- `api_auth.*`: 태스크 실행, 상태 보고 등 **내부 통신** 인증

---

### JWT 토큰 검증 흐름

```
Task Runner                           Execution API Server
    │                                        │
    │  1. JWT 토큰 생성 (jwt_secret로 서명)    │
    │────────────────────────────────────────>│
    │                                        │
    │                              2. 서명 검증 (jwt_secret)
    │                              3. audience 클레임 검증
    │                                        │
    │  4. 응답 (검증 성공/실패)                │
    │<────────────────────────────────────────│
```

| 실패 지점 | 에러 메시지 | 원인 |
|-----------|-------------|------|
| 2. 서명 검증 | `Signature verification failed` | `api_auth.jwt_secret` 불일치 |
| 3. audience 검증 | `Audience doesn't match` | `api.jwt_secret` vs `api_auth.jwt_secret` 불일치 |

---

### 증상 1: Execution API JWT 인증 실패 (Signature)

**증상:**
```
airflow.sdk.api.client.ServerResponseError: Invalid auth token: Signature verification failed
```

**원인:** `api_auth.secret_key` 또는 `api_auth.jwt_secret` 불일치

---

### 증상 2: Execution API JWT 인증 실패 (Audience)

**증상:**
```
jwt.exceptions.InvalidAudienceError: Audience doesn't match
```

**원인:** `api.jwt_secret` 또는 `api_auth.jwt_secret` 불일치

JWT 토큰의 audience 클레임이 서로 다른 키로 서명되어 검증 실패

---

### 증상 3: UI 세션/CSRF 키 불일치 경고

**증상:**
```
!!!! Please make sure that all your Airflow components have the same 'secret_key' 
configured in '[api]' section
```

**원인:** `api.secret_key` 불일치

---

### 진단

```bash
# 모든 키 비교
docker exec airflow-airflow-webserver-1 airflow config get-value api secret_key
docker exec airflow-airflow-scheduler-1 airflow config get-value api secret_key

docker exec airflow-airflow-webserver-1 airflow config get-value api jwt_secret
docker exec airflow-airflow-scheduler-1 airflow config get-value api jwt_secret

docker exec airflow-airflow-webserver-1 airflow config get-value api_auth secret_key
docker exec airflow-airflow-scheduler-1 airflow config get-value api_auth secret_key

docker exec airflow-airflow-webserver-1 airflow config get-value api_auth jwt_secret
docker exec airflow-airflow-scheduler-1 airflow config get-value api_auth jwt_secret
```

모든 컨테이너에서 동일한 값이 나와야 합니다.

---

### 해결

**방법 1: 볼륨 삭제 후 재시작 (개발 환경)**
```bash
docker compose down -v  # 볼륨까지 삭제
docker compose up -d
```

**방법 2: 운영 환경 - 네 가지 키 모두 명시 설정**
```yaml
# docker-compose.yaml
environment:
  AIRFLOW__API__SECRET_KEY: ${AIRFLOW_API_SECRET_KEY}
  AIRFLOW__API__JWT_SECRET: ${AIRFLOW_API_JWT_SECRET}
  AIRFLOW__API_AUTH__SECRET_KEY: ${AIRFLOW_API_AUTH_SECRET_KEY}
  AIRFLOW__API_AUTH__JWT_SECRET: ${AIRFLOW_API_AUTH_JWT_SECRET}
```
```bash
# .env
AIRFLOW_API_SECRET_KEY=your_api_secret_key_minimum_32_chars
AIRFLOW_API_JWT_SECRET=your_api_jwt_secret_minimum_32_chars
AIRFLOW_API_AUTH_SECRET_KEY=your_auth_secret_key_minimum_64_chars
AIRFLOW_API_AUTH_JWT_SECRET=your_auth_jwt_secret_minimum_64_chars
```

**노트:**
- 모든 키는 32바이트 이상 권장 (64바이트 권장: SHA512용)
- 최초 배포부터 설정하면 재시작해도 동일한 키 사용
- PostgreSQL 데이터는 `postgres-db-volume`에 영속화됨
- **실행 흐름**: Task Runner → Execution API 인증(JWT) → 인증 실패 → SIGKILL → `up_for_retry`

**참고:** 
- [Airflow API Configuration](https://airflow.apache.org/docs/apache-airflow/stable/configurations-ref.html#api)
- [Airflow API Auth Configuration](https://airflow.apache.org/docs/apache-airflow/stable/configurations-ref.html#api-auth)

---

**참고:** 
- [Airflow 3.x Architecture](https://airflow.apache.org/docs/apache-airflow/3.0.0/core-concepts/overview.html)
- [Upgrading to Airflow 3](https://airflow.apache.org/docs/apache-airflow/3.0.0/installation/upgrading_to_airflow3.html)
