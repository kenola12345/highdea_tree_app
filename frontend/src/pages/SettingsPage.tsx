// P-10 Settings
import clsx from "clsx";
import { useSearchParams } from "react-router";

import { PageContainer } from "../components/PageContainer";
import { Spinner } from "../components/Spinner";
import { useMe } from "../features/auth/useMe";
import { CategoriesTab } from "../features/categories/CategoriesTab";
import { AccountTab } from "../features/settings/AccountTab";
import { ProfileTab } from "../features/settings/ProfileTab";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account" },
  { id: "categories", label: "Categories" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value);
}

/** 設定ページ（P-10）。選択中のタブは ?tab= に持ち、再読み込みやリンクで同じタブを開けるようにする */
export default function SettingsPage() {
  const { user } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab");
  const active: TabId = isTabId(param) ? param : "profile";

  if (!user) return <Spinner />;

  function select(tab: TabId) {
    setSearchParams(tab === "profile" ? {} : { tab }, { replace: true });
  }

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold">Settings</h1>
      <div
        role="tablist"
        aria-label="Settings"
        className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => {
              select(tab.id);
            }}
            className={clsx(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap",
              active === tab.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`panel-${active}`}
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className="mt-6"
      >
        {/* key でユーザーが変わったとき（メール・ユーザー名変更後など）にフォームの初期値を作り直す */}
        {active === "profile" && <ProfileTab key={user.id} user={user} />}
        {active === "account" && <AccountTab key={user.id} user={user} />}
        {active === "categories" && <CategoriesTab />}
      </div>
    </PageContainer>
  );
}
