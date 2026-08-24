import assert from "node:assert/strict";
import test from "node:test";
import { calculateOperationalHealth, summarizeEligibleDiscovery } from "../lib/data/source-health.ts";

const active=(latestResult:string|null,consecutiveFailures=0)=>calculateOperationalHealth({implemented:true,enabled:true,latestResult,consecutiveFailures});

test("operational health is GREEN for successful results including repeated no-items",()=>{assert.equal(active("SUCCESS_WITH_ITEMS"),"GREEN");assert.equal(active("SUCCESS_NO_ITEMS"),"GREEN");assert.equal(active("SUCCESS_NO_ITEMS",4),"GREEN")});
test("operational health is YELLOW for one failure or an active source without runs",()=>{assert.equal(active("FAILED",1),"YELLOW");assert.equal(active(null),"YELLOW")});
test("operational health is RED after two or more consecutive failures",()=>{assert.equal(active("FAILED",2),"RED");assert.equal(active("FAILED",5),"RED")});
test("paused and not implemented sources use N/A",()=>{assert.equal(calculateOperationalHealth({implemented:true,enabled:false,latestResult:"FAILED",consecutiveFailures:5}),"N/A");assert.equal(calculateOperationalHealth({implemented:false,enabled:false,latestResult:null,consecutiveFailures:0}),"N/A")});
test("a success after failures resets health to GREEN",()=>{assert.equal(active("SUCCESS_WITH_ITEMS",0),"GREEN")});
test("eligible discovery summary excludes OUT_OF_SCOPE pending and separates discovery states",()=>{const summary=summarizeEligibleDiscovery([{source_id:"s",relevance_status:"OUT_OF_SCOPE",attachment_discovery_status:"PENDING"},{source_id:"s",relevance_status:"IN_SCOPE",attachment_discovery_status:"PENDING"},{source_id:"s",relevance_status:"IN_SCOPE",attachment_discovery_status:"COMPLETE"},{source_id:"s",relevance_status:"IN_SCOPE",attachment_discovery_status:"UNSUPPORTED"},{source_id:"s",relevance_status:"IN_SCOPE",attachment_discovery_status:"FAILED"}]).get("s");assert.deepEqual(summary,{pending:1,complete:1,unsupported:1,failed:1})});
