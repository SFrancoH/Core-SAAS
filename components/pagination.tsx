import Link from "next/link";

type Query = { q?: string; limit?: string | number; sort?: string; dir?: string };
type Props = { basePath: string; page: number; totalPages: number; query: Query };

function buildHref(basePath: string, page: number, query: Query): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (query.q) params.set("q", query.q);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.sort) params.set("sort", query.sort);
  if (query.dir) params.set("dir", query.dir);
  return `${basePath}?${params.toString()}`;
}

export default function Pagination({ basePath, page, totalPages, query }: Props) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Paginación">
      {page > 1 ? <Link href={buildHref(basePath, page - 1, query)}>Anterior</Link> : <span />}
      <strong>Página {page} de {totalPages}</strong>
      {page < totalPages ? <Link href={buildHref(basePath, page + 1, query)}>Siguiente</Link> : <span />}
    </nav>
  );
}
