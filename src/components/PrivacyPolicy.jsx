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

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-stone-950 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-yellow-600 text-xs font-mono tracking-[0.3em] uppercase mb-2">
            ⚡ COMBAT VAULT
          </p>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-stone-500 text-xs">Last updated: April 29, 2026</p>
        </div>

        <Section title="Who We Are">
          <p>
            Combat Vault ("we", "us", "our") operates the website at{" "}
            <span className="text-stone-300">cagevault.com</span>. We provide
            UFC fight analysis, DFS projections, and sports betting tools. This
            policy explains what data we collect, how we use it, and your
            rights.
          </p>
        </Section>

        <Section title="Information We Collect">
          <p>
            <span className="text-stone-200 font-semibold">Account data:</span>{" "}
            When you register, we collect your email address, username, and a
            hashed (never plain-text) password.
          </p>
          <p>
            <span className="text-stone-200 font-semibold">Payment data:</span>{" "}
            Subscription payments are processed by{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-500 hover:underline"
            >
              Stripe
            </a>
            . We never see or store your full card number. We store only your
            Stripe customer ID to manage your subscription.
          </p>
          <p>
            <span className="text-stone-200 font-semibold">Usage data:</span> We
            use Google Analytics to collect anonymized data about pages visited,
            session duration, and traffic sources (e.g., which video or link
            brought you here). This data does not identify you personally.
          </p>
          <p>
            <span className="text-stone-200 font-semibold">
              Cookies &amp; local storage:
            </span>{" "}
            We store your authentication token and preferences in your browser's
            local storage. No cross-site tracking cookies are set by us.
          </p>
        </Section>

        <Section title="How We Use Your Information">
          <ul className="list-disc list-inside space-y-1">
            <li>To create and manage your account</li>
            <li>
              To process your subscription and send payment receipts (via
              Stripe)
            </li>
            <li>To understand how people use the site so we can improve it</li>
            <li>
              To track which marketing efforts drive signups (UTM / referral
              source)
            </li>
          </ul>
          <p>
            We do <span className="text-stone-200 font-semibold">not</span> sell
            your personal data to third parties.
          </p>
        </Section>

        <Section title="Affiliate Links">
          <p>
            This site contains affiliate links to third-party sportsbooks and
            DFS platforms. If you click a link and sign up, we may earn a
            commission at no extra cost to you. We only link to licensed,
            regulated operators.
          </p>
        </Section>

        <Section title="Data Retention">
          <p>
            Your account data is retained as long as your account is active. You
            may request deletion at any time by emailing us at{" "}
            <a
              href="mailto:support@cagevault.com"
              className="text-yellow-500 hover:underline"
            >
              support@cagevault.com
            </a>
            . Analytics data is retained for 26 months per Google Analytics
            defaults.
          </p>
        </Section>

        <Section title="Your Rights">
          <p>
            Depending on your location, you may have rights to access, correct,
            or delete your personal data. To exercise these rights, contact{" "}
            <a
              href="mailto:support@cagevault.com"
              className="text-yellow-500 hover:underline"
            >
              support@cagevault.com
            </a>
            .
          </p>
          <p>
            <span className="text-stone-200 font-semibold">
              EU / UK users (GDPR):
            </span>{" "}
            Our lawful basis for processing is contract performance (account
            &amp; subscription) and legitimate interest (analytics). You have
            the right to object to analytics processing at any time.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-500 hover:underline"
              >
                Stripe
              </a>{" "}
              — payment processing
            </li>
            <li>
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-500 hover:underline"
              >
                Google Analytics
              </a>{" "}
              — anonymized usage analytics
            </li>
          </ul>
        </Section>

        <Section title="Responsible Gambling">
          <p>
            Combat Vault provides information and analysis for entertainment
            purposes only. We do not accept bets. If you or someone you know has
            a gambling problem, help is available:
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

        <Section title="Changes to This Policy">
          <p>
            We may update this policy from time to time. The "Last updated" date
            at the top of this page will reflect any changes. Continued use of
            the site after changes constitutes acceptance.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy?{" "}
            <a
              href="mailto:support@cagevault.com"
              className="text-yellow-500 hover:underline"
            >
              support@cagevault.com
            </a>
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-stone-800">
          <Link
            to="/"
            className="text-xs text-stone-500 hover:text-stone-300 transition"
          >
            ← Back to Combat Vault
          </Link>
        </div>
      </div>
    </div>
  );
}
