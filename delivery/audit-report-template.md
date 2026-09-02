# Upgrade Audit — {{CLIENT}} / {{APP}}

Prepared by {{YOUR_NAME}} · {{DATE}} · Confidential

## 1. Summary (read this if nothing else)
- Current stack: PHP {{X}}, {{FRAMEWORK}} {{VERSION}}, {{N}} PHP files / {{LOC}} lines, {{DEPS}} dependencies, {{TESTS}} tests.
- Target: PHP 8.4 + {{FRAMEWORK_TARGET}}.
- Upgrade risk: {{RISK}}/10. Biggest blockers: {{BLOCKER_1}}, {{BLOCKER_2}}, {{BLOCKER_3}}.
- Recommended path: {{PATH}} in {{WEEKS}} weeks.
- **Fixed price for the sprint: ${{PRICE}}** (this audit's $490 is credited). Valid 30 days.

## 2. Inventory
| Area | Finding | Evidence |
|---|---|---|
| Runtime | PHP {{X}} (EOL {{DATE}}) | `composer.json` `php` constraint, Dockerfile, hosting panel |
| Framework | {{FRAMEWORK}} {{VERSION}} | `composer.lock` / `framework/YiiBase.php` |
| Database layer | {{mysql_* / PDO / AR}} | scan output |
| Extensions | {{list}} | scan output |
| CI / tests | {{none / phpunit / codeception}} | repo |
| Deploy | {{FTP / git pull / docker}} | conversation |

## 3. Blockers (must fix before PHP 8.4 boots the app)
Numbered because the order is the order of the work.
1. {{e.g. `mysql_*` calls — 143 usages in 27 files → PDO/mysqli wrapper}}
2. {{e.g. `each()` — removed in PHP 8.0 — 12 usages}}
3. {{e.g. Yii 1.1.14 → 1.1.30 (community PHP 8 fixes)}}
4. …

## 4. Deprecations (app runs, logs fill up, next PHP version breaks)
- {{implicit nullable params — 58 usages}}
- {{dynamic properties — {{N}} classes need `#[AllowDynamicProperties]` or declared props}}
- {{`${var}` interpolation — 9 usages}}

## 5. Dependencies
| Package | Now | Action |
|---|---|---|
| swiftmailer/swiftmailer | 5.4 | replace with symfony/mailer |
| … | | |

## 6. Risk map
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| No tests → regressions unnoticed | high | high | Manual regression checklist (section 8) + smoke tests on top 20 routes |
| … | | | |

## 7. Plan
| Week | Work | Deliverable |
|---|---|---|
| 1 | Environment on PHP 8.4 in Docker, Rector run for mechanical rewrites, blockers 1–3 | App boots, CI green on syntax/lint |
| 2 | Dependencies, deprecations, framework bump, regression pass | Staging on PHP 8.4 |
| 3 | Fixes from staging, production cut-over support | Production on PHP 8.4, 30 days of fixes |

## 8. Regression checklist (for the client's QA)
- [ ] Login / logout / password reset
- [ ] {{top revenue flow}}
- [ ] {{reports / exports}}
- [ ] {{cron jobs}}

## 9. Quick wins you can do today (free)
- {{e.g. add `"php": ">=7.4"` platform pin so composer stops resolving PHP 5 packages}}

## Appendix A — raw scan output
```
{{paste tools/scan.php output}}
```
