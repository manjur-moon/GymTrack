
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  ChartNoAxesCombined,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  ShieldCheck,
  Users,
} from "lucide-react";

import { DemoButton } from "@/components/auth-buttons";

export default function Home() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="container landing-hero-grid">
          <div className="landing-copy stack">
            <span className="landing-eyebrow">
              <span className="eyebrow-dot" />
              THE TRAINING WORKSPACE
            </span>

            <h1>
              Make every session <em>count.</em>
            </h1>

            <p>
              One connected workspace for training plans,
              workout records, client progress and better
              coaching decisions.
            </p>

            <div className="landing-actions">
              <Link className="btn" href="/register">
                Get started
                <ArrowRight size={17} aria-hidden />
              </Link>

              <DemoButton />
            </div>

            <div className="landing-proof">
              <CheckCircle2 size={17} aria-hidden />
              <span>
                Explore real seeded training history—no credit
                card required.
              </span>
            </div>
          </div>

          <div
            className="landing-product-preview"
            aria-label="Illustration of the proposed GymTrack coaching workspace"
          >
            <div className="preview-topline">
              <span className="preview-indicator" />
              COACHING OVERVIEW
              <span className="preview-topline-right">
                ILLUSTRATIVE UI
              </span>
            </div>

            <div className="preview-welcome">
              <div>
                <span>YOUR WORKSPACE</span>
                <strong>Plan. Train. Progress.</strong>
              </div>

              <div className="preview-mini-icon">
                <Dumbbell size={21} aria-hidden />
              </div>
            </div>

            <div className="preview-stats">
              <div>
                <span>Programs</span>
                <strong>04</strong>
              </div>
              <div>
                <span>Sessions</span>
                <strong>24</strong>
              </div>
              <div>
                <span>Progress</span>
                <strong>↗</strong>
              </div>
            </div>

            <div className="preview-graph">
              <div className="preview-graph-top">
                <span>Training consistency</span>
                <span>Last 6 weeks</span>
              </div>

              <div className="preview-chart">
                {[35, 50, 43, 72, 62, 89].map((height, i) => (
                  <span
                    key={i}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>

              <div className="preview-chart-axis">
                {["W1", "W2", "W3", "W4", "W5", "W6"].map(
                  (week) => (
                    <span key={week}>{week}</span>
                  )
                )}
              </div>
            </div>

            <div className="preview-footer">
              <span>
                <CheckCircle2 size={15} aria-hidden />
                Structured workouts
              </span>

              <span>
                Progress you can understand
                <ArrowUpRight size={14} aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        className="container landing-section stack"
        aria-labelledby="who-title"
      >
        <div className="landing-section-heading">
          <p className="eyebrow">
            BUILT FOR THE FULL TRAINING LOOP
          </p>

          <h2 id="who-title">
            Two perspectives. One place to improve.
          </h2>

          <p className="muted">
            Follow the full journey from training plans
            to completed sessions and visible progress.
          </p>
        </div>

        <div className="grid two persona-grid">
          <article className="persona-card">
            <div className="persona-icon">
              <Users size={24} aria-hidden />
            </div>

            <p className="eyebrow">FOR COACHES</p>

            <h3>Give clients a clear plan.</h3>

            <p>
              Manage approved coaching relationships,
              assign training programs and review each
              client&apos;s recorded results.
            </p>

            <ul>
              <li>Manage your clients</li>
              <li>Assign workout programs</li>
              <li>Review completed training</li>
            </ul>

            <Link href="/register" className="text-link">
              Create an account
              <ArrowRight size={16} aria-hidden />
            </Link>
          </article>

          <article className="persona-card persona-athlete">
            <div className="persona-icon">
              <Dumbbell size={24} aria-hidden />
            </div>

            <p className="eyebrow">FOR ATHLETES</p>

            <h3>Know what to do next.</h3>

            <p>
              Follow your training, log sets quickly and see
              how the work adds up across weeks.
            </p>

            <ul>
              <li>Manage your program</li>
              <li>Record workouts and sets</li>
              <li>Track personal records</li>
            </ul>

            <Link href="/exercises" className="text-link">
              Browse the exercise library
              <ArrowRight size={16} aria-hidden />
            </Link>
          </article>
        </div>
      </section>

      <section className="landing-band">
        <div className="container landing-band-inner">
          <div className="stack tight">
            <p className="eyebrow">THE CORE WORKFLOW</p>

            <h2>From a plan to meaningful progress.</h2>

            <p className="muted">
              We prioritize dependable training records
              and understandable results over feature overload.
            </p>
          </div>

          <div className="landing-steps">
            <div>
              <ClipboardList size={20} aria-hidden />
              <strong>Plan</strong>
              <span>Build a clear workout</span>
            </div>

            <div>
              <CalendarCheck2 size={20} aria-hidden />
              <strong>Train</strong>
              <span>Record real sessions</span>
            </div>

            <div>
              <ChartNoAxesCombined size={20} aria-hidden />
              <strong>Review</strong>
              <span>Find useful trends</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container landing-final">
        <div>
          <ShieldCheck size={29} aria-hidden />

          <h2>Built for progress you can trust.</h2>

          <p>
            See how GymTrack handles training history,
            permissions, and personal records in a real
            demo account.
          </p>
        </div>

        <div className="landing-actions">
          <DemoButton />

          <Link className="btn ghost" href="/register">
            Create account
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
