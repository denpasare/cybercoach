import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import styles from "./page.module.css";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Microsoft Email Sync SaaS</h1>
        <p className={styles.description}>
          Securely connect Microsoft accounts, sync inbox emails from Microsoft
          Graph, and browse them in a clean dashboard.
        </p>

        {!session ? (
          <form
            action={async () => {
              "use server";
              await signIn("microsoft", { redirectTo: "/dashboard" });
            }}
          >
            <button className={styles.primaryButton} type="submit">
              Sign in with Microsoft
            </button>
          </form>
        ) : (
          <div className={styles.actions}>
            <p className={styles.signedInText}>
              Signed in as <strong>{session.user?.email}</strong>
            </p>
            <Link href="/dashboard" className={styles.primaryButton}>
              Open dashboard
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className={styles.secondaryButton} type="submit">
                Sign out
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
