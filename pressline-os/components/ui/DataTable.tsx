import Link from "next/link";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
  /** hide on phones */
  hideSm?: boolean;
}

export function DataTable<T>({ columns, rows, rowKey, rowHref, empty = "No rows" }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; rowHref?: (row: T) => string; empty?: React.ReactNode;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-mf-dim">{empty}</p>;
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-mf-line text-left">
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 text-[.65rem] font-bold uppercase tracking-[.15em] text-mf-dim ${c.hideSm ? "hidden md:table-cell" : ""} ${c.className ?? ""}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = rowHref?.(r);
            return (
              <tr key={rowKey(r)} className="border-b border-mf-line/60 align-top hover:bg-mf-bg/60">
                {columns.map((c, i) => (
                  <td key={c.key} className={`px-3 py-2.5 ${c.hideSm ? "hidden md:table-cell" : ""} ${c.className ?? ""}`}>
                    {href && i === 0 ? <Link href={href} className="block text-mf-cream hover:text-mf-gold">{c.render(r)}</Link> : c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
