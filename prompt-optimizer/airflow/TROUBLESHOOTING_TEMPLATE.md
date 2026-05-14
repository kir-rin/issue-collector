# Troubleshooting Template

## 섹션 구조

| 항목 | 설명 | 필수 |
|------|------|------|
| **증상** | 에러 메시지 또는 문제 상황 | O |
| **발견** | 문제를 발견한 방법/커맨드 | O |
| **원인** | 문제의 근본 원인 | O |
| **해결** | 해결 방법 | O |
| **참고** | 관련 문서 링크 | X |

---

## 템플릿

```markdown
## [문제 제목]

**증상:**
```
[에러 메시지 또는 문제 상황]
```

**발견:** `[문제를 발견한 커맨드]`

**원인:** [근본 원인 설명]

**해결:**
```[언어]
[해결 코드/설정]
```

**참고:** [관련 문서 링크] (선택)
```

---

## 작성 예시

```markdown
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
```

---

## 작성 팁

1. **증상은 실제 로그를 복사** - 추측하지 말고 실제 에러 메시지를 사용
2. **발견은 구체적인 커맨드** - AI가 나중에 자동화할 수 있도록 실행 가능한 명령어
3. **원인은 간결하게** - "왜"에 집중, 너무 길지 않게
4. **해결은 실행 가능하게** - 복사해서 바로 사용할 수 있는 형태
5. **참고는 신뢰할 수 있는 출처** - 공식 문서 우선
