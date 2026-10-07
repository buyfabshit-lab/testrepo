/**
 * Hand-authored types for the `pressline` schema (the Supabase generator only
 * emits schemas exposed on the Data API). Keep in lock-step with supabase/migrations.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatusEnum =
  | "NEW" | "QUOTED" | "APPROVED" | "PAID" | "BLANKS_ORDERED" | "ART_READY"
  | "ON_GANG_SHEET" | "PRINTED" | "PACKED" | "SHIPPED" | "DONE" | "HOLD" | "CANCELLED";

type Row<T> = T;
type Ins<T, Required extends keyof T = never> = Partial<T> & Pick<T, Required>;

export type CustomerRow = {
  id: string; name: string | null; email: string | null; phone: string | null; company: string | null;
  source: string | null; niche: string | null; brand_affinity: string[] | null; vip: boolean | null;
  email_opt_in: boolean | null; sms_consent_at: string | null; sms_consent_text: string | null;
  sms_consent_source: string | null; sms_consent_ip: string | null; sms_opted_out_at: string | null;
  screened_at: string | null; screen_result: string | null; created_at: string | null;
  address: Json | null;
}
export type StaffRow = { id: string; name: string | null; role: "owner" | "production" | "print" | "ship" }
export type VaultAssetRow = {
  id: string; storage_path: string; drive_file_id: string | null; brand: string | null; title: string | null;
  tags: string[] | null; colors: number | null; dpi: number | null; license: "mcg" | "customer" | "camo" | null;
  thumb_url: string | null; content_hash: string | null; created_at: string | null;
}
export type DesignRow = {
  id: string; customer_id: string | null; vault_asset_ids: string[] | null; studio_json: Json | null;
  print_file_path: string | null; file_name: string | null; drive_file_id: string | null;
  method: "screen" | "dtf" | "emb" | "uv" | null; colors: number | null; locations: string[] | null;
  width_in: number | null; height_in: number | null; approved_at: string | null; created_at: string | null;
}
export type BlankRow = {
  id: string; supplier: "ss" | "sanmar" | "unity" | "other" | null; style: string | null; brand: string | null;
  color: string | null; sizes: string[] | null; cost: number | null; photo_front: string | null; photo_back: string | null;
  supplier_style_id: string | null; updated_at: string | null;
}
export type PriceRuleRow = {
  id: string; method: string | null; qty_min: number | null; qty_max: number | null; base: number | null;
  per_location: number | null; per_color: number | null; setup_fee: number | null; margin_pct: number | null;
}
export type QuoteRow = {
  id: string; customer_id: string | null; lines: Json | null; subtotal: number | null; total: number | null;
  status: string | null; approved_by: string | null; approved_at: string | null; created_at: string | null;
}
export type OrderRow = {
  id: string; number: number; quote_id: string | null; customer_id: string | null; store_id: string | null;
  status: OrderStatusEnum | null; due_date: string | null; assigned_to: string | null; proof_token: string | null;
  rush: boolean | null; created_at: string | null;
}
export type OrderLineRow = {
  id: string; order_id: string | null; blank_id: string | null; sizes: Json | null; design_id: string | null;
  locations: string[] | null; unit_price: number | null;
}
export type InvoiceRow = {
  id: string; order_id: string | null; stripe_invoice_id: string | null; stripe_checkout_session_id: string | null;
  amount: number | null; paid_at: string | null;
}
export type PurchaseOrderRow = {
  id: string; order_id: string | null; supplier: string | null; supplier_po: string | null; lines: Json | null;
  status: string | null; approved_by: string | null; approved_at: string | null; created_at: string | null;
}
export type GangRunRow = {
  id: string; run_date: string | null; sheet_files: string[] | null; design_ids: string[] | null;
  sent_to_danny_at: string | null; report: string | null; created_at: string | null;
}
export type ShipmentRow = {
  id: string; order_id: string | null; carrier: string | null; tracking: string | null; label_url: string | null;
  shipped_at: string | null; delivered_at: string | null;
}
export type StoreRow = {
  id: string; name: string | null; slug: string | null; type: "shopify" | "stripe" | "skrewu" | "popup" | "wholesale" | null;
  config: Json | null; world_room: string | null; opens_at: string | null; closes_at: string | null;
  fundraising_pct: number | null; closed_order_id: string | null; created_at: string | null;
}
export type ProductRow = {
  id: string; design_id: string | null; blank_id: string | null; store_id: string | null; title: string | null;
  price: number | null; mockups: string[] | null; published: Json | null; created_at: string | null;
}
export type StoreOrderRow = {
  id: string; store_id: string | null; customer_id: string | null; product_id: string | null; sizes: Json | null;
  total: number | null; stripe_checkout_session_id: string | null; paid_at: string | null; created_at: string | null;
}
export type CampaignRow = {
  id: string; name: string | null; channel: "email" | "sms" | null; workflow: string | null; audience_filter: Json | null; status: string | null;
}
export type TouchRow = {
  id: string; customer_id: string | null; campaign_id: string | null; channel: string | null; payload: Json | null;
  sent_at: string | null; replied_at: string | null; converted_order_id: string | null;
}
export type EventRow = {
  id: number; order_id: string | null; actor: string | null; kind: string | null; msg: string | null; data: Json | null; ts: string | null;
}
export type IntegrationTokenRow = { provider: string; access_token: string; expires_at: string; updated_at: string | null }
export type PinAttemptRow = { key: string; failures: number | null; locked_until: string | null; updated_at: string | null }

type Table<R, I = Partial<R>, Rel = []> = { Row: Row<R>; Insert: I; Update: Partial<R>; Relationships: Rel };

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  pressline: {
    Tables: {
      customers: Table<CustomerRow>;
      staff: Table<StaffRow, Ins<StaffRow, "id" | "role">>;
      vault_assets: Table<VaultAssetRow, Ins<VaultAssetRow, "storage_path">>;
      designs: Table<DesignRow, Partial<DesignRow>, [{ foreignKeyName: "designs_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }]>;
      blanks: Table<BlankRow>;
      price_rules: Table<PriceRuleRow>;
      quotes: Table<QuoteRow, Partial<QuoteRow>, [{ foreignKeyName: "quotes_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }, { foreignKeyName: "quotes_approved_by_fkey"; columns: ["approved_by"]; isOneToOne: false; referencedRelation: "staff"; referencedColumns: ["id"] }]>;
      orders: Table<OrderRow, Partial<OrderRow>, [{ foreignKeyName: "orders_quote_id_fkey"; columns: ["quote_id"]; isOneToOne: false; referencedRelation: "quotes"; referencedColumns: ["id"] }, { foreignKeyName: "orders_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }, { foreignKeyName: "orders_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "staff"; referencedColumns: ["id"] }]>;
      order_lines: Table<OrderLineRow, Partial<OrderLineRow>, [{ foreignKeyName: "order_lines_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }, { foreignKeyName: "order_lines_blank_id_fkey"; columns: ["blank_id"]; isOneToOne: false; referencedRelation: "blanks"; referencedColumns: ["id"] }, { foreignKeyName: "order_lines_design_id_fkey"; columns: ["design_id"]; isOneToOne: false; referencedRelation: "designs"; referencedColumns: ["id"] }]>;
      invoices: Table<InvoiceRow, Partial<InvoiceRow>, [{ foreignKeyName: "invoices_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }]>;
      purchase_orders: Table<PurchaseOrderRow, Partial<PurchaseOrderRow>, [{ foreignKeyName: "purchase_orders_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }, { foreignKeyName: "purchase_orders_approved_by_fkey"; columns: ["approved_by"]; isOneToOne: false; referencedRelation: "staff"; referencedColumns: ["id"] }]>;
      gang_runs: Table<GangRunRow>;
      shipments: Table<ShipmentRow, Partial<ShipmentRow>, [{ foreignKeyName: "shipments_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }]>;
      stores: Table<StoreRow, Partial<StoreRow>, [{ foreignKeyName: "stores_closed_order_id_fkey"; columns: ["closed_order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }]>;
      products: Table<ProductRow, Partial<ProductRow>, [{ foreignKeyName: "products_design_id_fkey"; columns: ["design_id"]; isOneToOne: false; referencedRelation: "designs"; referencedColumns: ["id"] }, { foreignKeyName: "products_blank_id_fkey"; columns: ["blank_id"]; isOneToOne: false; referencedRelation: "blanks"; referencedColumns: ["id"] }, { foreignKeyName: "products_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] }]>;
      store_orders: Table<StoreOrderRow, Partial<StoreOrderRow>, [{ foreignKeyName: "store_orders_store_id_fkey"; columns: ["store_id"]; isOneToOne: false; referencedRelation: "stores"; referencedColumns: ["id"] }, { foreignKeyName: "store_orders_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }, { foreignKeyName: "store_orders_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }]>;
      campaigns: Table<CampaignRow>;
      touches: Table<TouchRow, Partial<TouchRow>, [{ foreignKeyName: "touches_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }, { foreignKeyName: "touches_campaign_id_fkey"; columns: ["campaign_id"]; isOneToOne: false; referencedRelation: "campaigns"; referencedColumns: ["id"] }, { foreignKeyName: "touches_converted_order_id_fkey"; columns: ["converted_order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }]>;
      events: Table<EventRow, Partial<EventRow>, [{ foreignKeyName: "events_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }]>;
      integration_tokens: Table<IntegrationTokenRow, Ins<IntegrationTokenRow, "provider" | "access_token" | "expires_at">>;
      pin_attempts: Table<PinAttemptRow, Ins<PinAttemptRow, "key">>;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_staff: { Args: Record<string, never>; Returns: boolean };
      staff_role: { Args: Record<string, never>; Returns: string };
      is_owner: { Args: Record<string, never>; Returns: boolean };
      my_customer_id: { Args: Record<string, never>; Returns: string };
    };
    Enums: { order_status: OrderStatusEnum };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["pressline"]["Tables"]> = Database["pressline"]["Tables"][T]["Row"];
