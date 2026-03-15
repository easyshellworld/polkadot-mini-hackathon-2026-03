import { GetVpDetails } from "@/app/app/get-vp/_components/get-vp-details";
import { GetVpIntroShell } from "@/app/app/get-vp/_components/get-vp-intro-shell";

export default function GetVpPage() {
  return <GetVpIntroShell details={<GetVpDetails />} />;
}
