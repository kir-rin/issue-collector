# Local Airflow Testing Guide

## 사전 요구사항

- Docker, Docker Compose 설치
- `.env` 파일 설정:
  - `GITHUB_TOKEN`: GitHub API 인증
  - `OPENAI_API_KEY`: DSPy 최적화용
  - `SMTP_*`: 이메일 알림 (선택)

## 1. 환경 시작

```bash
cd prompt-optimizer/airflow
docker compose up -d
```

**확인:**
```bash
docker compose ps
```

모든 서비스가 `running` 상태여야 합니다:
- `airflow-postgres-1`
- `airflow-airflow-webserver-1`
- `airflow-airflow-scheduler-1`
- `airflow-airflow-dag-processor-1`

## 2. UI 접속

**URL**: http://localhost:8080

**확인 사항:**
- 인증 없이 메인 화면 진입 (SimpleAuthManager 설정)
- 상단 헤더에 사용자 정보 표시

## 3. DAG 목록 확인

**경로:** 홈 화면 → DAGs

**확인 사항:**

| 항목 | 기대값 |
|------|--------|
| DAG 이름 | `issue_score_optimizer` |
| 상태 | 활성화 (녹색 토글) |
| 스케줄 | `0 0 1,15 * *` (매월 1일, 15일) |
| Owner | `airflow` |

## 4. DAG 상세 확인

**경로:** DAG 이름 클릭 → Graph/Tree 뷰

**확인 사항:**
- 6개 태스크 표시:
  1. `collect_issues` - GitHub 이슈 수집
  2. `process_data` - 데이터 전처리
  3. `optimize_prompt` - DSPy GEPA 최적화
  4. `evaluate` - 결과 평가
  5. `save_results` - 결과 저장
  6. `send_email` - 이메일 알림
- 태스크 간 의존성 화살표 확인

## 5. DAG 수동 실행 (Trigger)

**경로:** 우측 상단 → ▶️ "Trigger DAG" 버튼

**기본 실행:**
- 설정 없이 바로 실행

**파라미터 포함 실행 (Configuration JSON):**
```json
{
  "owner": "apache",
  "name": "airflow",
  "budget": "light"
}
```

**파라미터 설명:**

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| `owner` | GitHub 저장소 소유자 | `apache` |
| `name` | GitHub 저장소 이름 | `airflow` |
| `budget` | 최적화 예산 (`light`/`medium`/`heavy`) | `medium` |

**확인 사항:**
- DAG Run이 생성되고 상태가 `Running` → `Success`로 변경
- 각 태스크가 순차적으로 실행됨

## 6. 태스크 로그 확인

**경로:** Graph 뷰 → 태스크 클릭 → Logs

**태스크별 로그 내용:**

| 태스크 | 로그에서 확인할 내용 |
|--------|---------------------|
| `collect_issues` | GitHub API 호출, 수집된 이슈 수 |
| `process_data` | 데이터 전처리 결과 |
| `optimize_prompt` | DSPy 최적화 진행 상황 (시간 소요) |
| `evaluate` | 평가 점수 |
| `save_results` | 저장된 파일 경로 |
| `send_email` | 이메일 발송 결과 |

## 7. XCom 데이터 확인

**경로:** Admin → XComs

**확인 사항:**
- 태스크 간 전달된 데이터
- `collect_issues` → 이슈 수, 저장 경로
- `evaluate` → 점수 결과

## 8. 출력 파일 확인

**경로:** `prompt-optimizer/airflow/data/{owner}_{name}/`

**디렉토리 구조 (실행 후):**
```
data/
└── apache_airflow/
    ├── raw_issues.json           # 수집된 원본 이슈
    ├── processed_data.json       # 전처리된 데이터
    ├── optimized_prompt.json     # 최적화된 프롬프트
    └── evaluation_results.json   # 평가 결과
```

## 9. 빠른 검증

**추천 설정 (Light Budget):**
```json
{
  "owner": "apache",
  "name": "airflow",
  "budget": "light"
}
```

**예상 소요 시간:**
- 전체 파이프라인: 5-10분
- `optimize_prompt` 제외 시: 1-2분

## 10. 문제 해결

| 증상 | 확인 방법 | 해결 |
|------|-----------|------|
| DAG가 안 보임 | Admin → Import Errors | DAG 파일 문법 확인 |
| 태스크 실패 | Graph → 실패한 태스크 → Logs | 에러 메시지 확인 |
| 스케줄러 문제 | `docker logs airflow-airflow-scheduler-1` | 로그 분석 |
| DAG 처리 안됨 | `docker logs airflow-airflow-dag-processor-1` | 로그 분석 |
| 401 Unauthorized | 웹 UI 로그인 실패 | TROUBLESHOOTING.md 참조 |

## 11. 환경 정리

```bash
docker compose down
```

**데이터 유지하며 정리:**
```bash
docker compose down --volumes  # 볼륨도 삭제
```
