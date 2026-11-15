---
title: Git, the everyday parts
blurb: The dozen commands that cover nearly everything.
topic: Workflow
order: 50
---

Git keeps the history of a folder. Each **commit** is a snapshot with a
message saying why.

## The daily loop

```bash
git status                 # what's changed?
git diff                   # exactly how?
git add file.py            # choose what goes in the next snapshot
git commit -m "Explain why, not what"
git push                   # send it to GitHub
git pull                   # bring others' work in
```

## Branches: try something without breaking main

```bash
git switch -c try-new-layout   # a new branch, and move to it
# ...work, commit...
git switch main                # back; your branch is still there
git merge try-new-layout       # bring it in when it works
```

## Looking back

```bash
git log --oneline -20          # recent history
git log -p -- path/to/file     # every change to one file
git blame file.py              # who last changed each line, and in which commit
git show abc1234               # one commit in full
```

## Undoing

```bash
git restore file.py            # throw away uncommitted changes to a file
git restore --staged file.py   # un-add it (keeps the changes)
git commit --amend             # fix the last commit's message or contents
git revert abc1234             # a new commit that undoes an old one
```

> Prefer `revert` over rewriting history once something is pushed -- other
> copies of the repository already have the old history.

## Good commit messages

The first line says what changed in under ~60 characters; the body says
**why**. "Fix bug" helps nobody in a year. "Stop the queue dropping the last
item when it wraps" tells the next reader exactly what to look for.
