import os
import argparse
import json
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

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
            raise ValueError("GITHUB_TOKEN not found in .env")

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
            raise ValueError("GITHUB_TOKEN not found in .env")

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

    def fetch_all_prs(self, total_limit: int = 50) -> list[dict[str, Any]]:
        print(f"[IssueCollector] Fetching up to {total_limit} PRs...")

        limit = min(100, total_limit)
        self.fetch_merged_prs(limit=limit)
        print(f"[IssueCollector] Fetched {len(self._prs)} PRs (page 1)")

        page = 2
        while len(self._prs) < total_limit and self._has_next_page:
            remaining = total_limit - len(self._prs)
            limit = min(100, remaining)
            new_prs = self.fetch_more_prs(limit=limit)
            print(f"[IssueCollector] Fetched {len(self._prs)} PRs (page {page})")
            page += 1

        if len(self._prs) > total_limit:
            self._prs = self._prs[:total_limit]

        print(f"[IssueCollector] Total PRs collected: {len(self._prs)}")
        return self._prs

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


def main():
    parser = argparse.ArgumentParser(
        description="Fetch issues from recently merged PRs"
    )
    parser.add_argument("owner", help="Repository owner (e.g., apache)")
    parser.add_argument("name", help="Repository name (e.g., airflow)")
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Number of PRs to fetch (default: 10)",
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output file path (default: stdout)",
    )

    args = parser.parse_args()

    collector = IssueCollector(args.owner, args.name)
    collector.fetch_merged_prs(args.limit)
    issues = collector.extract_issues()

    output = json.dumps(issues, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
    else:
        print(output)


if __name__ == "__main__":
    main()
