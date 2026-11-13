// P-01 Landing
import { Link } from "react-router";

import { PageContainer } from "../components/PageContainer";
import { useMe } from "../features/auth/useMe";

/** トップページ。サービスの説明とサンプルのツリー図、Explore・新規登録への導線（manifests/common.md P-01） */
export default function LandingPage() {
  const { user, isLoading } = useMe();
  const primary =
    "bg-brand-600 hover:bg-brand-700 rounded-lg px-5 py-2.5 text-sm font-semibold text-white";
  const secondary =
    "rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50";

  return (
    <PageContainer className="grid items-center gap-10 md:grid-cols-2 md:py-20">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
          Grow every idea into a <span className="text-brand-600">tree</span>.
        </h1>
        <p className="mt-4 text-lg text-pretty text-slate-600">
          Start with one central idea and branch it out with notes, links, videos and images, all on
          one canvas. Keep trees private, or share them for others to explore.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {isLoading ? null : user ? (
            <Link to="/me" className={primary} data-testid="go-to-my-trees">
              Go to My Trees
            </Link>
          ) : (
            <Link to="/signup" className={primary} data-testid="landing-signup">
              Sign up free
            </Link>
          )}
          <Link to="/explore" className={secondary}>
            Explore ideas
          </Link>
        </div>
      </div>
      <SampleTree />
    </PageContainer>
  );
}

/** サンプルのツリー図（装飾用） */
function SampleTree() {
  const branches = [
    { x: 60, y: 50, label: "Problem" },
    { x: 300, y: 50, label: "Market" },
    { x: 40, y: 230, label: "Pricing" },
    { x: 310, y: 230, label: "Next steps" },
  ];
  return (
    <svg
      viewBox="0 0 400 280"
      role="img"
      aria-label="Example idea tree"
      className="bg-canvas w-full rounded-2xl p-4"
    >
      {branches.map((b) => (
        <line
          key={b.label}
          x1={200}
          y1={140}
          x2={b.x + 40}
          y2={b.y + 15}
          stroke="#94a3b8"
          strokeWidth={2}
        />
      ))}
      <rect x={130} y={115} width={140} height={50} rx={12} fill="#16a34a" />
      <text x={200} y={146} textAnchor="middle" fill="white" fontSize={16} fontWeight={600}>
        Startup ideas
      </text>
      {branches.map((b) => (
        <g key={`${b.label}-node`}>
          <rect x={b.x} y={b.y} width={80} height={30} rx={8} fill="white" stroke="#cbd5e1" />
          <text x={b.x + 40} y={b.y + 20} textAnchor="middle" fontSize={12} fill="#0f172a">
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
