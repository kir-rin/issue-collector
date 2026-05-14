import dspy
import json
from typing import Any
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class IssueScoreSignature(dspy.Signature):
    """Score GitHub issues for contribution suitability.

[ROLE]
You are a 10-year experienced developer with extensive open-source contribution experience.

[TASK]
For each issue, assign a score from 0 to 1 based on contribution opportunity criteria.
Provide clear reasoning for each score.

[CRITERIA FOR GOOD CONTRIBUTION OPPORTUNITIES]
1. Issues with detailed and well-written content
2. Issues where bug/error logs and reproduction steps are clearly specified
3. Issues where the location of suspicious source code has been identified
4. Issues with "good first issue" label (no "blocked" or "wait-for-triage" labels)

[SCORING GUIDE]
- 0.9-1.0: Excellent opportunity (meets most criteria perfectly)
- 0.7-0.8: Good opportunity (meets several criteria well)
- 0.5-0.6: Moderate opportunity (meets some criteria)
- 0.3-0.4: Limited opportunity (meets few criteria)
- 0.0-0.2: Poor opportunity (meets almost no criteria)

[OUTPUT RULES]
You must format your output as a JSON value that adheres to a given "JSON Schema" instance.
Do not include markdown code blocks in the output.
Keep keys in English.

[CONSTRAINTS]
- Keep the original section structure: [ROLE], [TASK], [CRITERIA FOR GOOD CONTRIBUTION OPPORTUNITIES], [SCORING GUIDE], [OUTPUT RULES], [CONSTRAINTS]
- Do not add sections about providing feedback to issue authors
- Do not add [PROVIDE FEEDBACK] or similar sections
"""
    title: str = dspy.InputField(desc="Issue title")
    body: str = dspy.InputField(desc="Issue body/description")
    score: float = dspy.OutputField(desc="Contribution suitability score between 0 and 1. Higher = easier to contribute")


class IssueScorer(dspy.Module):
    def __init__(self):
        super().__init__()
        self.scorer = dspy.ChainOfThought(IssueScoreSignature)

    def forward(self, title: str, body: str):
        return self.scorer(title=title, body=body)


def score_metric(
    example: dspy.Example,
    prediction: dspy.Prediction,
    trace=None,
    pred_name=None,
    pred_trace=None,
) -> float:
    error = abs(example.score - prediction.score)
    return 1 / (1 + error)


class PromptOptimizer:
    def __init__(
        self,
        train: list[dict[str, Any]],
        dev: list[dict[str, Any]],
        test: list[dict[str, Any]],
        log_dir: str = "dspy/gepa_logs",
    ):
        self.train = train
        self.dev = dev
        self.test = test
        self.trainset: list[dspy.Example] = []
        self.devset: list[dspy.Example] = []
        self.testset: list[dspy.Example] = []
        self.optimized_scorer: IssueScorer | None = None
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def to_dspy_examples(self, issues: list[dict[str, Any]]) -> list[dspy.Example]:
        return [
            dspy.Example(
                title=issue["title"],
                body=issue["body"],
                score=issue["score"],
            ).with_inputs("title", "body")
            for issue in issues
        ]

    def setup_lm(self, model: str = "openai/gpt-4o-mini") -> None:
        print(f"[PromptOptimizer] Setting up LM: {model}")
        lm = dspy.LM(model)
        dspy.configure(lm=lm)

    def optimize(self, auto: str = "medium") -> IssueScorer:
        print(f"[PromptOptimizer] Using GEPA (train_size={len(self.train)}, val_size={len(self.dev)})")
        print(f"[PromptOptimizer] Log directory: {self.log_dir}")
        print(f"[PromptOptimizer] Starting optimization...")
        
        scorer = IssueScorer()
        
        optimizer = dspy.GEPA(
            metric=score_metric,
            auto=auto,
            track_stats=True,
            reflection_lm=dspy.LM("openai/gpt-4o-mini", temperature=1.0, max_tokens=16000),
        )
        self.optimized_scorer = optimizer.compile(
            scorer,
            trainset=self.trainset,
            valset=self.devset,
        )
        
        print(f"[PromptOptimizer] Optimization complete")
        return self.optimized_scorer

    def evaluate(self) -> dict[str, float]:
        if not self.optimized_scorer:
            raise ValueError("No optimized scorer. Run optimize() first.")
        
        print(f"[PromptOptimizer] Evaluating on test set ({len(self.testset)} samples)...")
        
        total_score = 0.0
        errors = []
        
        for example in self.testset:
            pred = self.optimized_scorer(title=example.title, body=example.body)
            error = abs(example.score - pred.score)
            errors.append(error)
            total_score += 1 / (1 + error)
        
        avg_score = total_score / len(self.testset)
        avg_error = sum(errors) / len(errors)
        
        print(f"[PromptOptimizer] Evaluation complete: avg_score={avg_score:.4f}, avg_error={avg_error:.4f}")
        
        return {
            "avg_score": avg_score,
            "avg_error": avg_error,
            "num_samples": len(self.testset),
        }

    def save(self, path: str = "optimized_gepa.json") -> str:
        if not self.optimized_scorer:
            raise ValueError("No optimized scorer. Run optimize() first.")
        
        print(f"[PromptOptimizer] Saving optimized scorer to {path}")
        self.optimized_scorer.save(path)
        
        history_path = path.replace('.json', '_history.json')
        if hasattr(self.optimized_scorer, 'detailed_results'):
            dr = self.optimized_scorer.detailed_results
            
            sorted_indices = sorted(
                range(len(dr.candidates)),
                key=lambda i: dr.val_aggregate_scores[i],
                reverse=True
            )[:5]
            
            top_candidates = []
            for idx in sorted_indices:
                candidate = dr.candidates[idx]
                instruction = None
                for name, pred in candidate.named_predictors():
                    instruction = pred.signature.instructions
                    break
                top_candidates.append({
                    "candidate_idx": idx,
                    "val_aggregate_score": dr.val_aggregate_scores[idx],
                    "instruction": instruction,
                    "discovery_eval_count": dr.discovery_eval_counts[idx] if idx < len(dr.discovery_eval_counts) else None,
                    "parent_indices": dr.parents[idx] if idx < len(dr.parents) else None,
                })
            
            history = {
                "optimization_summary": {
                    "best_idx": dr.best_idx,
                    "best_score": dr.val_aggregate_scores[dr.best_idx] if dr.val_aggregate_scores else None,
                    "total_metric_calls": dr.total_metric_calls,
                    "num_full_val_evals": dr.num_full_val_evals,
                    "num_candidates": len(dr.candidates),
                    "seed": dr.seed,
                },
                "top_5_candidates": top_candidates,
                "all_candidate_scores": [
                    {
                        "candidate_idx": i,
                        "val_aggregate_score": dr.val_aggregate_scores[i],
                    }
                    for i in range(len(dr.candidates))
                ],
                "score_distribution": {
                    "min": min(dr.val_aggregate_scores) if dr.val_aggregate_scores else None,
                    "max": max(dr.val_aggregate_scores) if dr.val_aggregate_scores else None,
                    "mean": sum(dr.val_aggregate_scores) / len(dr.val_aggregate_scores) if dr.val_aggregate_scores else None,
                },
            }
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
            print(f"[PromptOptimizer] Optimization history saved to {history_path}")
        
        print(f"[PromptOptimizer] Save complete")
        return path

    def run(self, model: str = "openai/gpt-4o-mini", auto: str = "medium") -> IssueScorer:
        print(f"[PromptOptimizer] Starting pipeline...")
        print(f"[PromptOptimizer] Converting data to DSPy examples...")
        
        self.trainset = self.to_dspy_examples(self.train)
        self.devset = self.to_dspy_examples(self.dev)
        self.testset = self.to_dspy_examples(self.test)
        
        print(f"[PromptOptimizer] trainset={len(self.trainset)}, devset={len(self.devset)}, testset={len(self.testset)}")
        
        self.setup_lm(model)
        self.optimize(auto)
        
        return self.optimized_scorer
