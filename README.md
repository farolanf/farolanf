# farolanf

I build small SaaS products, and the machinery that decides which one gets worked
on next.

Mostly I'm not hand-coding any more. I design the architecture and the guardrails,
then unattended agent sessions do the mechanical work, and nothing counts as done
until it's verified against real evidence. That green wall below is 5,740
contributions in twelve months, almost all of them in private repos, and most are
agent-authored. The volume isn't the interesting part. What's interesting is what
the guardrails refuse.

<!-- FLEET-CARD -->
<picture>
  <source media="(prefers-color-scheme: dark)"
          srcset="https://raw.githubusercontent.com/farolanf/farolanf/main/stats/fleet-dark.svg?v=20260901">
  <img alt="fleet stats"
       src="https://raw.githubusercontent.com/farolanf/farolanf/main/stats/fleet-light.svg?v=20260901">
</picture>
<!-- /FLEET-CARD -->

## How I work

- Agents work here unattended, and when something needs my judgment they DM me
  with the options, so I either tap one or type a direction they didn't offer.
  We build it together from there, and once it ships it runs its own loop:
  production errors get filed, fixed and deployed without me in the middle of it,
  and I come back in only where there's a call to make. Destroying data is the
  one thing they never do alone.

- Coverage is a smoke detector, and one repo-wide number lies in both directions.
  One product here reads 66.91% overall, which tells you nothing: the domain is
  gated at 99 and reaches 99.22, the adapters sit at 0 with the reason written
  beside the exclusion, and each gate is set a little under what the suite
  actually reaches so it fires on a regression instead of on noise. I started
  doing it this way after finding 300 passing tests, an architecture guard, and
  the two rules the product exists for at 13%.

- Reading a whole file to find one thing is the expensive habit, so I built a
  grep-able digest of every symbol and the line it sits on. One model file here
  costs about 26,000 tokens to read, its digest costs 2,900, and the answer to
  "what runs when this record saves" costs 140. There's no daemon and nothing to
  remember to re-run: it reconciles against the working tree on every call,
  because a copy that syncs on a timer is a second source of truth, and between
  the edit and the sync it answers confidently and wrongly.

- In this loop the products harden over time on their own: an incident produces a
  rule, the rule gets a test, and every run after that carries it. What's left for
  me isn't writing the code any more, it's noticing when a hardening stopped at
  the product it happened in and never travelled, and then making that noticing
  automatic too.

## Stack

TypeScript on Cloudflare edge, Rust for the rigorous core, Rails over deep
PostgreSQL, Python for the LLM services. Production SaaS with the un-fun
correctness in it: billing, credits, subscriptions, webhooks that fan out.

<div align="center">
<a href="https://github.com/farolanf" target="_blank">
<img src=https://img.shields.io/badge/github-%2324292e.svg?&style=for-the-badge&logo=github&logoColor=white alt=github style="margin-bottom: 5px;" />
</a>
<a href="https://twitter.com/farolanfaisal" target="_blank">
<img src=https://img.shields.io/badge/twitter-%2300acee.svg?&style=for-the-badge&logo=twitter&logoColor=white alt=twitter style="margin-bottom: 5px;" />
</a>
<a href="https://codepen.com/farolan" target="_blank">
<img src=https://img.shields.io/badge/codepen-%23131417.svg?&style=for-the-badge&logo=codepen&logoColor=white alt=codepen style="margin-bottom: 5px;" />
</a>
<a href="https://stackoverflow.com/users/5790048/farolan-faisal" target="_blank">
<img src=https://img.shields.io/badge/stackoverflow-%23F28032.svg?&style=for-the-badge&logo=stackoverflow&logoColor=white alt=stackoverflow style="margin-bottom: 5px;" />
</a>
<a href="https://linkedin.com/in/farolanfaisal" target="_blank">
<img src=https://img.shields.io/badge/linkedin-%231E77B5.svg?&style=for-the-badge&logo=linkedin&logoColor=white alt=linkedin style="margin-bottom: 5px;" />
</a>
</div>
