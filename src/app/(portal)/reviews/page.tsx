import { redirect } from "next/navigation";
export default function Reviews() {
  redirect("/waiting?type=APPROVALS");
}
