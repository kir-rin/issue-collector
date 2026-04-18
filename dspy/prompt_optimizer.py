import dspy
from typing import Any
from dotenv import load_dotenv

load_dotenv()


class IssueScoreSignature(dspy.Signature):
    """Score GitHub issues based on their suitability for contribution. Higher scores (close to 1) indicate easier, more suitable issues for contributors."""
    title: str = dspy.InputField(desc="Issue title")
    body: str = dspy.InputField(desc="Issue body/description")
    score: float = dspy.OutputField(desc="Contribution suitability score between 0 and 1. Higher = easier to contribute")


class IssueScorer(dspy.Module):
    def __init__(self):
        super().__init__()
        self.scorer = dspy.ChainOfThought(IssueScoreSignature)

    def forward(self, title: str, body: str):
        return self.scorer(title=title, body=body)


def score_metric(example: dspy.Example, prediction: dspy.Prediction, trace=None) -> float:
    error = abs(example.score - prediction.score)
    return 1 / (1 + error)


class PromptOptimizer:
    def __init__(self, train: list[dict[str, Any]], dev: list[dict[str, Any]], test: list[dict[str, Any]]):
        self.train = train
        self.dev = dev
        self.test = test
        self.trainset: list[dspy.Example] = []
        self.devset: list[dspy.Example] = []
        self.testset: list[dspy.Example] = []
        self.optimized_scorer: IssueScorer | None = None
        self._optimizer_name: str | None = None

    def get_optimizer_info(self) -> tuple[str, str]:
        n_train = len(self.train)
        
        if n_train < 50:
            return "BootstrapFewShot", "optimized_fewshot.json"
        elif n_train < 100:
            return "BootstrapFewShotWithRandomSearch", "optimized_random_search.json"
        else:
            return "MIPROv2", "optimized_mipro.json"

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
        self._optimizer_name, default_filename = self.get_optimizer_info()
        print(f"[PromptOptimizer] Using {self._optimizer_name} (train_size={len(self.train)})")
        print(f"[PromptOptimizer] Starting optimization...")
        
        scorer = IssueScorer()
        
        if self._optimizer_name == "BootstrapFewShot":
            optimizer = dspy.BootstrapFewShot(
                metric=score_metric,
                max_bootstrapped_demos=4,
                max_labeled_demos=16,
            )
            self.optimized_scorer = optimizer.compile(
                scorer,
                trainset=self.trainset,
            )
        elif self._optimizer_name == "BootstrapFewShotWithRandomSearch":
            optimizer = dspy.BootstrapFewShotWithRandomSearch(
                metric=score_metric,
                max_bootstrapped_demos=4,
                max_labeled_demos=16,
                num_candidate_programs=10,
                num_threads=1,
            )
            self.optimized_scorer = optimizer.compile(
                scorer,
                trainset=self.trainset,
                valset=self.devset,
            )
        else:  # MIPROv2
            optimizer = dspy.MIPROv2(
                metric=score_metric,
                auto=auto,
                num_threads=4,
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

    def save(self, path: str | None = None) -> str:
        if not self.optimized_scorer:
            raise ValueError("No optimized scorer. Run optimize() first.")
        
        if path is None:
            _, path = self.get_optimizer_info()
        
        print(f"[PromptOptimizer] Saving optimized scorer to {path}")
        self.optimized_scorer.save(path)
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
