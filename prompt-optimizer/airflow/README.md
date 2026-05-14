# Airflow DSPy Pipeline

DSPy GEPA를 사용한 GitHub 이슈 스코어링 프롬프트 최적화 파이프라인

## 구조

```
airflow/
├── dags/
│   └── issue_score_optimizer_dag.py   # DAG 정의
├── plugins/
│   └── dspy_pipeline/
│       ├── __init__.py
│       ├── config.py                  # 설정 관리
│       ├── storage.py                 # Storage 추상화 (Local/S3)
│       ├── issue_collector.py         # GitHub 이슈 수집
│       ├── data_processor.py          # 데이터 처리
│       └── prompt_optimizer.py        # GEPA 최적화
├── data/                              # 데이터 저장소
├── docker-compose.yaml
├── Dockerfile
├── requirements.txt
├── .env                               # 환경 변수 (실제 값)
└── .env.example                       # 환경 변수 템플릿
```

## 실행 방법

### 1. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일 수정
```

### 2. Docker 실행

```bash
# 초기화 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f airflow-scheduler
```

### 3. Web UI 접속

- URL: http://localhost:8080
- ID: admin
- Password: admin

### 4. DAG 실행

**기본 설정으로 실행:**
- Web UI에서 DAG 활성화 후 자동 실행

**다른 리포지토리로 실행:**
```bash
docker-compose exec airflow-scheduler airflow dags trigger issue_score_optimizer \
  --conf '{"owner": "facebook", "name": "react", "budget": "medium"}'
```

## 파라미터

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| owner | apache | 리포지토리 owner |
| name | airflow | 리포지토리 name |
| budget | light | 최적화 예산 (light/medium/heavy) |
| limit | 50 | 수집할 이슈 수 |
| max_prs | 1000 | 최대 PR 수 |

## 스케줄

- 매월 1일, 15일 새벽 2시 실행 (`0 2 1,15 * *`)

## 데이터 저장 위치

```
data/
└── {owner}_{name}/
    ├── raw/
    │   └── issues.json
    ├── processed/
    │   └── data.json
    ├── optimized/
    │   ├── optimized_gepa.json
    │   ├── optimized_gepa_history.json
    │   ├── evaluation.json
    │   └── summary.json
    └── logs/
```

## ECS Fargate 마이그레이션

1. S3Storage 사용으로 변경
2. 환경 변수를 AWS Secrets Manager로 이동
3. ECR에 Docker image push
4. ECS Task Definition 작성

```python
# storage_type 변경
storage = get_storage("s3", bucket="your-bucket", prefix="dspy-data")
```

## 문제 해결

### 컨테이너 권한 문제
```bash
echo -e "AIRFLOW_UID=$(id -u)\nAIRFLOW_GID=0" > .env
```

### DAG 미표시
```bash
docker-compose exec airflow-scheduler airflow dags list
```

### 로그 확인
```bash
docker-compose logs -f airflow-scheduler
```
