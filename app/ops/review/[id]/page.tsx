import { notFound } from "next/navigation";
import { getReviewDetail } from "../../../../lib/data/d1-repository.ts";
import { ReviewEditor } from "./ReviewEditor.tsx";

export default async function ReviewDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const detail=await getReviewDetail(id);if(!detail)notFound();
  return <main className="ops-main"><div className="ops-title"><h1>공고 검토</h1><p>자동 evidence를 보존하면서 운영자 확인 결과를 저장합니다.</p></div><ReviewEditor opportunity={detail.opportunity} rawText={detail.rawText}/></main>;
}
