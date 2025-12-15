![issue-collector](https://github.com/user-attachments/assets/9ba3c7b4-f26f-4d7c-926d-d212c40dfe41)

# IssueCollector
Receive a periodic newsletter with curated, contributor-friendly issues from your favorite repositories, for free, using Github Actions and Open Router.

The brain recognizes things it sees frequently as important. To encourage open-source contributions, regularly review issues and recent releases.

## 🚀 Features
- **Good issues for open source contribution:**
  - keywords, analogy, issue description, root cause, 
    resolution approach, issue suitability, technical difficulty
- **Latest release descriptions** for open source projects
- **Related Deepwiki link**

## 💡 About
At an open-source contribution program kickoff, it was mentioned that the contribution rate drops sharply after the program ends. I believe this is because the connection to the open-source project is lost, and the brain automatically de-prioritizes it.

Therefore, I wanted to create a newsletter to help people who want to continue contributing stay connected to their projects.

## 📋 Requirements
- [Github Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)
- [Openrouter API key](https://openrouter.ai/settings/keys)
- [Google App Password](https://myaccount.google.com/apppasswords)
- Check if the open-source project you are interested in is indexed at `https://deepwiki.com/{owner}/{repo}`
  (e.g. `https://deepwiki.com/vercel/next.js`)

## ⚙️ How to use

You can use this project in two different ways.
Choose either one depending on your preferred workflow.

### Option 1 - Run on Github
1.  Fork this repository.
2.  Prepare the items listed in the **Requirements** section.
3.  In your repository settings, navigate to `Settings` > `Security` > `Secrets and variables` > `Actions` to add the following:
    - **Secrets**
        - `GOOGLE_APP_PASSWORD`
        - `N8N_GITHUB_ACCESS_TOKEN`
        - `OPENROUTER_API_KEY`
    - **Variables**
        - `EMAIL`
        - `REPO` (e.g. `vercel/next.js`)
        - (Optional) `TRANSLATION_LANGUAGE` (e.g. `ko-KR`)
4.  (Optional) Adjust the cron schedule for the GitHub Action to your desired frequency.
    -   The default is once a week.

### Option 2 - Use the n8n template
1. Import the [template](https://n8n.io/workflows/11549-curate-contributor-friendly-issues-with-ai-and-send-github-newsletter-via-email/) from the n8n Hub.
2. Update the **“Load repo info”** node with your target repository’s owner and name (e.g. `owner: vercel`, `repo: next.js`). 
3. Add your GitHub Personal Access Token to the credentials of the **“Get Issues from GitHub”** node. 
4. Connect your OpenRouter API key to all models linked to the **Agent** node. 
5. Add your Google App Password to the **“Send Email”** node credentials.
6. Enter the same email address (associated with the Google App Password) in both the **“to email”** and **“from email”** fields — the newsletter will be sent to this address. 

## 🙏 Acknowledgements
- [contribution-issue-collector](https://github.com/KumJungMin/contribution-issue-collector)

## ✨ Future Steps
- A public site for subscribing to the newsletter is ongoing and will be released in a couple of weeks!
