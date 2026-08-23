import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import type { CartLine, Product } from "../lib/types";
import type { Fan } from "../lib/fan";


/**
 * supabase-js wraps a non-2xx from an Edge Function in a FunctionsHttpError and
 * puts the real body on `context`. Shoppers deserve the actual reason ("only 2
 * left") rather than a generic failure, so dig it out when it is there.
 */
const CART_KEY = "dime.cart.v1";

/**
 * The cart has to outlive a page load: Stripe Checkout navigates away from the
 * site entirely, so a shopper who cancels comes back through a fresh boot.
 * Only slug and quantity are stored — prices are re-read from the catalogue on
 * load, so a stale saved cart can never resurrect an old price.
 */
function loadSavedCart(): { slug: string; qty: number }[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is { slug: string; qty: number } =>
        typeof (l as { slug?: unknown })?.slug === "string" &&
        Number.isFinite((l as { qty?: unknown })?.qty as number))
      .map((l) => ({ slug: l.slug, qty: Math.min(99, Math.max(1, Math.floor(l.qty))) }));
  } catch {
    return [];
  }
}

function saveCart(cart: CartLine[]): void {
  try {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify(cart.map((l) => ({ slug: l.product.slug, qty: l.qty }))),
    );
  } catch {
    /* private mode — the cart just won't survive a reload */
  }
}

async function readFunctionError(err: unknown): Promise<string | null> {
  try {
    const res = (err as { context?: Response }).context;
    if (!res || typeof res.json !== "function") return null;
    const body = await res.json();
    return typeof body?.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

export function useShop(fan: Fan) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"success" | "cancelled" | null>(null);

  // The saved cart is only restored once the catalogue has arrived. Until then
  // `cart` is legitimately empty, and writing that empty value back to storage
  // would erase the very cart we are about to restore.
  const hydrated = useRef(false);

  useEffect(() => {
    if (!isConfigured) {
      hydrated.current = true;
      return;
    }
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("dime_products")
        .select("*")
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (!alive) return;
      if (!data) {
        hydrated.current = true; // nothing to restore against; allow saves
        return;
      }
      setProducts(data);

      // Rebuild the saved cart against fresh catalogue rows, dropping anything
      // that has since been deactivated or deleted.
      const saved = loadSavedCart();
      if (saved.length) {
        setCart(
          saved
            .map(({ slug, qty }) => {
              const product = data.find((p) => p.slug === slug);
              return product ? { product, qty: Math.min(qty, product.stock ?? 99) } : null;
            })
            .filter((l): l is CartLine => l !== null && l.qty > 0),
        );
      }
      hydrated.current = true;
    })();
    return () => {
      alive = false;
    };
  }, []);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("checkout");
    if (result !== "success" && result !== "cancelled") return;

    setOutcome(result);
    if (result === "success") {
      setCart([]);
      try {
        localStorage.removeItem(CART_KEY);
      } catch {
        /* non-fatal */
      }
    }

    // The webhook is what actually marks the order paid; this banner only
    // reflects the redirect, so it never claims more than "Stripe took it".
    params.delete("checkout");
    params.delete("session");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }, []);

  const add = useCallback((product: Product) => {
    setOutcome(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (!existing) return [...prev, { product, qty: 1 }];
      const ceiling = product.stock ?? Infinity;
      return prev.map((l) =>
        l.product.id === product.id
          ? { ...l, qty: Math.min(l.qty + 1, ceiling, 99) }
          : l,
      );
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product.id !== productId)
        : prev.map((l) => (l.product.id === productId ? { ...l, qty } : l)),
    );
  }, []);

  const clear = useCallback(() => setCart([]), []);
  const dismissOutcome = useCallback(() => setOutcome(null), []);

  // Mirror every cart change into storage, but never before hydration.
  useEffect(() => {
    if (!hydrated.current) return;
    saveCart(cart);
  }, [cart]);
  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.product.price_cents * l.qty, 0),
    [cart],
  );
  const itemCount = useMemo(() => cart.reduce((n, l) => n + l.qty, 0), [cart]);

  /**
   * Hands off to Stripe Checkout.
   *
   * Only slugs and quantities are sent. The Edge Function re-prices the whole
   * cart from `dime_products` before creating the Session, so nothing this
   * browser says about money is trusted — a tampered cart cannot change what
   * Stripe charges. Email and shipping address are collected by Stripe, not
   * by us, so this page never handles either.
   */
  const checkout = useCallback(
    async (note: string) => {
      if (!cart.length || !isConfigured) return false;
      setBusy(true);
      setError(null);

      const { data, error: err } = await supabase.functions.invoke<{ url?: string }>(
        "dime-checkout",
        {
          body: {
            items: cart.map((l) => ({ slug: l.product.slug, qty: l.qty })),
            fan_id: fan.id,
            handle: fan.handle,
            note: note.trim(),
            origin: window.location.origin,
          },
        },
      );

      if (err || !data?.url) {
        setBusy(false);
        // The function returns a readable reason for the cases a shopper can
        // actually act on (sold out, price changed); anything else is generic.
        const detail =
          err && typeof err === "object" && "context" in err
            ? await readFunctionError(err)
            : null;
        setError(detail ?? "couldn't start checkout — try again");
        return false;
      }

      // Cart is deliberately left intact, and it is persisted, so bouncing off
      // the Stripe page without paying brings them back to it unchanged.
      window.location.href = data.url;
      return true;
    },
    [cart, fan.handle, fan.id],
  );

  return {
    products,
    cart,
    add,
    setQty,
    clear,
    subtotal,
    itemCount,
    checkout,
    busy,
    error,
    outcome,
    dismissOutcome,
  };
}
