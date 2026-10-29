import { GUIDE_PAGES } from "@/lib/guide";

// 업무 매뉴얼은 안내문(lib/guide.ts) 원문을 그대로 쓰고, 쪽을 주제별로 나눠 목차만 만듭니다.
// 문구를 따로 옮겨 적으면 안내문이 바뀔 때 엇갈리므로, 원문을 자르기만 합니다.
const pageText = (page: number) => GUIDE_PAGES.find((p) => p.page === page)?.text ?? "";

// 4쪽은 10번(납부)·11번(우표)·12번(제출)으로, 5쪽은 주소·유의사항으로 나눕니다.
const [p4Pay = "", p4Stamp = "", p4Submit = ""] = pageText(4).split(/\n\n(?=1[12]\. )/);
const [p5Address = "", p5Notice = ""] = pageText(5).split(/\n\n(?=유의사항\n)/);

export type ManualPart = { page: number; text: string };
export type ManualSection = { id: string; title: string; summary: string; parts: ManualPart[] };

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "documents",
    title: "서류 준비",
    summary: "매수자가 준비하는 서류와 발급처",
    parts: [
      { page: 1, text: pageText(1) },
      { page: 2, text: pageText(2) },
    ],
  },
  {
    id: "tax",
    title: "세금·채권·수수료",
    summary: "취득세·말소등록면허세·국민주택채권·등기신청수수료",
    parts: [
      { page: 3, text: pageText(3) },
      { page: 4, text: p4Pay },
    ],
  },
  {
    id: "stamp",
    title: "우표",
    summary: "등기필증 회송·송부용 우표",
    parts: [{ page: 4, text: p4Stamp }],
  },
  {
    id: "submit",
    title: "제출·촉탁",
    summary: "공사에 제출하는 방법과 지역본부 주소",
    parts: [
      { page: 4, text: p4Submit },
      { page: 5, text: p5Address },
    ],
  },
  {
    id: "notice",
    title: "유의사항",
    summary: "접수 시 지참물, 촉탁등기 진행 절차와 소요기간",
    parts: [{ page: 5, text: p5Notice }],
  },
].filter((s) => s.parts.every((p) => p.text.trim().length > 0));
