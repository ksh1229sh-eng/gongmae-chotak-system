"use client";

import { useState } from "react";
import { bondAmount, bondRate, type BondKind, type JudgedEntry } from "@/lib/fees";

export type Registry = {
  label: string;
  propertyType: string;
  sido: string;
  metro: boolean | null;
  base: { section: string; rank: string; purpose: string } | null;
  judged: JudgedEntry[];
  cancelCount: number;
};

export type RegistryResultData = {
  registries: Registry[];
  cancelCount: number;
  cancelTax: number;
  filingFee: number;
};

type BondRow = { id: string; label: string; kind: BondKind; metro: boolean | null; value: string };

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

const KIND_LABEL: Record<BondKind, string> = { land: "토지", house: "주택", other: "그 밖의 건물" };

function defaultKind(propertyType: string): BondKind {
  if (propertyType === "토지") return "land";
  if (propertyType === "집합건물") return "house";
  return "other";
}

function EntryTable({ rows }: { rows: JudgedEntry[] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-zinc-500">
        <tr>
          <th className="py-1 pr-2 font-medium">구분</th>
          <th className="py-1 pr-2 font-medium">순위</th>
          <th className="py-1 pr-2 font-medium">등기목적</th>
          <th className="py-1 pr-2 font-medium">접수</th>
          <th className="py-1 font-medium">판단 이유</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={`${e.section}-${e.rank}-${e.purpose}`} className="border-t border-zinc-200 dark:border-zinc-700">
            <td className="py-1 pr-2">{e.section}</td>
            <td className="py-1 pr-2">{e.rank}</td>
            <td className="py-1 pr-2">{e.purpose}</td>
            <td className="py-1 pr-2 whitespace-nowrap">
              {e.receivedAt || "-"}
              {e.receiptNo ? ` 제${e.receiptNo}호` : ""}
            </td>
            <td className="py-1">{e.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RegistryResult({ data }: { data: RegistryResultData }) {
  const [rows, setRows] = useState<BondRow[]>(() =>
    data.registries.map((r) => ({
      id: crypto.randomUUID(),
      label: `${r.label} (${r.propertyType})`,
      kind: defaultKind(r.propertyType),
      metro: r.metro,
      value: "",
    })),
  );

  const update = (id: string, patch: Partial<BondRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const bondRows = rows.map((r) => {
    const value = Number(r.value.replace(/[^0-9]/g, ""));
    const ready = value > 0 && r.metro !== null;
    return {
      ...r,
      ready,
      rate: ready ? bondRate(r.kind, r.metro!, value) : 0,
      amount: ready ? bondAmount(r.kind, r.metro!, value) : 0,
    };
  });
  const bondTotal = bondRows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-4 text-sm">
      {data.registries.map((r) => {
        const cancel = r.judged.filter((e) => e.judgement === "cancel");
        const assume = r.judged.filter((e) => e.judgement === "assume");
        const unknown = r.judged.filter((e) => e.judgement === "unknown");
        return (
          <section key={r.label} className="space-y-2">
            <h3 className="font-semibold">
              {r.label} · {r.propertyType} · 말소 {r.cancelCount}건
            </h3>
            {r.base && (
              <p className="text-xs text-zinc-500">
                말소기준권리: {r.base.section} {r.base.rank}번 {r.base.purpose}
              </p>
            )}
            {cancel.length > 0 ? <EntryTable rows={cancel} /> : <p className="text-xs">말소 대상이 없습니다.</p>}
            {assume.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950">
                <p className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  인수 가능 — 전문가 확인 필요 (말소 건수에 넣지 않음)
                </p>
                <EntryTable rows={assume} />
              </div>
            )}
            {unknown.length > 0 && (
              <div className="rounded-md border border-zinc-300 p-2 dark:border-zinc-600">
                <p className="mb-1 text-xs font-semibold">자동 판단 보류 — 직접 확인 필요 (말소 건수에 넣지 않음)</p>
                <EntryTable rows={unknown} />
              </div>
            )}
          </section>
        );
      })}

      <section className="rounded-md bg-zinc-100 p-3 dark:bg-zinc-800">
        <dl className="grid grid-cols-[1fr_auto] gap-y-1">
          <dt>말소 건수 (합계)</dt>
          <dd className="text-right font-semibold">{data.cancelCount}건</dd>
          <dt>말소 등록면허세 ({data.cancelCount}건 × 7,200원)</dt>
          <dd className="text-right font-semibold">{won(data.cancelTax)}</dd>
          <dt>
            등기신청수수료 ({data.registries.length}통 × 18,000원 + {data.cancelCount}건 × 4,000원)
          </dt>
          <dd className="text-right font-semibold">{won(data.filingFee)}</dd>
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">국민주택채권 매입금액</h3>
        <p className="text-xs text-zinc-500">
          취득세 납부 고지서에 적힌 시가표준액(과세표준 아님)을 토지·건물 각각 입력하세요. (안내문 p.3)
        </p>
        {bondRows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2">
            <input
              aria-label="이름"
              className="w-36 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-600"
              value={r.label}
              onChange={(e) => update(r.id, { label: e.target.value })}
            />
            <select
              aria-label="용도"
              className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-600"
              value={r.kind}
              onChange={(e) => update(r.id, { kind: e.target.value as BondKind })}
            >
              {(Object.keys(KIND_LABEL) as BondKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <select
              aria-label="지역"
              className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-600"
              value={r.metro === null ? "" : r.metro ? "metro" : "other"}
              onChange={(e) => update(r.id, { metro: e.target.value === "" ? null : e.target.value === "metro" })}
            >
              <option value="">지역 선택</option>
              <option value="metro">특별시·광역시</option>
              <option value="other">그 밖의 지역</option>
            </select>
            <input
              aria-label="시가표준액"
              inputMode="numeric"
              placeholder="시가표준액(원)"
              className="w-36 rounded border border-zinc-300 bg-transparent px-2 py-1 text-right dark:border-zinc-600"
              value={r.value}
              onChange={(e) => update(r.id, { value: e.target.value })}
            />
            <span className="min-w-28 text-right">
              {!r.ready ? "-" : r.rate ? `${r.rate / 10}% → ${won(r.amount)}` : "매입 대상 아님"}
            </span>
            <button
              type="button"
              className="text-xs text-zinc-500 underline"
              onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
            >
              삭제
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs underline"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { id: crypto.randomUUID(), label: "추가 항목", kind: "land", metro: null, value: "" },
            ])
          }
        >
          + 시가표준액 항목 추가
        </button>
        <p className="font-semibold">채권 매입금액 합계: {won(bondTotal)}</p>
        <p className="text-xs text-zinc-500">
          1만원 미만은 반올림했습니다. 매입 후 바로 팔면 할인액만 실제로 부담하며, 할인율은 매일 바뀌어 계산하지
          않습니다. 농민이 농지를 매수하고 농지대장을 내면 매입이 면제됩니다. (안내문 p.2~3)
        </p>
      </section>

      <p className="rounded-md border border-red-300 p-2 text-xs text-red-700 dark:border-red-800 dark:text-red-300">
        AI 판단 결과이므로 등기부와 대조해 확인하세요. 말소 대상 판단이 어려우면 한국자산관리공사(1588-5321)에
        문의해 주세요.
      </p>
    </div>
  );
}
