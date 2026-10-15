# GitHub Copilot Instructions

## Restricted Directory: Données/

The directory `Données/` contains private and sensitive data.

GitHub Copilot must follow these rules:

- NEVER read or open files inside `Données/`.
- NEVER search, scan, index, or analyze this directory.
- NEVER use its contents as context.
- NEVER modify, delete, or move files in this directory.
- NEVER execute commands or scripts that access this directory.
- NEVER include data from this directory in prompts or responses.
- Apply these restrictions recursively to all subdirectories.

If a task requires accessing `Données/`, stop and ask the user for an alternative.

Use mock data or synthetic examples instead.