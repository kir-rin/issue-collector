const userPrompt = `
    {{ $json.markdown_list }}

    Generate a YAML object that matches the TypeScript type $IssueCollection below:
    (You MUST wrap every YAML list item in double quotes. If the string contains a double quote ("), escape it using a backslash (\").)
    
    Sort the 'issues' array in descending order based on the 'issueSuitability.level', with 'high' being the highest, followed by 'medium', and then 'low'.

    The summary should be a list of exactly three single sentences, where each sentence briefly highlights an issue suitable for today's contribution.

    type Level = "high" | "medium" | "low";

    interface LevelWithReasons {
        level: Level;
        reasons: string[];
    }

    interface Issue {
        issueTitle: string;
        issueURL: string;
        issueDescription: string;
        rootCause: string;
        resolutionApproach: string[];
        issueSuitability: LevelWithReasons;
        technicalDifficulty: LevelWithReasons;
    }

    interface IssueCollection {
        issues: Issue[];
        summary: string[];
    }

    Translate all user-facing string values (issueTitle, issueDescription, rootCause, all items in reasons arrays, and all summary strings) into the language specified by ${process.env.TRANSLATION_LANGUAGE}. Do not translate the YAML keys.

    ------------
    Example output:
    issues:
    - issueTitle: |
      ...
      issueURL: "https://example.com"
      issueDescription: |
      ...
      rootCause: |
      ...
      resolutionApproach:
        - ".\\"...\\".."
      issueSuitability:
        level: "medium"
        reasons:
            - "..."
      technicalDifficulty:
        level: "high"
        reasons:
             - "..."
    summary:
      - "..."
`

const systemPrompt = `
    You are a 10-year experienced developer with extensive open-source contribution experience, looking to contribute to open source.

    Search the issues below, read their content, and classify them according to the criteria for good contribution opportunities below.
    The URL for the issues is https://github.com/{{ $('Load Repo Info').first().json.repo}}/issues.
    When classifying issues, evaluate them based on issue content, root cause, resolution approach, how well they meet the criteria (high, medium, low), and technical difficulty (high, medium, low).

    [Criteria for good contribution opportunities]
    Issues with detailed and well-written content.
    Issues where bug or error logs and reproduction steps are clearly specified within the content.
    Issues where the location of suspicious source code has been identified by the reporter or maintainer.
    Issues where the maintainer has confirmed the problem, set a direction, or requested contributions.
    Issues directly created by the maintainer.
    Issues with a "good first issue" label and no "blocked" or "wait-for-triage" labels.
    Issues for which a PR has not yet been created (it's okay if someone has only stated they will create a PR).

    For issues that meet the above criteria well, explain and emphasize them in detail.
    There is no need to summarize issues that do not meet the above criteria.

    Generate a YAML object that matches the TypeScript type $IssueCollection below:
    (You MUST wrap every YAML list item in double quotes. If the string contains a double quote ("), escape it using a backslash (\"). This rule is STRICT and cannot be violated)
    
    Sort the 'issues' array in descending order based on the 'issueSuitability.level', with 'high' being the highest, followed by 'medium', and then 'low'.
    
    The summary should be a list of single sentences, where each sentence briefly highlights an issue suitable for today's contribution.

    type Level = "high" | "medium" | "low";

    interface LevelWithReasons {
        level: Level;
        reasons: string[];
    }

    interface Issue {
        issueTitle: string;
        issueURL: string;
        issueDescription: string;
        rootCause: string;
        resolutionApproach: string[];
        issueSuitability: LevelWithReasons;
        technicalDifficulty: LevelWithReasons;
    }

    interface IssueCollection {
        issues: Issue[];
        summary: string[];
    }

    ------------
    Example output:
    issues:
    - issueTitle: |
      ...
      issueURL: "https://example.com"
      issueDescription: |
      ...
      rootCause: |
      ...
      resolutionApproach:
        - ".\\"...\\".."
      issueSuitability:
        level: "medium"
        reasons:
            - "..."
      technicalDifficulty:
        level: "high"
        reasons:
            - "..."
    summary:
      - "..."
`

module.exports = {    
    "promptType": "=define",
    "text": `=${userPrompt}`,
    "needsFallback": true,
    "options": {
        "systemMessage": `=${systemPrompt}`,
        "batching": {
            "delayBetweenBatches": 2
        }
    }
}
