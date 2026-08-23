import { useCallback, useEffect, useMemo, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase";
import type { CartLine, Product } from "../lib/types";
import type { Fan } from "../lib/fan";

export function useShop(fan: Fan) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("dime_products")
        .select("*")
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (alive && data) setProducts(data);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const add = useCallback((product: Product) => {
    setOrderId(null);
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

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.product.price_cents * l.qty, 0),
    [cart],
  );
  const itemCount = useMemo(() => cart.reduce((n, l) => n + l.qty, 0), [cart]);

  /**
   * Records the order in Supabase and returns its id. There is no payment
   * step yet — see README "Shop: what's wired and what isn't". Orders land
   * as `pending` for DIME to fulfil manually.
   */
  const placeOrder = useCallback(
    async (email: string, note: string) => {
      if (!cart.length || !isConfigured) return false;
      setPlacing(true);
      setError(null);

      // Deliberately no `.select()` chained on: dime_orders is insert-only
      // for the publishable key (orders carry an email address), and asking
      // PostgREST to return the row would be denied.
      const { error: err } = await supabase.from("dime_orders").insert({
        fan_id: fan.id,
        handle: fan.handle,
        email: email.trim(),
        note: note.trim() || null,
        subtotal_cents: subtotal,
        items: cart.map((l) => ({
          slug: l.product.slug,
          name: l.product.name,
          qty: l.qty,
          price_cents: l.product.price_cents,
        })),
      });

      setPlacing(false);

      if (err) {
        setError(
          /email/i.test(err.message)
            ? "that email doesn't look right"
            : "couldn't place the order — try again",
        );
        return false;
      }

      setOrderId(`${Date.now().toString(36).toUpperCase()}`);
      setCart([]);
      return true;
    },
    [cart, fan.handle, fan.id, subtotal],
  );

  return {
    products,
    cart,
    add,
    setQty,
    clear,
    subtotal,
    itemCount,
    placeOrder,
    placing,
    error,
    orderId,
  };
}
