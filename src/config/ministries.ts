/**
 * 省庁マスター定義
 * key は安定識別子として React key / state キーに使用する。
 * label は表示名で、DBの ministry カラムと一致する。
 */

export interface MinistryDef {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
}

export const MINISTRIES: MinistryDef[] = [
  { key: "CAO",  label: "内閣府",     shortLabel: "内閣", color: "#2563eb" },
  { key: "MOJ",  label: "法務省",     shortLabel: "法務", color: "#7c3aed" },
  { key: "METI", label: "経済産業省", shortLabel: "経産", color: "#dc2626" },
  { key: "MLIT", label: "国土交通省", shortLabel: "国交", color: "#ea580c" },
  { key: "MOD",  label: "防衛省",     shortLabel: "防衛", color: "#059669" },
  { key: "MOFA", label: "外務省",     shortLabel: "外務", color: "#0891b2" },
  { key: "MIC",  label: "総務省",     shortLabel: "総務", color: "#4f46e5" },
  { key: "MHLW", label: "厚生労働省", shortLabel: "厚労", color: "#be185d" },
  { key: "MEXT", label: "文部科学省", shortLabel: "文科", color: "#ca8a04" },
  { key: "MAFF", label: "農林水産省", shortLabel: "農水", color: "#16a34a" },
  { key: "MOF",  label: "財務省",     shortLabel: "財務", color: "#0f766e" },
  { key: "MOE",  label: "環境省",     shortLabel: "環境", color: "#15803d" },
  { key: "DA",   label: "デジタル庁", shortLabel: "デジ", color: "#6366f1" },
];

/** label → MinistryDef */
const BY_LABEL: Record<string, MinistryDef> = Object.fromEntries(
  MINISTRIES.map((m) => [m.label, m]),
);

/** key → MinistryDef */
const BY_KEY: Record<string, MinistryDef> = Object.fromEntries(
  MINISTRIES.map((m) => [m.key, m]),
);

/** DB表示名 → 安定キー（見つからなければ表示名をそのまま返す） */
export function labelToKey(label: string): string {
  return BY_LABEL[label]?.key ?? label;
}

/** 安定キー → MinistryDef（未登録省庁にはフォールバック） */
export function getMinistry(key: string): MinistryDef {
  return (
    BY_KEY[key] ?? {
      key,
      label: key,
      shortLabel: key.slice(0, 2),
      color: "#6b7280",
    }
  );
}

/** DB表示名 → MinistryDef（未登録省庁にはフォールバック） */
export function getMinistryByLabel(label: string): MinistryDef {
  return (
    BY_LABEL[label] ?? {
      key: label,
      label,
      shortLabel: label.slice(0, 2),
      color: "#6b7280",
    }
  );
}
