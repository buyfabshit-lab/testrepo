import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { money } from "../lib/format";
import type { CartLine } from "../lib/types";

export function CartDrawer({
  open,
  onClose,
  cart,
  setQty,
  subtotal,
  checkout,
  busy,
  error,
  outcome,
  onDismissOutcome,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  setQty: (productId: string, qty: number) => void;
  subtotal: number;
  checkout: (note: string) => Promise<boolean>;
  busy: boolean;
  error: string | null;
  outcome: "success" | "cancelled" | null;
  onDismissOutcome: () => void;
}) {
  const [note, setNote] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    await checkout(note);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-60 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-void/75 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Cart"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className="relative flex h-full w-full max-w-md flex-col glass"
          >
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
              <h3 className="font-display text-xl font-extrabold text-bone">Your cart</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-ash transition-colors hover:text-bone"
              >
                Close
              </button>
            </div>

            <div className="thin-scroll flex-1 overflow-y-auto px-6 py-5">
              {outcome === "cancelled" && (
                <p className="mb-4 rounded-xl bg-white/5 px-4 py-3 text-xs leading-relaxed text-ash">
                  Checkout cancelled — nothing was charged. Your cart is as you left it.
                </p>
              )}
              {outcome === "success" ? (
                <div className="rounded-2xl bg-hot-500/10 p-5 text-center">
                  <p className="font-display text-lg font-bold text-bone">Paid. Thank you.</p>
                  <p className="mt-2 text-sm text-ash">
                    Stripe has your payment and your receipt is on its way by email.
                    DIME packs and ships from New York.
                  </p>
                  <button
                    type="button"
                    onClick={onDismissOutcome}
                    className="mt-4 rounded-full bg-white/8 px-4 py-2 text-xs font-medium text-bone/85"
                  >
                    Keep shopping
                  </button>
                </div>
              ) : cart.length === 0 ? (
                <p className="pt-20 text-center text-sm text-ash">Nothing in here yet.</p>
              ) : (
                <ul className="space-y-3">
                  {cart.map((line) => (
                    <li
                      key={line.product.id}
                      className="flex items-center gap-3 rounded-2xl bg-white/4 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-bone">
                          {line.product.name}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-ash">
                          {money(line.product.price_cents, line.product.currency)} each
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-1">
                        <button
                          type="button"
                          onClick={() => setQty(line.product.id, line.qty - 1)}
                          aria-label={`Fewer ${line.product.name}`}
                          className="px-2.5 py-1.5 text-ash transition-colors hover:text-bone"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm tabular-nums text-bone">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(line.product.id, line.qty + 1)}
                          aria-label={`More ${line.product.name}`}
                          className="px-2.5 py-1.5 text-ash transition-colors hover:text-bone"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cart.length > 0 && outcome !== "success" && (
              <form onSubmit={submit} className="border-t border-white/8 p-6">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ash">Subtotal</span>
                  <span className="font-display text-2xl font-extrabold tabular-nums text-bone">
                    {money(subtotal)}
                  </span>
                </div>

                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  placeholder="size, colour, anything else (optional)"
                  aria-label="Order note"
                  className="mt-4 w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-bone outline-none ring-hot-500/60 placeholder:text-ash/70 focus:ring-2"
                />

                {error && <p className="mt-2 text-xs text-hot-400">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-4 w-full rounded-full bg-hot-500 px-5 py-3.5 text-sm font-semibold text-white transition glow-hot disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-ash disabled:shadow-none"
                >
                  {busy ? "Taking you to Stripe…" : "Checkout"}
                </button>
                <p className="mt-2.5 text-center text-[11px] leading-relaxed text-ash">
                  Secure payment handled by Stripe. Email and shipping address are
                  collected there — this page never sees your card.
                </p>
              </form>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
