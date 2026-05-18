import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import styles from "./page.module.css";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Microsoft Email Sync SaaS</h1>
        <p className={styles.description}>
          Securely connect Microsoft accounts, sync inbox emails from Microsoft
          Graph, and browse them in a clean dashboard.
        </p>

        {!session ? (
          <Link
            className={styles.primaryButton}
            href="/api/auth/signin/microsoft?callbackUrl=/dashboard"
          >
            <span>
              Sign in with Microsoft
            </span>
          </Link>
        ) : (
          <div className={styles.actions}>
            <p className={styles.signedInText}>
              Signed in as <strong>{session.user?.email}</strong>
            </p>
            <Link href="/dashboard" className={styles.primaryButton}>
              Open dashboard
            </Link>
            <Link
              className={styles.secondaryButton}
              href="/api/auth/signout?callbackUrl=/"
            >
              Sign out
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
