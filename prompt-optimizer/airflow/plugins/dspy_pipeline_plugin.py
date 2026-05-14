import os
import json
import math
import random
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Any

import boto3
import dspy
import requests
from botocore.exceptions import ClientError
from dataclasses import dataclass


# ============ config.py ============

@dataclass
class PipelineConfig:
    owner: str
    name: str
    budget: str = "light"
    storage_type: str = "local"
    storage_path: str = "/opt/airflow/data"
    limit: int = 50
    max_prs: int = 1000

    @property
    def repo_key(self) -> str:
        return f"{self.owner}_{self.name}"

    @property
    def data_dir(self) -> str:
        return os.path.join(self.storage_path, self.repo_key)

    @property
    def raw_dir(self) -> str:
        return os.path.join(self.data_dir, "raw")

    @property
    def processed_dir(self) -> str:
        return os.path.join(self.data_dir, "processed")

    @property
    def optimized_dir(self) -> str:
        return os.path.join(self.data_dir, "optimized")

    @classmethod
    def from_dict(cls, data: dict) -> "PipelineConfig":
        return cls(
            owner=data.get("owner"),
            name=data.get("name"),
            budget=data.get("budget", "light"),
            storage_type=data.get("storage_type", "local"),
            storage_path=data.get("storage_path", "/opt/airflow/data"),
            limit=data.get("limit", 50),
            max_prs=data.get("max_prs", 1000),
        )


@dataclass
class EmailConfig:
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    from_email: str = ""
    to_email: str = ""

    @classmethod
    def from_env(cls) -> "EmailConfig":
        return cls(
            smtp_host=os.getenv("SMTP_HOST", "smtp.gmail.com"),
            smtp_port=int(os.getenv("SMTP_PORT", "587")),
            smtp_user=os.getenv("SMTP_USER", ""),
            smtp_password=os.getenv("SMTP_PASSWORD", ""),
            from_email=os.getenv("FROM_EMAIL", ""),
            to_email=os.getenv("TO_EMAIL", ""),
        )


# ============ storage.py ============

class StorageBackend(ABC):
    @abstractmethod
    def save(self, path: str, data: bytes) -> str:
        pass

    @abstractmethod
    def load(self, path: str) -> bytes:
        pass

    @abstractmethod
    def exists(self, path: str) -> bool:
        pass

    def save_json(self, path: str, data: dict | list) -> str:
        return self.save(path, json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8"))

    def load_json(self, path: str) -> dict | list:
        return json.loads(self.load(path).decode("utf-8"))


class LocalStorage(StorageBackend):
    def __init__(self, base_path: str = "/opt/airflow/data"):
        self.base_path = Path(base_path)

    def _full_path(self, path: str) -> Path:
        return self.base_path / path

    def save(self, path: str, data: bytes) -> str:
        full_path = self._full_path(path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(data)
        return str(full_path)

    def load(self, path: str) -> bytes:
        full_path = self._full_path(path)
        return full_path.read_bytes()

    def exists(self, path: str) -> bool:
        return self._full_path(path).exists()


class S3Storage(StorageBackend):
    def __init__(self, bucket: str, prefix: str = ""):
        self.bucket = bucket
        self.prefix = prefix.rstrip("/")
        self.client = boto3.client("s3")

    def _s3_key(self, path: str) -> str:
        if self.prefix:
            return f"{self.prefix}/{path}"
        return path

    def save(self, path: str, data: bytes) -> str:
        key = self._s3_key(path)
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data)
        return f"s3://{self.bucket}/{key}"

    def load(self, path: str) -> bytes:
        key = self._s3_key(path)
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def exists(self, path: str) -> bool:
        key = self._s3_key(path)
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False


def get_storage(storage_type: str = "local", **kwargs) -> StorageBackend:
    if storage_type == "local":
        return LocalStorage(base_path=kwargs.get("base_path", "/opt/airflow/data"))
    elif storage_type == "s3":
        return S3Storage(
            bucket=kwargs.get("bucket"),
            prefix=kwargs.get("prefix", ""),
        )
    else:
        raise ValueError(f"Unknown storage type: {storage_type}")


# ============ issue_collector.py ============

GITHUB_API_URL = "https://api.github.com/graphql"


class IssueCollector:
    def __init__(self, owner: str, name: str, token: str | None = None):
        self.owner = owner
        self.name = name
        self.token = token or os.getenv("GITHUB_TOKEN")
        self._prs: list[dict[str, Any]] = []
        self._issues: list[dict[str, Any]] = []
        self._has_next_page = False
        self._cursor: str | None = None

    def fetch_merged_prs(self, limit: int = 100) -> list[dict[str, Any]]:
        if not self.token:
            raise ValueError("GITHUB_TOKEN not found")

        query = """
        query($owner: String!, $name: String!, $limit: Int!, $cursor: String) {
          repository(owner: $owner, name: $name) {
            pullRequests(first: $limit, after: $cursor, states: [MERGED], orderBy: { field: UPDATED_AT, direction: DESC }) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                url
                createdAt
                mergedAt
                closingIssuesReferences(first: 10) {
                  nodes {
                    title
                    body
                  }
                }
              }
            }
          }
        }
        """

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

        variables = {
            "owner": self.owner,
            "name": self.name,
            "limit": limit,
            "cursor": None,
        }

        response = requests.post(
            GITHUB_API_URL,
            headers=headers,
            json={"query": query, "variables": variables},
        )
        response.raise_for_status()

        data = response.json()

        if "errors" in data:
            raise RuntimeError(f"GraphQL errors: {data['errors']}")

        pr_data = data["data"]["repository"]["pullRequests"]
        pr_nodes = pr_data["nodes"]

        self._has_next_page = pr_data["pageInfo"]["hasNextPage"]
        self._cursor = pr_data["pageInfo"]["endCursor"]

        self._prs = [
            {
                "url": pr["url"],
                "created_at": pr["createdAt"],
                "merged_at": pr["mergedAt"],
                "closing_issues": pr["closingIssuesReferences"]["nodes"],
            }
            for pr in pr_nodes
        ]

        return self._prs

    def fetch_more_prs(self, limit: int = 100) -> list[dict[str, Any]]:
        if not self._has_next_page:
            print("[IssueCollector] No more pages available")
            return []

        if not self.token:
            raise ValueError("GITHUB_TOKEN not found")

        query = """
        query($owner: String!, $name: String!, $limit: Int!, $cursor: String) {
          repository(owner: $owner, name: $name) {
            pullRequests(first: $limit, after: $cursor, states: [MERGED], orderBy: { field: UPDATED_AT, direction: DESC }) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                url
                createdAt
                mergedAt
                closingIssuesReferences(first: 10) {
                  nodes {
                    title
                    body
                  }
                }
              }
            }
          }
        }
        """

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

        variables = {
            "owner": self.owner,
            "name": self.name,
            "limit": limit,
            "cursor": self._cursor,
        }

        response = requests.post(
            GITHUB_API_URL,
            headers=headers,
            json={"query": query, "variables": variables},
        )
        response.raise_for_status()

        data = response.json()

        if "errors" in data:
            raise RuntimeError(f"GraphQL errors: {data['errors']}")

        pr_data = data["data"]["repository"]["pullRequests"]
        pr_nodes = pr_data["nodes"]

        self._has_next_page = pr_data["pageInfo"]["hasNextPage"]
        self._cursor = pr_data["pageInfo"]["endCursor"]

        new_prs = [
            {
                "url": pr["url"],
                "created_at": pr["createdAt"],
                "merged_at": pr["mergedAt"],
                "closing_issues": pr["closingIssuesReferences"]["nodes"],
            }
            for pr in pr_nodes
        ]

        self._prs.extend(new_prs)
        return new_prs

    def fetch_until_issues(self, target_issues: int = 50, max_prs: int = 1000) -> list[dict[str, Any]]:
        print(f"[IssueCollector] Fetching PRs until {target_issues} issues are collected...")

        limit = min(100, max_prs)
        self.fetch_merged_prs(limit=limit)
        issues = self.extract_issues()
        print(f"[IssueCollector] Fetched {len(self._prs)} PRs, found {len(issues)} issues (page 1)")

        page = 2
        while len(issues) < target_issues and self._has_next_page and len(self._prs) < max_prs:
            remaining_prs = max_prs - len(self._prs)
            limit = min(100, remaining_prs)
            self.fetch_more_prs(limit=limit)
            issues = self.extract_issues()
            print(f"[IssueCollector] Fetched {len(self._prs)} PRs, found {len(issues)} issues (page {page})")
            page += 1

        print(f"[IssueCollector] Complete: {len(self._prs)} PRs, {len(issues)} issues")
        return self._prs

    def extract_issues(self) -> list[dict[str, Any]]:
        issue_prs: dict[str, list[dict]] = {}

        for pr in self._prs:
            for issue in pr["closing_issues"]:
                title = issue["title"]
                if title not in issue_prs:
                    issue_prs[title] = []
                issue_prs[title].append({
                    "body": issue["body"] or "",
                    "pr_created_at": pr["created_at"],
                    "pr_merged_at": pr["merged_at"],
                })

        issues = []
        for title, pr_list in issue_prs.items():
            fastest_pr = min(pr_list, key=lambda x: x["pr_merged_at"])
            issues.append({
                "title": title,
                "body": fastest_pr["body"],
                "pr_created_at": fastest_pr["pr_created_at"],
                "pr_merged_at": fastest_pr["pr_merged_at"],
            })

        self._issues = issues
        return self._issues

    @property
    def prs(self) -> list[dict[str, Any]]:
        return self._prs

    @property
    def issues(self) -> list[dict[str, Any]]:
        return self._issues


# ============ data_processor.py ============

class DataProcessor:
    def __init__(self, issues: list[dict[str, Any]], ratio: tuple[float, float, float] = (0.7, 0.2, 0.1)):
        self.issues = issues
        self.ratio = ratio
        self.processed_issues: list[dict[str, Any]] = []
        self.train: list[dict[str, Any]] = []
        self.dev: list[dict[str, Any]] = []
        self.test: list[dict[str, Any]] = []

    def calculate_score(self, created_at: str, merged_at: str) -> float:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        merged = datetime.fromisoformat(merged_at.replace("Z", "+00:00"))
        duration_hours = (merged - created).total_seconds() / 3600
        return 1 / (1 + math.log1p(duration_hours))

    def process_issues(self) -> list[dict[str, Any]]:
        print(f"[DataProcessor] Processing {len(self.issues)} issues...")
        
        for issue in self.issues:
            score = self.calculate_score(issue["pr_created_at"], issue["pr_merged_at"])
            self.processed_issues.append({
                "title": issue["title"],
                "body": issue["body"],
                "score": score,
            })
        
        print(f"[DataProcessor] Added scores to all issues")
        return self.processed_issues

    def split_data(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        print(f"[DataProcessor] Splitting data with ratio {self.ratio}...")
        
        random.shuffle(self.processed_issues)
        
        n = len(self.processed_issues)
        train_end = int(n * self.ratio[0])
        dev_end = train_end + int(n * self.ratio[1])
        
        self.train = self.processed_issues[:train_end]
        self.dev = self.processed_issues[train_end:dev_end]
        self.test = self.processed_issues[dev_end:]
        
        print(f"[DataProcessor] Split complete: train={len(self.train)}, dev={len(self.dev)}, test={len(self.test)}")
        return self.train, self.dev, self.test

    def run(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        self.process_issues()
        self.split_data()
        return self.train, self.dev, self.test


# ============ prompt_optimizer.py ============

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
        log_dir: str = "/opt/airflow/data/gepa_logs",
        storage: StorageBackend | None = None,
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
        self.storage = storage

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
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
        
        lm_kwargs = {"model": model}
        if api_key:
            lm_kwargs["api_key"] = api_key
        if base_url:
            lm_kwargs["api_base"] = base_url
        
        lm = dspy.LM(**lm_kwargs)
        dspy.configure(lm=lm)

    def optimize(self, auto: str = "medium") -> IssueScorer:
        print(f"[PromptOptimizer] Using GEPA (train_size={len(self.train)}, val_size={len(self.dev)})")
        print(f"[PromptOptimizer] Log directory: {self.log_dir}")
        print(f"[PromptOptimizer] Starting optimization...")
        
        scorer = IssueScorer()
        
        reflection_lm_kwargs = {"model": "openai/gpt-4o-mini", "temperature": 1.0, "max_tokens": 16000}
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
        if api_key:
            reflection_lm_kwargs["api_key"] = api_key
        if base_url:
            reflection_lm_kwargs["api_base"] = base_url
        
        optimizer = dspy.GEPA(
            metric=score_metric,
            auto=auto,
            track_stats=True,
            reflection_lm=dspy.LM(**reflection_lm_kwargs),
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

    def save(self, path: str) -> str:
        if not self.optimized_scorer:
            raise ValueError("No optimized scorer. Run optimize() first.")
        
        print(f"[PromptOptimizer] Saving optimized scorer to {path}")
        
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name
        
        self.optimized_scorer.save(temp_path)
        
        with open(temp_path, 'r') as f:
            data = json.load(f)
        
        if self.storage:
            self.storage.save_json(path, data)
        else:
            output_path = Path(path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        
        os.unlink(temp_path)
        
        history_data = self._build_history()
        history_path = path.replace('.json', '_history.json')
        
        if self.storage:
            self.storage.save_json(history_path, history_data)
        else:
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_data, f, indent=2, ensure_ascii=False)
            print(f"[PromptOptimizer] Optimization history saved to {history_path}")
        
        print(f"[PromptOptimizer] Save complete")
        return path

    def _build_history(self) -> dict:
        if not hasattr(self.optimized_scorer, 'detailed_results'):
            return {}
        
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
        
        return {
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


# ============ Airflow Plugin Definition ============

from airflow.plugins_manager import AirflowPlugin


class DspyPipelinePlugin(AirflowPlugin):
    name = "dspy_pipeline"
