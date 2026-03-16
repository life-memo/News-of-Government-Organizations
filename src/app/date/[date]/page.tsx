import DateDetailClient from "./DateDetailClient";
import itemsData from "../../../../public/data/items.json";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJSTDateKey(published_at: string): string {
  const jst = new Date(new Date(published_at).getTime() + JST_OFFSET_MS);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

export async function generateStaticParams() {
  const dates = new Set(
    (itemsData as { published_at: string }[]).map((item) =>
      toJSTDateKey(item.published_at)
    )
  );
  return [...dates].map((date) => ({ date }));
}

export default function Page({ params }: { params: { date: string } }) {
  return <DateDetailClient date={params.date} />;
}
