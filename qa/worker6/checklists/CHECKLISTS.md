# Check lists by feature type. Each item: YES/NO. Any NO = send back for rewrite.

## Page load
| Check | Standard | Source |
|---|---|---|
| LCP <= 2.5 s (75th pct) | Core Web Vitals "good" | https://web.dev/articles/vitals |
| INP <= 200 ms | Core Web Vitals | https://web.dev/articles/inp |
| CLS <= 0.1 | Core Web Vitals | https://web.dev/articles/cls |
| TTFB <= 0.8 s | web.dev guidance | https://web.dev/articles/ttfb |
| Page has a title | WCAG 2.2 SC 2.4.2 | https://www.w3.org/TR/WCAG22/#page-titled |
| html lang set | WCAG 2.2 SC 3.1.1 | https://www.w3.org/TR/WCAG22/#language-of-page |
| Loading state shown if >1 s | NN/g response-time limits (0.1/1/10 s) | https://www.nngroup.com/articles/response-times-3-important-limits/ |

## Scrolling / animation
| Check | Standard | Source |
|---|---|---|
| Honors prefers-reduced-motion | WCAG 2.2 SC 2.3.3 (AAA) + MDN | https://www.w3.org/TR/WCAG22/#animation-from-interactions , https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion |
| Auto-moving content >5 s can pause/stop | WCAG 2.2 SC 2.2.2 | https://www.w3.org/TR/WCAG22/#pause-stop-hide |
| Nothing flashes >3 times/s | WCAG 2.2 SC 2.3.1 | https://www.w3.org/TR/WCAG22/#three-flashes-or-below-threshold |
| Animate only transform/opacity; no layout thrash | web.dev animations guide | https://web.dev/articles/animations-guide |
| No horizontal scroll at 320 CSS px | WCAG 2.2 SC 1.4.10 Reflow | https://www.w3.org/TR/WCAG22/#reflow |
| Interaction latency stays good while scrolling | INP <= 200 ms | https://web.dev/articles/inp |

## Forms
| Check | Standard | Source |
|---|---|---|
| Every field has a label | WCAG 2.2 SC 3.3.2, 1.3.1 | https://www.w3.org/TR/WCAG22/#labels-or-instructions |
| Errors named in text, with fix hint | WCAG 2.2 SC 3.3.1, 3.3.3 | https://www.w3.org/TR/WCAG22/#error-identification |
| Don't ask for the same info twice | WCAG 2.2 SC 3.3.7 | https://www.w3.org/TR/WCAG22/#redundant-entry |
| autocomplete attributes on personal fields | WCAG 2.2 SC 1.3.5 | https://www.w3.org/TR/WCAG22/#identify-input-purpose |
| Inline validation after field, not while typing | NN/g form errors | https://www.nngroup.com/articles/errors-forms-design-guidelines/ |
| Server-side validation of all input; XSS/SQLi strings inert | OWASP ASVS (V5 validation/encoding) | https://owasp.org/www-project-application-security-verification-standard/ |
| Targets >= 24x24 CSS px | WCAG 2.2 SC 2.5.8 | https://www.w3.org/TR/WCAG22/#target-size-minimum |

## Sign-in
| Check | Standard | Source |
|---|---|---|
| Paste allowed, no cognitive test | WCAG 2.2 SC 3.3.8 Accessible Authentication | https://www.w3.org/TR/WCAG22/#accessible-authentication-minimum |
| Min 8 chars, no composition rules, breached-password check | NIST SP 800-63B | https://pages.nist.gov/800-63-4/sp800-63b.html |
| Generic error (no user enumeration), rate limiting | OWASP Authentication Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| Session cookies Secure, HttpOnly, SameSite; rotate on login | OWASP Session Mgmt Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html |
| Auth controls meet ASVS L1 | OWASP ASVS | https://owasp.org/www-project-application-security-verification-standard/ |
| Tests never use Amit's Google sign-in | COMMON-RULES | local file |

## Voice
| Check | Standard | Source |
|---|---|---|
| Mic permission asked only on user action, denial handled | web.dev permissions best practices | https://web.dev/articles/permissions-best-practices |
| Captions/transcript for spoken output | WCAG 2.2 SC 1.2.1 / 1.2.2 | https://www.w3.org/TR/WCAG22/#captions-prerecorded |
| Audio >3 s that autoplays can be paused | WCAG 2.2 SC 1.4.2 | https://www.w3.org/TR/WCAG22/#audio-control |
| Every voice function also works without voice | WCAG 2.2 SC 2.1.1 Keyboard | https://www.w3.org/TR/WCAG22/#keyboard |
| Visible label text matches spoken command name | WCAG 2.2 SC 2.5.3 Label in Name | https://www.w3.org/TR/WCAG22/#label-in-name |
| Response start latency | UNKNOWN: no official industry number found; use NN/g 1 s limit as proxy | https://www.nngroup.com/articles/response-times-3-important-limits/ |
