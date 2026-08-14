import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Crosshair } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-[calc(100dvh-var(--grok-banner-h,0px))] place-items-center bg-bg p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
            <Crosshair className="size-6" strokeWidth={2} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-fg uppercase">
            Sign in
          </h1>
          <p className="text-sm text-muted">Optional — play as guest anytime.</p>
        </div>
        {authEnabled ? (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="w-full rounded-md border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-fg transition-colors hover:border-primary/50 hover:bg-primary/10"
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link
          to="/"
          className="block text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Back to game
        </Link>
      </div>
    </main>
  );
}
