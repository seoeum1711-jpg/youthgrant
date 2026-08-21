import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN ?? "https://youthgrant-public-beta.seoeum1711.chatgpt.site"),
  title: { default:"YouthGrant — 근거로 찾는 청소년시설 공모", template:"%s | YouthGrant" },
  description:"청소년시설이 검토할 가치가 있는 공모사업을 신청 가능 근거와 함께 찾습니다.",
  icons:{ icon:"/favicon.svg", shortcut:"/favicon.svg" },
  openGraph:{title:"YouthGrant",description:"검토할 가치가 있는 공고를 근거와 함께 찾아냅니다.",images:[{url:"/og.png",width:1714,height:909,alt:"YouthGrant"}],locale:"ko_KR",type:"website"},
  twitter:{card:"summary_large_image",title:"YouthGrant",description:"검토할 가치가 있는 공고를 근거와 함께 찾아냅니다.",images:["/og.png"]},
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="ko"><body>{children}</body></html>;
}
