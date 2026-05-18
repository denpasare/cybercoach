import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { isDevModeEnabled } from "@/lib/dev-mode";

interface LoginPageProps {
  searchParams?: { callbackUrl?: string; error?: string };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) redirect(searchParams?.callbackUrl ?? "/dashboard");

  const callbackUrl = searchParams?.callbackUrl ?? "/dashboard";
  const error = searchParams?.error;
  const devMode = isDevModeEnabled();

  async function signInWithMicrosoft() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: callbackUrl });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand">
          Emailyzer
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your Microsoft work, school, or personal account. We&apos;ll
          request read-only access to your inbox.
        </p>

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Sign-in failed: {error}
          </div>
        ) : null}

        <form action={signInWithMicrosoft} className="mt-6">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2F2F2F] px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-black"
          >
            <MicrosoftLogo className="h-4 w-4" />
            Continue with Microsoft
          </button>
        </form>

        {devMode ? (
          <>
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or for local dev
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <a
              href="/api/dev/signin"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm transition hover:bg-amber-100"
            >
              Sign in as dev user (skip Microsoft)
            </a>
            <p className="mt-3 text-xs text-amber-700">
              Dev mode is on (<code>ENABLE_DEV_AUTH=true</code>). The
              sync endpoint will return synthetic emails for this user.
            </p>
          </>
        ) : null}

        <p className="mt-6 text-xs text-slate-500">
          By signing in, you authorize Emailyzer to read your Outlook mail
          via Microsoft Graph. You can revoke access any time from your
          Microsoft account settings.
        </p>
      </div>
    </main>
  );
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 23 23"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
