# Issue Score Predictor

## 목표

새로운 GitHub 이슈에 대해 "기여 적합성 점수"를 예측하는 모델 구축

## 파이프라인

### 1. 데이터 수집 (`issue_collector.py`)

GitHub GraphQL API로 merged PR과 연관된 이슈를 수집합니다.


### 2. 레이블링 (`data_processor.py`)

PR 생성→머지 소요 시간으로 ground truth 점수를 산출합니다.

**가정**: 쉬운 이슈는 빠르게 해결되고, 복잡한 이슈는 오래 걸린다.

**점수 공식**:
```
score = 1 / (1 + log1p(duration_hours))
```

- duration이 0시간 → score = 1.0 (최고점)
- duration이 길어질수록 점수는 0에 수렴
- log를 취해 긴 시간대에서 점수 하락을 완만하게 조정

### 3. 모델 최적화 (`prompt_optimizer.py`)

MIPROv2로 few-shot 예제와 instruction을 함께 최적화합니다.


## MIPROv2 작동 원리

> 참고: [DSPy MIPROv2 공식 문서](https://dspy.ai/api/optimizers/MIPROv2/#how-miprov2-works)

MIPROv2는 프롬프트의 두 가지 핵심 구성요소를 자동으로 최적화합니다:
- **Few-shot Examples**: 모델이 따라할 수 있는 예제들
- **Instructions**: 모델에게 주는 지시사항

### 1단계: Bootstrap Few-Shot Examples

훈련 데이터에서 모델이 올바르게 예측한 예제들을 수집합니다.

```
입력: (title, body) → 모델 예측 → score
         ↓
    정답과 비교 → 성공 시 데모로 저장
```

- 훈련셋의 일부를 샘플링
- 현재 모델로 예측 시도
- metric을 통과한 예제를 few-shot 후보로 저장
- 여러 세트의 데모 후보 생성

### 2단계: Propose Instructions

데이터셋 특성을 분석해서 새로운 instruction 후보를 생성합니다.

```
데이터 분석 → 패턴 파악 → 여러 instruction 버전 제안
```

- **Data-aware**: 데이터 분포와 특성 반영
- **Tip-aware**: 프롬프트 작성 팁 적용
- **Program-aware**: 모델 구조 고려

각 방식으로 여러 instruction 후보를 생성합니다.

### 3단계: Bayesian Optimization

instruction × demonstration 조합을 탐색해서 최적의 조합을 찾습니다.

```
탐색 공간: instruction 후보들 × 데모 후보들
         ↓
    Bayesian Optimization
         ↓
    검증셋에서 평가 → 최고 성능 조합 선택
```

- 모든 조합을 시도하는 대신, 효율적으로 탐색
- 이전 시도 결과를 바탕으로 유망한 조합 우선 탐색
- 검증셋에서 가장 높은 점수를 기록한 조합 반환

### 최종 결과

최적화된 모델은 [`optimized/optimized_mipro.json`](optimized/optimized_mipro.json)에 저장되며, 다음을 포함합니다:

1. **최적의 few-shot examples**: 기여 적합성 판단에 도움이 되는 예제들
2. **최적화된 instruction**: 이슈 점수 매기기에 특화된 지시사항

#### Few-shot Examples (demos)

모델이 예측 시 참고하는 예제들입니다:

```json
[
  {
    "title": "Add breeze generate issue content for airflowctl",
    "body": "We have this for the core and populated merged PRs...",
    "reasoning": "This issue is focused and technical, targeting a specific feature...",
    "score": 0.487
  },
  {
    "title": "UI - Disable auto refresh queries if server respond 403 forbidden",
    "body": "AutoRefresh condition for the UI is not considering server response...",
    "reasoning": "This issue is straightforward as it defines a clear bug...",
    "score": 0.429
  }
]
```

#### Optimized Instruction

MIPROv2가 생성한 최적화된 instruction입니다:

```
Evaluate the provided GitHub issue titles and bodies to score them 
for contribution suitability. Use a scale from 0 to 1, where scores 
closer to 1 indicate that the issue is easier and more appropriate 
for contributors to tackle. Additionally, provide clear reasoning 
for each score, explaining why the issue is suitable or challenging 
for potential contributions based on factors like clarity, relevance, 
and complexity.
```

