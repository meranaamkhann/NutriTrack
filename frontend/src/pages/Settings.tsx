import { useSearchParams } from "react-router-dom";
import { PageHeader, Tabs } from "../components/ui";
import { ProfileTab } from "./settings/ProfileTab";
import { TargetsTab } from "./settings/TargetsTab";
import { SecurityTab } from "./settings/SecurityTab";
import { AccountTab } from "./settings/AccountTab";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "targets", label: "Daily targets" },
  { id: "security", label: "Security" },
  { id: "account", label: "Account" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function Settings() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const active: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "profile";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile, daily targets, sign-in security and account." />
      <Tabs tabs={[...TABS]} active={active} onChange={(id) => setParams({ tab: id }, { replace: true })} />
      {active === "profile" && <ProfileTab />}
      {active === "targets" && <TargetsTab />}
      {active === "security" && <SecurityTab />}
      {active === "account" && <AccountTab />}
    </div>
  );
}
