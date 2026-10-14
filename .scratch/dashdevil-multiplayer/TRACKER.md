# GitHub wayfinding tracker

Repository: `shivang991/DashDevil2D`.

The canonical map is [DashDevil Multiplayer — implementation-ready specification map](https://github.com/shivang991/DashDevil2D/issues/2). Local map and issue Markdown files are historical charting snapshots, not live tracker state. `github-issues.json` maps local snapshot filenames to GitHub identities and URLs.

## Wayfinding operations

- Load the canonical map from GitHub at the start of each session. Its label is `wayfinder:map`.
- Tickets are native sub-issues of the map, labelled only `wayfinder:grilling` or `wayfinder:research`. Always refer to issues by linked title.
- Enumerate children with `gh api repos/shivang991/DashDevil2D/issues/2/sub_issues`. For each child, query `issues/<number>/dependencies/blocked_by` in the same repository API path.
- The frontier is open, unassigned children whose blockers are all closed. Choose in map sub-issue order. A closed blocker satisfies its dependency.
- Claim before work: `gh issue edit <issue-url> --add-assignee @me`. The assignee is the claim; preserve other sessions' edits.
- Resolve in a GitHub comment, close the issue, then append a linked one-line gist to the map's Decisions so far. Detailed answers live in their ticket or its linked asset, not the map.
- For new decisions, create all issues first, then attach them with the native sub-issue API and wire native dependencies. Use numeric REST issue IDs, not issue numbers, for `sub_issue_id` and `issue_id` request fields.
- Keep open issues out of the map body: GitHub's sub-issue list and dependency UI provide that view.
- Work one human decision ticket per session. Research may resolve independently, with a Markdown asset on a pushed throwaway research branch and no PR or merge.
- Consult wayfinder, grilling and domain-modeling; research tickets also consult research. This effort remains planning only, with no product code.
