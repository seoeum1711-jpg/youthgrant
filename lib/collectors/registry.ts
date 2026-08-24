import type { SourceDefinition } from "./contracts.ts";

export const sourceRegistry:SourceDefinition[]=[
  {id:"bojo",name:"보조금통합포털",method:"WEB",region:"전국",url:"https://www.bojo.go.kr/",implemented:false,enabled:false,health:"RED"},
  {id:"fry",name:"농어촌청소년육성재단",method:"WEB",region:"전국",url:"https://www.fry.or.kr/board_news01/list.php?tn=board_news01",implemented:true,enabled:true,health:"GREEN"},
  {id:"gfgf",name:"경기미래세대재단",method:"WEB",region:"경기",url:"https://www.gfgf.kr/",implemented:true,enabled:true,health:"GREEN"},
  {id:"ggarte",name:"경기문화재단",method:"RSS",region:"경기",url:"https://www.ggcf.kr/",implemented:false,enabled:false,health:"GREEN"},
  {id:"ggdata_facility_api",name:"경기데이터드림 시설 API",method:"OPEN_DATA",region:"경기",url:"https://data.gg.go.kr/",implemented:false,enabled:false,health:"YELLOW"},
  {id:"gggov",name:"경기도청",method:"WEB",region:"경기",url:"https://www.gg.go.kr/",implemented:true,enabled:true,health:"GREEN"},
  {id:"ggwf",name:"경기도여성가족재단",method:"WEB",region:"경기",url:"https://www.gwff.kr/",implemented:false,enabled:false,health:"GREEN"},
  {id:"ggyouth",name:"경기도청소년활동진흥센터",method:"WEB",region:"경기",url:"https://ggyouth.or.kr/07_openYard/noticeList.do",implemented:true,enabled:true,health:"GREEN"},
  {id:"ggyouthnet",name:"경기도청소년수련시설협회",method:"WEB",region:"경기",url:"https://ggyouthnet.or.kr/bbs/board.php?bo_table=notice_n",implemented:true,enabled:true,health:"GREEN"},
  {id:"hswf",name:"화성시여성가족청소년재단",method:"WEB",region:"경기",url:"https://www.hswf.or.kr/",implemented:false,enabled:false,health:"YELLOW"},
  {id:"kywa",name:"한국청소년활동진흥원",method:"WEB",region:"전국",url:"https://www.kywa.or.kr/pressinfo/notice_list.jsp",implemented:true,enabled:true,health:"GREEN"},
  {id:"mogef",name:"성평등가족부",method:"WEB",region:"전국",url:"https://www.mogef.go.kr/nw/ntc/nw_ntc_s001.do?mid=news400&div1=16",implemented:true,enabled:true,health:"GREEN"},
  {id:"mpva",name:"국가보훈부",method:"WEB",region:"전국",url:"https://www.mpva.go.kr/mpva/selectBbsNttList.do?bbsNo=360&key=76",implemented:true,enabled:true,health:"GREEN"},
  {id:"seoul_city",name:"서울특별시 고시·공고",method:"RSS",region:"서울",url:"https://seoulboard.seoul.go.kr/rss/RSSGenerator?bbsNo=277",implemented:true,enabled:true,health:"GREEN"},
  {id:"seoul_news_api",name:"서울시 열린데이터광장 새소식",method:"API",region:"서울",url:"http://openapi.seoul.go.kr:8088",implemented:true,enabled:false,health:"YELLOW"},
  {id:"seoul_youth",name:"서울시립청소년활동진흥센터",method:"WEB",region:"서울",url:"https://www.sy0404.or.kr/",implemented:false,enabled:false,health:"GREEN"},
  {id:"sdream",name:"삼성꿈장학재단",method:"WEB",region:"전국",url:"https://www.sdream.or.kr/main",implemented:true,enabled:true,health:"GREEN"},
  {id:"youthnet",name:"청소년정보망",method:"RSS",region:"전국",url:"https://www.youth.go.kr/",implemented:false,enabled:false,health:"RED"},
  {id:"youthportal",name:"청소년활동정보서비스",method:"WEB",region:"전국",url:"https://www.youth.go.kr/youth/",implemented:false,enabled:false,health:"YELLOW"},
];

export function getSource(id:string){return sourceRegistry.find(source=>source.id===id);}
