# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wiring/settings-account.spec.ts >> settings + account wiring >> /settings/preferences mounts its component
- Location: tests/e2e/wiring/settings-account.spec.ts:16:9

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - link "Skip to page" [ref=e3] [cursor=pointer]:
      - /url: "#main"
    - navigation "Pages" [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]: T
        - generic [ref=e7]: Tempo
      - button "Search or jump to Ctrl K" [ref=e8] [cursor=pointer]:
        - generic [ref=e11]: Search or jump to
        - generic [ref=e12]: Ctrl K
      - list [ref=e14]:
        - listitem [ref=e15]:
          - link "Today" [ref=e16] [cursor=pointer]:
            - /url: /today
        - listitem [ref=e21]:
          - link "Brain dump" [ref=e22] [cursor=pointer]:
            - /url: /brain-dump
        - listitem [ref=e27]:
          - link "Coach" [ref=e28] [cursor=pointer]:
            - /url: /coach
        - listitem [ref=e33]:
          - link "Plan" [ref=e34] [cursor=pointer]:
            - /url: /plan
      - generic [ref=e39]:
        - generic [ref=e40]: Pages
        - list "Pages" [ref=e41]:
          - listitem [ref=e42]:
            - link "All pages" [ref=e43] [cursor=pointer]:
              - /url: /notes
          - listitem [ref=e48]:
            - link "Templates" [ref=e49] [cursor=pointer]:
              - /url: /templates
      - generic [ref=e54]:
        - generic [ref=e55]: Library
        - list "Library" [ref=e56]:
          - listitem [ref=e57]:
            - link "Tasks" [ref=e58] [cursor=pointer]:
              - /url: /tasks
          - listitem [ref=e63]:
            - link "Journal" [ref=e64] [cursor=pointer]:
              - /url: /journal
          - listitem [ref=e69]:
            - link "Calendar" [ref=e70] [cursor=pointer]:
              - /url: /calendar
          - listitem [ref=e75]:
            - link "Habits" [ref=e76] [cursor=pointer]:
              - /url: /habits
          - listitem [ref=e81]:
            - link "Routines" [ref=e82] [cursor=pointer]:
              - /url: /routines
          - listitem [ref=e87]:
            - link "Goals" [ref=e88] [cursor=pointer]:
              - /url: /goals
          - listitem [ref=e93]:
            - link "Projects" [ref=e94] [cursor=pointer]:
              - /url: /projects
      - generic [ref=e99]:
        - generic [ref=e100]: You
        - list "You" [ref=e101]:
          - listitem [ref=e102]:
            - link "Insights" [ref=e103] [cursor=pointer]:
              - /url: /insights
          - listitem [ref=e108]:
            - link "Search" [ref=e109] [cursor=pointer]:
              - /url: /search
          - listitem [ref=e114]:
            - link "Coach history" [ref=e115] [cursor=pointer]:
              - /url: /history
          - listitem [ref=e120]:
            - link "Recent activity" [ref=e121] [cursor=pointer]:
              - /url: /activity
          - listitem [ref=e126]:
            - link "Memory" [ref=e127] [cursor=pointer]:
              - /url: /settings/memory
          - listitem [ref=e132]:
            - link "Nags" [ref=e133] [cursor=pointer]:
              - /url: /settings/nags
      - generic [ref=e138]:
        - button "Reading font" [ref=e139] [cursor=pointer]
        - button "עברית" [ref=e144] [cursor=pointer]
        - listitem [ref=e149]:
          - link "Settings" [ref=e150] [cursor=pointer]:
            - /url: /settings/profile
        - button "Sign out" [ref=e155] [cursor=pointer]
    - banner [ref=e160]:
      - generic [ref=e161]:
        - generic [ref=e162]: Settings
        - strong [ref=e165]: Preferences
      - button "Search or jump to" [ref=e166] [cursor=pointer]
      - button "Dark theme" [ref=e169] [cursor=pointer]
    - main [ref=e172]:
      - generic [ref=e173]:
        - generic [ref=e175]:
          - heading "Preferences" [level=1] [ref=e176]
          - paragraph [ref=e177]: Make Tempo comfortable to read and to use. Changes save as you go.
          - status
        - status [ref=e179]:
          - generic [ref=e180]: Loading your preferences
    - button "Open coach (Ctrl J)" [ref=e187] [cursor=pointer]:
      - generic [ref=e190]: Coach
  - button "Open Next.js Dev Tools" [ref=e196] [cursor=pointer]
  - alert [ref=e200]
```