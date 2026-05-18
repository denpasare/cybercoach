import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-brand">
          Emailyzer
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Your Outlook inbox, securely synced.
        </h1>
        <p className="mt-5 text-lg text-slate-600">
          Sign in with your Microsoft account to connect Outlook and browse
          your inbox in a clean dashboard. Your tokens are encrypted at rest
          and never sent to the browser.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-brand px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            Get started
          </Link>
          <a
            href="https://learn.microsoft.com/graph/api/resources/mail-api-overview"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            About Microsoft Graph
          </a>
        </div>
      </div>
    </main>
  );
}
