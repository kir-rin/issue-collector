import argparse
import json
from dotenv import load_dotenv

load_dotenv()

from issue_collector import IssueCollector
from data_processor import DataProcessor
from prompt_optimizer import PromptOptimizer


def main():
    parser = argparse.ArgumentParser(description="Collect issues and optimize prompt for contribution scoring")
    parser.add_argument("owner", help="Repository owner (e.g., apache)")
    parser.add_argument("name", help="Repository name (e.g., airflow)")
    parser.add_argument("--limit", type=int, default=50, help="Total number of PRs to fetch (default: 50)")
    parser.add_argument("--model", default="openai/gpt-4o-mini", help="LLM model to use")
    parser.add_argument("--auto", default="medium", choices=["light", "medium", "heavy"], help="Optimization level (for MIPROv2)")
    parser.add_argument("--output", "-o", default=None, help="Output file for optimized scorer (auto-generated if not specified)")
    parser.add_argument("--skip-optimize", action="store_true", help="Skip optimization, only collect and process data")
    parser.add_argument("--save-data", help="Save processed data to JSON file")

    args = parser.parse_args()

    print(f"=== Issue Collection & Prompt Optimization ===")
    print(f"Repository: {args.owner}/{args.name}")
    print(f"PR limit: {args.limit}")
    print()

    print("[Step 1] Collecting issues from merged PRs...")
    collector = IssueCollector(args.owner, args.name)
    collector.fetch_all_prs(total_limit=args.limit)
    issues = collector.extract_issues()
    print(f"Collected {len(issues)} issues\n")

    if len(issues) == 0:
        print("No issues found. Exiting.")
        return

    print("[Step 2] Processing issues and splitting data...")
    processor = DataProcessor(issues)
    train, dev, test = processor.run()
    print()

    if args.save_data:
        print(f"[Step 2.5] Saving processed data to {args.save_data}...")
        data = {
            "train": train,
            "dev": dev,
            "test": test,
        }
        with open(args.save_data, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print()

    if args.skip_optimize:
        print("[Skipping] Optimization skipped (--skip-optimize)")
        return

    print("[Step 3] Optimizing prompt...")
    optimizer = PromptOptimizer(train, dev, test)
    optimizer.run(model=args.model, auto=args.auto)
    print()

    print("[Step 4] Evaluating on test set...")
    results = optimizer.evaluate()
    print(f"  Average score: {results['avg_score']:.4f}")
    print(f"  Average error: {results['avg_error']:.4f}")
    print()

    print(f"[Step 5] Saving optimized scorer...")
    saved_path = optimizer.save(args.output)
    print(f"  Saved to: {saved_path}")
    print()

    print("=== Complete ===")


if __name__ == "__main__":
    main()
