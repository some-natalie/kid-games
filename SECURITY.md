# Security policy

## Supported versions

Security fixes are made on the latest `main` branch. Older snapshots are not
maintained release lines; update to the latest code and rebuild your deployment.

## Reporting a vulnerability

Do not publish vulnerabilities, exploit details, secrets, or children's
information in public issues or pull requests.

If the repository's **Security** tab offers **Report a vulnerability**, use
GitHub's private vulnerability reporting flow. This option depends on repository
settings and may not yet be available.

Otherwise, use a private contact channel published by the maintainer,
[@some-natalie](https://github.com/some-natalie). If none is available, request a
private reporting channel without disclosing vulnerability details publicly.
Do not send sensitive material until a private channel is established.

Include the affected commit or deployment, reproduction steps, expected impact,
and a minimal demonstration using synthetic data. Never test against other
people's browsers, accounts, or deployments without permission.

The maintainer will assess the report and coordinate a fix and disclosure.
There is no guaranteed response time or bug bounty program.

## Maintainer checklist before public launch

- Enable GitHub private vulnerability reporting and verify the reporting flow,
  or publish a working private security contact.
- Review repository history and artifacts for credentials and private data;
  rotate any exposed credentials rather than relying on deletion alone.
- Verify Actions permissions, deployment settings, and dependency alerts.

This policy is not a claim that a security audit has been performed.
