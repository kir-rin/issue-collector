import json
import os
from datetime import datetime, timedelta
from typing import Any

from airflow import DAG
from airflow.providers.standard.operators.python import PythonOperator
from airflow.providers.smtp.operators.smtp import EmailOperator
from airflow.models import Variable

from dspy_pipeline_plugin import (
    PipelineConfig,
    EmailConfig,
    get_storage,
    IssueCollector,
    DataProcessor,
    PromptOptimizer,
)


default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "email_on_failure": True,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}


def get_config(**context) -> dict:
    dag_run = context.get("dag_run")
    params = dag_run.conf if dag_run else {}
    
    return {
        "owner": params.get("owner", Variable.get("default_repo_owner", default_var="apache")),
        "name": params.get("name", Variable.get("default_repo_name", default_var="airflow")),
        "budget": params.get("budget", "light"),
        "storage_type": params.get("storage_type", "local"),
        "limit": params.get("limit", 50),
        "max_prs": params.get("max_prs", 1000),
    }


def collect_issues(**context) -> dict:
    config_data = get_config(**context)
    config = PipelineConfig.from_dict(config_data)
    
    storage = get_storage(config.storage_type, base_path=config.storage_path)
    
    collector = IssueCollector(config.owner, config.name)
    collector.fetch_until_issues(target_issues=config.limit, max_prs=config.max_prs)
    issues = collector.issues
    
    if len(issues) == 0:
        raise ValueError("No issues found")
    
    raw_path = f"{config.repo_key}/raw/issues.json"
    storage.save_json(raw_path, issues)
    
    return {
        "repo_key": config.repo_key,
        "issues_count": len(issues),
        "raw_path": raw_path,
    }


def process_data(**context) -> dict:
    config_data = get_config(**context)
    config = PipelineConfig.from_dict(config_data)
    
    ti = context["ti"]
    collect_result = ti.xcom_pull(task_ids="collect_issues")
    
    storage = get_storage(config.storage_type, base_path=config.storage_path)
    
    issues = storage.load_json(collect_result["raw_path"])
    
    processor = DataProcessor(issues)
    train, dev, test = processor.run()
    
    processed_path = f"{config.repo_key}/processed/data.json"
    storage.save_json(processed_path, {
        "train": train,
        "dev": dev,
        "test": test,
    })
    
    return {
        "repo_key": config.repo_key,
        "processed_path": processed_path,
        "train_count": len(train),
        "dev_count": len(dev),
        "test_count": len(test),
    }


def optimize_prompt(**context) -> dict:
    config_data = get_config(**context)
    config = PipelineConfig.from_dict(config_data)
    
    ti = context["ti"]
    process_result = ti.xcom_pull(task_ids="process_data")
    
    storage = get_storage(config.storage_type, base_path=config.storage_path)
    
    data = storage.load_json(process_result["processed_path"])
    train, dev, test = data["train"], data["dev"], data["test"]
    
    log_dir = os.path.join(config.storage_path, config.repo_key, "logs")
    
    optimizer = PromptOptimizer(
        train=train,
        dev=dev,
        test=test,
        log_dir=log_dir,
        storage=storage,
    )
    optimizer.run(model="openai/gpt-4o-mini", auto=config.budget)
    
    optimized_path = f"{config.repo_key}/optimized/optimized_gepa.json"
    optimizer.save(optimized_path)
    
    return {
        "repo_key": config.repo_key,
        "optimized_path": optimized_path,
        "budget": config.budget,
    }


def evaluate(**context) -> dict:
    config_data = get_config(**context)
    config = PipelineConfig.from_dict(config_data)
    
    ti = context["ti"]
    optimize_result = ti.xcom_pull(task_ids="optimize_prompt")
    process_result = ti.xcom_pull(task_ids="process_data")
    
    storage = get_storage(config.storage_type, base_path=config.storage_path)
    
    data = storage.load_json(process_result["processed_path"])
    test = data["test"]
    
    optimized_path = optimize_result["optimized_path"]
    optimized_data = storage.load_json(optimized_path)
    
    import dspy
    scorer = dspy.load(optimized_data)
    
    total_score = 0.0
    errors = []
    
    for example in test:
        pred = scorer(title=example["title"], body=example["body"])
        error = abs(example["score"] - pred.score)
        errors.append(error)
        total_score += 1 / (1 + error)
    
    avg_score = total_score / len(test)
    avg_error = sum(errors) / len(errors)
    
    results = {
        "repo_key": config.repo_key,
        "avg_score": avg_score,
        "avg_error": avg_error,
        "num_samples": len(test),
        "optimized_path": optimized_path,
    }
    
    eval_path = f"{config.repo_key}/optimized/evaluation.json"
    storage.save_json(eval_path, results)
    
    return results


def save_results(**context) -> dict:
    config_data = get_config(**context)
    config = PipelineConfig.from_dict(config_data)
    
    ti = context["ti"]
    eval_result = ti.xcom_pull(task_ids="evaluate")
    optimize_result = ti.xcom_pull(task_ids="optimize_prompt")
    
    storage = get_storage(config.storage_type, base_path=config.storage_path)
    
    history_path = optimize_result["optimized_path"].replace(".json", "_history.json")
    history_data = storage.load_json(history_path)
    
    summary = {
        "repository": f"{config.owner}/{config.name}",
        "budget": config.budget,
        "timestamp": context["ts"],
        "evaluation": eval_result,
        "optimization_summary": history_data.get("optimization_summary", {}),
    }
    
    summary_path = f"{config.repo_key}/optimized/summary.json"
    storage.save_json(summary_path, summary)
    
    return {
        "summary_path": summary_path,
        "avg_score": eval_result["avg_score"],
        "avg_error": eval_result["avg_error"],
    }


with DAG(
    dag_id="issue_score_optimizer",
    default_args=default_args,
    description="Optimize GitHub issue scoring prompt using DSPy GEPA",
    schedule="0 2 1,15 * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["dspy", "optimization", "github"],
    params={
        "owner": "apache",
        "name": "airflow",
        "budget": "light",
    },
) as dag:
    
    collect_task = PythonOperator(
        task_id="collect_issues",
        python_callable=collect_issues,
        execution_timeout=timedelta(minutes=30),
        retries=3,
    )
    
    process_task = PythonOperator(
        task_id="process_data",
        python_callable=process_data,
        execution_timeout=timedelta(minutes=10),
    )
    
    optimize_task = PythonOperator(
        task_id="optimize_prompt",
        python_callable=optimize_prompt,
        execution_timeout=timedelta(hours=4),
        retries=2,
    )
    
    evaluate_task = PythonOperator(
        task_id="evaluate",
        python_callable=evaluate,
        execution_timeout=timedelta(minutes=30),
        retries=2,
    )
    
    save_task = PythonOperator(
        task_id="save_results",
        python_callable=save_results,
    )
    
    email_config = EmailConfig.from_env()
    email_task = EmailOperator(
        task_id="send_email",
        to=email_config.to_email or "admin@example.com",
        subject="[Airflow] Issue Score Optimizer - {{ params.owner }}/{{ params.name }}",
        html_content="""
        <h2>Issue Score Optimizer Complete</h2>
        <p><strong>Repository:</strong> {{ params.owner }}/{{ params.name }}</p>
        <p><strong>Budget:</strong> {{ params.budget }}</p>
        <p><strong>Average Score:</strong> {{ task_instance.xcom_pull(task_ids='save_results')['avg_score'] | round(4) }}</p>
        <p><strong>Average Error:</strong> {{ task_instance.xcom_pull(task_ids='save_results')['avg_error'] | round(4) }}</p>
        """,
        conn_id="smtp_default",
    )
    
    collect_task >> process_task >> optimize_task >> evaluate_task >> save_task >> email_task
