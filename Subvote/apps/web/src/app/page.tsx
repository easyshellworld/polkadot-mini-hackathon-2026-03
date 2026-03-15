import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-shell">
      <div className="landing-backdrop" aria-hidden="true" />
      <div className="landing-noise" aria-hidden="true" />
      <div className="landing-vignette" aria-hidden="true" />

      <section className="landing-hero">
        <p className="landing-kicker">community voting, quietly staged</p>
        <h1 className="landing-title">subvote</h1>
        <p className="landing-copy">
          A calm front door for proposals, participation, and collective
          decisions.
        </p>

        <Link className="landing-cta" href="/app">
          <span>Enter App</span>
          <svg
            className="landing-cta-icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 12H19M13 6L19 12L13 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </section>
    </main>
  );
}
