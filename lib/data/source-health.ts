export type OperationalHealth="GREEN"|"YELLOW"|"RED"|"N/A";

export function calculateOperationalHealth(input:{implemented:boolean;enabled:boolean;latestResult:string|null;consecutiveFailures:number}):OperationalHealth{
  if(!input.implemented||!input.enabled)return"N/A";
  if(input.latestResult==="SUCCESS_WITH_ITEMS"||input.latestResult==="SUCCESS_NO_ITEMS")return"GREEN";
  if(input.latestResult==="FAILED"&&input.consecutiveFailures>=2)return"RED";
  return"YELLOW";
}

export type DiscoverySummary={pending:number;complete:number;unsupported:number;failed:number};
export type DiscoveryStateRow={source_id:string;relevance_status:string;attachment_discovery_status:string};

export function summarizeEligibleDiscovery(rows:DiscoveryStateRow[]):Map<string,DiscoverySummary>{
  const summaries=new Map<string,DiscoverySummary>();
  for(const row of rows){
    if(row.relevance_status!=="IN_SCOPE")continue;
    const summary=summaries.get(row.source_id)??{pending:0,complete:0,unsupported:0,failed:0};
    if(row.attachment_discovery_status==="PENDING")summary.pending++;
    else if(row.attachment_discovery_status==="COMPLETE")summary.complete++;
    else if(row.attachment_discovery_status==="UNSUPPORTED")summary.unsupported++;
    else if(row.attachment_discovery_status==="FAILED")summary.failed++;
    summaries.set(row.source_id,summary);
  }
  return summaries;
}
