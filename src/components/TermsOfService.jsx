import React from "react";
import { Link } from "react-router-dom";

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-base font-bold text-yellow-500 uppercase tracking-widest mb-3 border-b border-yellow-900/40 pb-2">
      {title}
    </h2>
    <div className="text-stone-400 text-sm leading-relaxed space-y-3">
      {children}
    </div>
  </div>
);

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-stone-950 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-yellow-600 text-xs font-mono tracking-[0.3em] uppercase mb-2">
            ⚡ COMBAT VAULT
          </p>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-stone-500 text-xs">Last updated: April 29, 2026</p>
        </div>

        <Section title="Acceptance of Terms">
          <p>
            By accessing or using Combat Vault ("the Site", "we", "us"), you
            agree to be bound by these Terms of Service and our{" "}
            <Link to="/privacy" className="text-yellow-500 hover:underline">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the Site.
          </p>
        </Section>

        <Section title="Entertainment Purposes Only">
          <p>
            <span className="text-stone-200 font-semibold">
              Combat Vault is for entertainment and informational purposes only.
            </span>{" "}
            Nothing on this site constitutes financial, legal, or betting
            advice. We do not guarantee the accuracy of projections, AI picks,
            or odds data. Past performance of any prediction model does not
            guarantee future results.
          </p>
          <p>
            You assume all risk associated with any betting or DFS decisions
            made using information from this site. We are not liable for any
            losses.
          </p>
        </Section>

        <Section title="Eligibility">
          <p>
            You must be at least{" "}
            <span className="text-stone-200 font-semibold">
              18 years of age
            </span>{" "}
            (or the legal gambling age in your jurisdiction, whichever is
            higher) to use this site. By using the Site you represent that you
            meet this requirement.
          </p>
          <p>
            It is your responsibility to ensure that sports betting, DFS, and
            related activities are legal in your jurisdiction before using this
            site or any linked services.
          </p>
        </Section>

        <Section title="Accounts & Subscriptions">
          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials. You may not share your account with others.
          </p>
          <p>
            <span className="text-stone-200 font-semibold">
              Pro subscriptions
            </span>{" "}
            are billed monthly at $19.99/month via Stripe. You may cancel at any
            time from your Dashboard — cancellation takes effect at the end of
            the current billing period. We do not offer prorated refunds for
            partial months.
          </p>
          <p>
            <span className="text-stone-200 font-semibold">
              Free trial access
            </span>{" "}
            is offered at our discretion and may be discontinued at any time.
            Trial accounts are limited to one per email address.
          </p>
        </Section>

        <Section title="Affiliate Disclosure">
          <p>
            Combat Vault participates in affiliate programs with third-party
            sportsbooks and DFS platforms. When you click an affiliate link and
            sign up or deposit, we may receive a commission at{" "}
            <span className="text-stone-200 font-semibold">
              no extra cost to you
            </span>
            .
          </p>
          <p>
            We only link to licensed and regulated operators. The presence of an
            affiliate link does not constitute an endorsement of any specific
            bet, wager, or platform. Always read the terms of any offer before
            signing up.
          </p>
        </Section>

        <Section title="Intellectual Property">
          <p>
            All content on Combat Vault — including AI-generated picks,
            projections, fighter analysis, and site design — is the property of
            Combat Vault and may not be reproduced, scraped, or distributed
            without written permission.
          </p>
          <p>
            Fighter names, records, and statistics are factual data sourced from
            public records. We are not affiliated with the UFC, PFL, or any MMA
            promotion.
          </p>
        </Section>

        <Section title="Prohibited Use">
          <p>You may not:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use automated tools to scrape or harvest data from the site</li>
            <li>
              Attempt to reverse-engineer our projection models or algorithms
            </li>
            <li>
              Share, sell, or redistribute Pro content outside your account
            </li>
            <li>Use the site for any unlawful purpose</li>
            <li>
              Attempt to circumvent paywalls or access controls through
              technical means
            </li>
          </ul>
        </Section>

        <Section title="Disclaimer of Warranties">
          <p>
            The Site is provided "as is" without warranties of any kind. We do
            not warrant that the site will be uninterrupted, error-free, or that
            data (odds, projections, fighter stats) will be accurate or up to
            date at all times. Odds and injury data in particular can change
            rapidly.
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>
            To the fullest extent permitted by law, Combat Vault shall not be
            liable for any indirect, incidental, special, or consequential
            damages arising from your use of the site, including any gambling or
            DFS losses.
          </p>
        </Section>

        <Section title="Responsible Gambling">
          <p>
            Gambling should be entertaining — never bet more than you can afford
            to lose. If gambling is affecting your life negatively, please seek
            help:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <span className="text-stone-200">US:</span> 1-800-GAMBLER |{" "}
              <a
                href="https://www.ncpgambling.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-500 hover:underline"
              >
                ncpgambling.org
              </a>
            </li>
            <li>
              <span className="text-stone-200">UK / Ireland:</span>{" "}
              <a
                href="https://www.begambleaware.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-500 hover:underline"
              >
                BeGambleAware.org
              </a>{" "}
              | 0808 8020 133
            </li>
            <li>
              <span className="text-stone-200">Australia:</span>{" "}
              <a
                href="https://www.gamblinghelponline.org.au"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-500 hover:underline"
              >
                GamblingHelpOnline.org.au
              </a>{" "}
              | 1800 858 858
            </li>
          </ul>
        </Section>

        <Section title="Changes to Terms">
          <p>
            We may update these Terms at any time. Continued use of the site
            after changes constitutes acceptance of the revised Terms. The "Last
            updated" date at the top reflects the most recent revision.
          </p>
        </Section>

        <Section title="Governing Law">
          <p>
            These Terms shall be governed by the laws of the United States. Any
            disputes shall be resolved through binding arbitration rather than
            in court, except where prohibited by law.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these Terms?{" "}
            <a
              href="mailto:support@cagevault.com"
              className="text-yellow-500 hover:underline"
            >
              support@cagevault.com
            </a>
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-stone-800 flex items-center gap-6">
          <Link
            to="/"
            className="text-xs text-stone-500 hover:text-stone-300 transition"
          >
            ← Back to Combat Vault
          </Link>
          <Link
            to="/privacy"
            className="text-xs text-stone-500 hover:text-stone-300 transition"
          >
            Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}
