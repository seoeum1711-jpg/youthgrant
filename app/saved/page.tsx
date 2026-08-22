import { PublicHeader } from "../components/PublicHeader.tsx";
import { PublicFooter } from "../components/PublicFooter.tsx";
import { listPublicOpportunities } from "../../lib/data/d1-repository.ts";
import { toPublicGrantList } from "../../lib/domain/grant-view-model.ts";
import { SavedList } from "./SavedList.tsx";

export const dynamic="force-dynamic";
export default async function SavedPage(){const grants=toPublicGrantList(await listPublicOpportunities(),new Date());return <><PublicHeader current="saved"/><section className="saved-hero"><div><p className="eyebrow">SAVED GRANTS</p><h1>관심 공고</h1><p>이 브라우저에 저장한 공고입니다. 계정이나 서버에는 저장되지 않습니다.</p></div></section><main className="saved-main"><SavedList grants={grants}/></main><PublicFooter/></>}
