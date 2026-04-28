# CageVault — Project Roadmap

---

## FIGHTER DOSSIERS — Strategic Growth Initiative

### Section Name: **Combat Dossier**

_(Name rationale: fits our military/classified ops theme perfectly — "DOSSIER" evokes a classified file on a subject, which is exactly what a deep fighter profile is. Alternatives considered: "Fighter Intel" ✓, "Agent Files" ✓, "Operator Profiles" ✓, "Classified Files" — rejected, overuses existing banner copy. "Combat Dossier" is unique, memorable, and branded.)_

---

### Why This Feature Is Critical

1. **SEO / Organic Traffic (Year-Round)**
   Sherdog and Tapology rank for nearly every "[Fighter Name] stats" Google search. Each has thousands of indexed pages. CageVault currently has zero. A dedicated `/fighters/[slug]` page for every UFC fighter gives us 600–1,500 Google-indexable URLs immediately. Long-tail queries like "Carlos Prates win streak", "Khamzat Chimaev grappling stats", "Jon Jones DFS value" are all winnable with a well-structured profile page. These pages drive traffic 365 days a year — not just fight week.

2. **User Retention**
   Tapology and Sherdog are reference databases — users look something up and leave. CageVault profiles make users _act_: see the AI pick → vote → build a lineup → place a parlay → click an affiliate link. The profile becomes a funnel, not a dead end.

3. **Competitive Differentiation**
   No competitor combines AI win probability + DFS projections + +EV betting insights + community votes on a single fighter page. This is our moat.

4. **Affiliate Revenue**
   Every fighter profile on this week's card becomes a contextual ad placement — "Bet [Fighter] on DraftKings" with our affiliate link, right next to the AI pick.

5. **Brand Authority**
   When CageVault shows up in Google for "[Fighter Name] stats" before Sherdog, we've won. It signals we're the serious MMA analytics platform.

---

### Target Scope — v1

| Phase | Scope                                             | Timeline |
| ----- | ------------------------------------------------- | -------- |
| v1.0  | All current + recently active UFC fighters (~600) | Week 1–4 |
| v1.1  | Top 200 LFA / Cage Warriors / DWCS prospects      | Week 5–8 |
| v2.0  | Historical fighters (all-time UFC roster ~2,000+) | Month 3+ |

Target total v1: **600–800 profiles**.
At 5 organic visits/day/profile average, that's **3,000–4,000 daily organic visits** at maturity.

---

### How We Differentiate (vs Sherdog / Tapology)

| Feature                       | Sherdog / Tapology | CageVault Combat Dossier                  |
| ----------------------------- | ------------------ | ----------------------------------------- |
| Basic bio / record            | Yes                | Yes + dynamic last-5 + streaks            |
| Fight history                 | Yes                | Yes + AI prediction for each past fight   |
| This week's AI pick           | No                 | **Yes — CageVault AI Win % + reasoning**  |
| Community vote                | Basic              | Live % + your vote                        |
| DFS / fantasy projections     | No                 | Projected fantasy points + salary value   |
| +EV betting insights          | No                 | Highlighted best bets / props             |
| Highlight videos              | Basic links        | Embedded + multiple clips                 |
| Model track record vs fighter | No                 | "Our AI is 7-2 when picking this fighter" |
| SEO / discoverability         | Good               | Dedicated page + JSON-LD rich snippets    |
| Affiliate CTAs                | None               | Contextual "Bet [Fighter]" on fight week  |

---

### High-Level Timeline

**Week 1 — Data Pipeline**

- `scripts/build_fighter_profiles.py` scrapes all 600 fighters
- Outputs `public/fighters_index.json` (directory) + `public/fighter_profiles/{slug}.json` (profiles)
- UFC.com portrait URL fetching for all fighters
- YouTube highlight ID batch lookup

**Week 2 — Backend**

- `GET /api/fighters` — paginated directory with search
- `GET /api/fighters/{slug}` — full profile
- `POST /api/fighters/{slug}/vote` — community vote
- `GET /api/fighters/{slug}/votes` — vote totals

**Week 3 — Frontend**

- `/fighters` — Fighter Directory (search, filter by weight class / country / team)
- `/fighters/:slug` — Full Combat Dossier profile page

**Week 4 — Polish + SEO**

- JSON-LD structured data per fighter page
- `<meta>` OG/Twitter tags per profile
- Sitemap generation script
- Mobile QA pass

---

## Bug Fixes & Polish Queue

### Critical (Fix Before Next Deploy)

- [ ] `NaN% WIN` on Fight Analyzer fight cards — `winProb` is NaN when stats are missing; add `|| 50` fallback
- [ ] Parlay Builder share text says `thecombatvault.com` — should be `cagevault.com`
- [ ] `PLACEHOLDER_FIGHTS` in ParlayBuilder.jsx is hardcoded to April 25 card — update each week or auto-clear

### Production Essentials (Missing)

- [ ] Favicon / app icon
- [ ] `<meta name="description">` in index.html
- [ ] Open Graph tags (og:title, og:image, og:description)
- [ ] Twitter Card meta tags
- [ ] robots.txt
- [ ] sitemap.xml (auto-generated from fighter profiles + static pages)
- [ ] Privacy Policy page (`/privacy`)
- [ ] Terms of Service page (`/terms`)
- [ ] Custom 404 page
- [ ] Google Analytics / tracking

### UX Polish

- [ ] "FIGHT #N/A" section labels — fight positions not resolving
- [ ] Home page news section shows empty when no active fight week content
- [ ] Nav has 9 desktop items — group under dropdowns
- [ ] Branding inconsistency — pick "CageVault" or "Combat Vault" everywhere
- [ ] Social share buttons for picks / lineups
- [ ] Email newsletter CTA
- [ ] No social links in footer (Twitter/X, Discord)

---

## Competitive Roadmap — Features to Add

### High Impact / Low Effort

- [ ] No-vig / fair odds calculator (`/tools/no-vig`)
- [ ] Kelly Criterion bankroll calculator (`/tools/kelly`)
- [ ] Line movement history chart on Live Odds page
- [ ] PrizePicks / Underdog Fantasy projection support (not just DraftKings)
- [ ] Fighter ranking badges (show UFC ranking on profile + fight cards)

### High Impact / Medium Effort

- [ ] Pick share image cards (styled bet slip PNG export for Twitter/X)
- [ ] Community consensus picks (% of users who picked each fighter)
- [ ] Email newsletter system (Mailchimp or Resend integration)
- [ ] "Live DFS scoring" — DFS points accruing in real time during events

### High Impact / High Effort

- [ ] Historical fight search (search any UFC fight ever)
- [ ] Weight class overview pages (rankings + stats by division)
- [ ] Fighter comparison tool (head-to-head any two fighters)
- [ ] Mobile app (Capacitor — Android build already scaffolded)
