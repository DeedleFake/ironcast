import { g as require_jsx_runtime, h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as signIn } from "./client-B0Lqc8Iq.mjs";
import { t as GROK_PROVIDERS } from "./providers-B-AR6wJz.mjs";
import { x as Crosshair } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-BOtHAupu.js
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-[calc(100dvh-var(--grok-banner-h,0px))] place-items-center bg-bg p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8 shadow-2xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center gap-3 text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex size-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, {
								className: "size-6",
								strokeWidth: 2
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-2xl font-bold tracking-wide text-fg uppercase",
							children: "Sign in"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Optional — play as guest anytime."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2",
					children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => signIn(p.providerId, { callbackURL: "/" }),
						className: "w-full rounded-md border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-fg transition-colors hover:border-primary/50 hover:bg-primary/10",
						children: ["Continue with ", p.label]
					}, p.providerId))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "block text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline",
					children: "Back to game"
				})
			]
		})
	});
}
//#endregion
export { Login as component };
