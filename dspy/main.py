import argparse
import json
from dotenv import load_dotenv

load_dotenv()

from issue_collector import IssueCollector
from data_processor import DataProcessor
from prompt_optimizer import PromptOptimizer


def main():
    parser = argparse.ArgumentParser(description="Collect issues and optimize prompt for contribution scoring")
    parser.add_argument("owner", nargs="?", help="Repository owner (e.g., apache)")
    parser.add_argument("name", nargs="?", help="Repository name (e.g., airflow)")
    parser.add_argument("--limit", type=int, default=50, help="Target number of issues to collect (default: 50)")
    parser.add_argument("--max-prs", type=int, default=1000, help="Maximum number of PRs to fetch (default: 1000)")
    parser.add_argument("--load-data", help="Load processed data from JSON file instead of collecting")
    parser.add_argument("--model", default="openai/gpt-4o-mini", help="LLM model to use")
    parser.add_argument("--auto", default="medium", choices=["light", "medium", "heavy"], help="Optimization level (for MIPROv2)")
    parser.add_argument("--output", "-o", default=None, help="Output file for optimized scorer (auto-generated if not specified)")
    parser.add_argument("--skip-optimize", action="store_true", help="Skip optimization, only collect and process data")
    parser.add_argument("--save-data", help="Save processed data to JSON file")

    args = parser.parse_args()

    if not args.load_data and (not args.owner or not args.name):
        parser.error("owner and name are required when not using --load-data")

    print(f"=== Issue Collection & Prompt Optimization ===")
    
    if args.load_data:
        print(f"Loading data from {args.load_data}...")
        with open(args.load_data, "r", encoding="utf-8") as f:
            data = json.load(f)
        train = data["train"]
        dev = data["dev"]
        test = data["test"]
        print(f"Loaded: train={len(train)}, dev={len(dev)}, test={len(test)}\n")
    else:
        print(f"Repository: {args.owner}/{args.name}")
        print(f"Target issues: {args.limit}, Max PRs: {args.max_prs}")
        print()

        print("[Step 1] Collecting issues from merged PRs...")
        collector = IssueCollector(args.owner, args.name)
        collector.fetch_until_issues(target_issues=args.limit, max_prs=args.max_prs)
        issues = collector.issues
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
