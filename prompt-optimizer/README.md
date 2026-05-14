# Prompt Optimizer

DSPy GEPA를 사용한 GitHub 이슈 스코어링 프롬프트 최적화 파이프라인

## 구조

```
prompt-optimizer/
├── dspy/                  # 로컬 개발/실험 환경
│   ├── main.py            # CLI 진입점
│   ├── prompt_optimizer.py
│   ├── issue_collector.py
│   ├── data_processor.py
│   └── README.md
└── airflow/               # 운영 파이프라인
    ├── dags/
    ├── plugins/
    ├── docker-compose.yaml
    └── README.md
```

## 사용법

### 로컬 개발 (dspy/)

```bash
cd dspy
python main.py apache airflow --limit 50 --auto light
```

### 운영 환경 (airflow/)

```bash
cd airflow
docker-compose up -d
```

Web UI: http://localhost:8080 (admin/admin)

## 자세한 문서

- [dspy/README.md](dspy/README.md) - 로컬 개발 가이드
- [airflow/README.md](airflow/README.md) - Airflow 운영 가이드
- [airflow/TROUBLESHOOTING.md](airflow/TROUBLESHOOTING.md) - 문제 해결
