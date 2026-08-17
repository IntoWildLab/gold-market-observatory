"use client";

import { fmtNumber, fmtSigned, pnlClass, pnlArrow } from "@/lib/format";

interface Props {
  label: string;
  value: number | null;
  unit?: string;
  /** 变化数值(用于显示涨跌) */
  change?: number | null;
  /** 变化百分比 */
  changePct?: number | null;
  changeLabel?: string;
  date?: string | null;
  source?: string;
  sourceUrl?: string;
  isProxy?: boolean;
  proxyNote?: string;
  frequency?: string;
  note?: string;
  valueDigits?: number;
  accent?: boolean;
}

export default function KpiCard({
  label,
  value,
  unit,
  change,
  changePct,
  changeLabel,
  date,
  source,
  sourceUrl,
  isProxy,
  proxyNote,
  frequency,
  note,
  valueDigits = 2,
  accent,
}: Props) {
  const hasChange = change !== null && change !== undefined && Number.isFinite(change);
  return (
    <div className={`panel p-4 ${accent ? "border-[#d4a72c]/40" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-[#8b949e]">{label}</div>
        {isProxy && (
          <span className="proxy-tag" title={proxyNote}>
            代理指标
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`num text-2xl font-bold ${accent ? "text-[#d4a72c]" : "text-[#e6edf3]"}`}>
          {value === null || value === undefined || !Number.isFinite(value) ? "—" : fmtNumber(value, valueDigits)}
        </span>
        {unit && <span className="text-xs text-[#8b949e]">{unit}</span>}
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm">
        {hasChange ? (
          <>
            <span className={`num ${pnlClass(change)}`}>
              {pnlArrow(change)} {changeLabel ?? fmtSigned(change)}
            </span>
            {changePct !== null && changePct !== undefined && (
              <span className={`num ${pnlClass(changePct)}`}>({fmtSigned(changePct)}%)</span>
            )}
          </>
        ) : (
          <span className="text-[#8b949e]">—</span>
        )}
        {date && <span className="ml-auto text-xs text-[#8b949e]">截至 {date}</span>}
      </div>
      {note && <div className="mt-1 text-xs text-[#8b949e]">{note}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[#8b949e]">
        {source && (
          <span className="src-tag">
            来源: {sourceUrl ? <a className="hover:text-[#d4a72c] underline" href={sourceUrl} target="_blank" rel="noreferrer">{source}</a> : source}
          </span>
        )}
        {frequency && <span className="src-tag">频率: {frequency}</span>}
        {isProxy && proxyNote && (
          <span className="src-tag" title={proxyNote}>
            说明: {proxyNote.length > 30 ? proxyNote.slice(0, 30) + "…" : proxyNote}
          </span>
        )}
      </div>
    </div>
  );
}
