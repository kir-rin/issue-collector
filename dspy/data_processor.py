import math
import random
from datetime import datetime
from typing import Any


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
